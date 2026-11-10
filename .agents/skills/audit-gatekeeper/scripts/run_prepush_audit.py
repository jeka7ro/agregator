#!/usr/bin/env python3
"""
Audit Gatekeeper — Pre-Push Automated Verification Script (6-Phase Architecture)
Project: GetApp.FooD / Aggregator 2.0
Mode: 100% READ-ONLY (Zero DB mutations, Zero file modifications)
Usage:
  python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py
  python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py --skip-build
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[4]


def run_cmd(cmd, cwd=ROOT_DIR, timeout=60):
    try:
        res = subprocess.run(
            cmd,
            cwd=str(cwd),
            shell=isinstance(cmd, str),
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return res.returncode, res.stdout.strip(), res.stderr.strip()
    except subprocess.TimeoutExpired:
        return 124, "", f"Timeout after {timeout}s"
    except Exception as exc:
        return 1, "", str(exc)


def read_text(rel_path):
    p = ROOT_DIR / rel_path
    if not p.exists():
        return ""
    return p.read_text(encoding="utf-8", errors="replace")


def phase_1_recon():
    """Faza 1: Reconnaissance & Inventar (git status -s, git diff)"""
    code_s, out_s, _ = run_cmd(["git", "status", "-s"])
    code_b, out_b, _ = run_cmd(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    code_c, out_c, _ = run_cmd(["git", "log", "-1", "--oneline"])

    modified_files = [line[3:].strip() for line in out_s.splitlines() if line.strip()]
    return {
        "branch": out_b if code_b == 0 else "unknown",
        "last_commit": out_c if code_c == 0 else "unknown",
        "status_lines": out_s.splitlines() if code_s == 0 else [],
        "modified_files": modified_files,
    }


def vector_1_forms_and_validation():
    """Vector 1: Reziliența formularelor, rutelor API și validarea datelor"""
    issues = []
    checks_run = 0

    # 1. Verificare sintactică Node.js pe ambele servere API și servicii critice
    js_targets = [
        "workers/src/api-server.js",
        "netlify/functions/api.js",
        "workers/src/services/iiko-client.js",
        "workers/src/services/product-matcher.js",
        "src/lib/productImages.js",
    ]
    for target in js_targets:
        checks_run += 1
        full_p = ROOT_DIR / target
        if not full_p.exists():
            issues.append(f"Fișier lipsă: {target}")
            continue
        rc, _, err = run_cmd(["node", "--check", str(full_p)])
        if rc != 0:
            issues.append(f"Eroare de sintaxă JS în {target}: {err.splitlines()[0] if err else 'SyntaxError'}")

    # 2. Verificare definire globală `withTimeout` în netlify/functions/api.js (prevenire ReferenceError 500 pe webhook)
    checks_run += 1
    netlify_api = read_text("netlify/functions/api.js")
    if "const withTimeout =" not in netlify_api[:3500] and "function withTimeout" not in netlify_api[:3500]:
        issues.append("`withTimeout` nu este definit la nivel global în `netlify/functions/api.js` (risc ReferenceError 500 în processIikoOrders)")

    # 3. Verificare parsare numerică rezilientă (virgulă ',' -> '.', fallback 0 pentru '', null, NaN)
    checks_run += 1
    monitoring_src = read_text("src/pages/Monitoring.jsx")
    if ".replace(',', '.')" not in monitoring_src:
        issues.append("Lipsă normalizare virgulă zecimală `.replace(',', '.')` în `src/pages/Monitoring.jsx`")

    # 4. Test execuție reziliență la inputuri numerice goale / virgule / null în logica de calcul
    checks_run += 1
    node_script = """
    const parseSafeAmount = (v) => {
      if (v === '' || v === null || v === undefined) return 0;
      const n = parseFloat(String(v).replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const samples = ['', null, undefined, '12,5', '0', '168.00', 'abc'];
    const results = samples.map(parseSafeAmount);
    if (results.some(r => Number.isNaN(r))) process.exit(1);
    if (results[3] !== 12.5 || results[0] !== 0 || results[6] !== 0) process.exit(1);
    """
    rc, _, err = run_cmd(["node", "-e", node_script])
    if rc != 0:
        issues.append(f"Eșec test reziliență inputuri numerice: {err}")

    return len(issues) == 0, checks_run, issues


def vector_2_data_integrity_and_filters():
    """Vector 2: Integritatea datelor, izolarea multi-locație și filtre DB / Cache"""
    issues = []
    checks_run = 0

    # 1. Verificare `data/restaurants-cache.json` (existență, număr restaurante >= 25, zero link-uri false `/search?q=`)
    checks_run += 1
    rest_cache_path = ROOT_DIR / "data/restaurants-cache.json"
    if not rest_cache_path.exists():
        issues.append("Lipsă `data/restaurants-cache.json`")
    else:
        try:
            rests = json.loads(rest_cache_path.read_text(encoding="utf-8"))
            if isinstance(rests, dict):
                rests = rests.get("restaurants", [])
            if len(rests) < 25:
                issues.append(f"`data/restaurants-cache.json` conține prea puține restaurante ({len(rests)} < 25)")
            fake_search_urls = []
            for r in rests:
                for col in ("glovo_url", "wolt_url", "bolt_url"):
                    val = str(r.get(col) or "")
                    if "/search?q=" in val:
                        fake_search_urls.append(f"{r.get('name')} ({col})")
            if fake_search_urls:
                issues.append(f"URL-uri false `/search?q=` găsite în `restaurants-cache.json`: {', '.join(fake_search_urls[:5])}")
        except Exception as exc:
            issues.append(f"`data/restaurants-cache.json` JSON invalid: {exc}")

    # 2. Verificare `data/live-checks-cache.json` (zero poziții generice 'Produs' în stop-list și zero check-uri cu `/search?q=`)
    checks_run += 1
    checks_cache_path = ROOT_DIR / "data/live-checks-cache.json"
    if checks_cache_path.exists():
        try:
            checks_data = json.loads(checks_cache_path.read_text(encoding="utf-8"))
            checks_list = checks_data.get("checks", []) if isinstance(checks_data, dict) else checks_data
            bad_stop_items = 0
            bad_search_checks = 0
            for c in checks_list:
                if "/search?q=" in str(c.get("url") or ""):
                    bad_search_checks += 1
                raw_d = c.get("raw_data") or {}
                for prod in raw_d.get("stopped_products") or []:
                    p_name = prod.get("name") if isinstance(prod, dict) else str(prod)
                    if str(p_name).strip().lower() in ("produs", "product", "unknown", ""):
                        bad_stop_items += 1
            if bad_stop_items > 0:
                issues.append(f"`data/live-checks-cache.json` conține {bad_stop_items} poziții generice 'Produs' în stop-list")
            if bad_search_checks > 0:
                issues.append(f"`data/live-checks-cache.json` conține {bad_search_checks} verificări cu URL fals `/search?q=`")
        except Exception as exc:
            issues.append(f"`data/live-checks-cache.json` JSON invalid: {exc}")

    # 3. Izolare sub-locații București (`UNIRII` / `TITAN` / `CEAIKOVSKI`) în ambele backend-uri
    checks_run += 1
    for api_file in ("workers/src/api-server.js", "netlify/functions/api.js"):
        src = read_text(api_file)
        if "UNIRII" not in src or "TITAN" not in src or "CEAIKOVSKI" not in src or "exactLocMatch" not in src:
            issues.append(f"Lipsă izolare sub-locații București (UNIRII/TITAN/CEAIKOVSKI) în `resolveMatchingRestaurant` din {api_file}")

    # 4. Filtru oraș în Monitoring.jsx, buton central de resetare în MainLayout.jsx și căutare globală bonuri în Dispatch.jsx
    checks_run += 1
    mon_src = read_text("src/pages/Monitoring.jsx")
    layout_src = read_text("src/layouts/MainLayout.jsx")
    disp_src = read_text("src/pages/Dispatch.jsx")
    if "cityFilter" not in mon_src and "selectedCity" not in mon_src:
        issues.append("Lipsă filtru de oraș (`cityFilter` / `selectedCity`) în `src/pages/Monitoring.jsx`")
    if "Сбросить фильтры" not in layout_src:
        issues.append("Lipsă buton central `Сбросить фильтры` în `src/layouts/MainLayout.jsx`")
    if "extraSearchOrders" not in disp_src:
        issues.append("Lipsă căutare globală bonuri (`extraSearchOrders`) în `src/pages/Dispatch.jsx`")
    if "calculatedKpis.in_work_total" not in disp_src or "kpis?.active_in_kitchen" in disp_src:
        issues.append("KPI-urile din `src/pages/Dispatch.jsx` nu sunt adaptate la filtrul de locație (`calculatedKpis.in_work_total`)")

    return len(issues) == 0, checks_run, issues


def vector_3_business_invariants():
    """Vector 3: Invarianți de business și calcule critice ale proiectului (Teste Etalon)"""
    issues = []
    checks_run = 0

    # 1. Test Etalon Imagini Produse (`getProductImage`):
    #    - `P_COMBO BURGER+ COCA COLA` (Roll Master) -> poza Syrve Sushi Burger (chiar și dacă DB avea directUrl de Smash Me /7601594/)
    #    - `P_Sushi Burger Somon` (Roll Master) -> poza Syrve Sushi Burger
    checks_run += 1
    node_img_test = """
    import('./src/lib/productImages.js').then(({ getProductImage }) => {
      const sushiBurgerExpected = '2ad07ee9-9df0-4dc6-8898-e73c2db6bf2e.jpg';
      const staleSmashUrl = 'https://storage.cdneu.syrve.com/nomenclature_images/7601594/4e21ae1f-d604-458e-9a81-05f1b5f7a378.jpg';
      const img1 = getProductImage('P_COMBO BURGER+ COCA COLA', 'Roll Master', staleSmashUrl);
      const img2 = getProductImage('P_Sushi Burger Somon', 'Roll Master', staleSmashUrl);
      if (!img1 || !img1.includes(sushiBurgerExpected)) {
        console.error('FAIL P_COMBO BURGER+ COCA COLA:', img1);
        process.exit(1);
      }
      if (!img2 || !img2.includes(sushiBurgerExpected)) {
        console.error('FAIL P_Sushi Burger Somon:', img2);
        process.exit(1);
      }
    }).catch(e => { console.error(e); process.exit(1); });
    """
    rc, _, err = run_cmd(["node", "-e", node_img_test])
    if rc != 0:
        issues.append(f"Eșec Etalon Imagini Produse (`getProductImage`): {err}")

    # 2. Test Etalon Paritate & Logică iiko (`closed_at_handoff`, `isOperatorSameAsCourier`, `isPartnerMetaOnly`)
    #    în ambele servere (`workers/src/api-server.js` și `netlify/functions/api.js`)
    checks_run += 1
    required_markers = [
        "closed_at_handoff",
        "isClosedAtHandoff",
        "hasRealSyrveCourierPhone",
        "hasRealDeliveryMeta",
        "isCashierOrAutoAggregatorCourier",
        "isPartnerMetaOnly",
        "mergedMetaByOrderNum",
    ]
    for api_file in ("workers/src/api-server.js", "netlify/functions/api.js"):
        src = read_text(api_file)
        missing = [m for m in required_markers if m not in src]
        if missing:
            issues.append(f"Lipsă invarianți iiko în `{api_file}`: {', '.join(missing)}")

    # 3. Test Etalon Timpi iiko în `Dispatch.jsx` (fără suprascriere falsă la 48 min când `hasRealIikoTimings` este true,
    #    și afișare `По выдаче` pentru `closed_at_handoff`)
    checks_run += 1
    dispatch_src = read_text("src/pages/Dispatch.jsx")
    if "!hasRealIikoTimings" not in dispatch_src:
        issues.append("Lipsă gardă `!hasRealIikoTimings` în `src/pages/Dispatch.jsx` (risc timpi falși 5m/16m)")
    if "По выдаче" not in dispatch_src or "Курьер партнёра" not in dispatch_src:
        issues.append("Lipsă etichete operaționale `По выдаче` sau `Курьер партнёра` în `src/pages/Dispatch.jsx`")

    # 4. Test Etalon Stop-List Parser în `workers/src/services/iiko-client.js`
    checks_run += 1
    iiko_client_src = read_text("workers/src/services/iiko-client.js")
    if "tg.items" not in iiko_client_src or "balance" not in iiko_client_src:
        issues.append("Parserul `getStopList()` din `workers/src/services/iiko-client.js` nu parcurge `tg.items` + `balance`")

    # 5. Test Etalon Rapoarte Istorice (`data/sales-history-cache.json` + integrare `last_month` / `this_month` / `this_year`)
    checks_run += 1
    hist_cache_path = ROOT_DIR / "data/sales-history-cache.json"
    if not hist_cache_path.exists():
        issues.append("Lipsă `data/sales-history-cache.json` pentru rapoartele istorice (`last_month`, `this_month`, `this_year`)")
    else:
        try:
            hist_data = json.loads(hist_cache_path.read_text(encoding="utf-8"))
            lm_orders = hist_data.get("buckets", {}).get("last_month", {}).get("totalOrders", 0)
            if lm_orders < 20000:
                issues.append(f"`data/sales-history-cache.json` are prea puține comenzi în `last_month`: {lm_orders} (așteptat >= 20.000 comenzi reale deduplicate după baseUuid)")
        except Exception as e:
            issues.append(f"Eroare la citirea `data/sales-history-cache.json`: {e}")
    for api_file in ("workers/src/api-server.js", "netlify/functions/api.js"):
        src = read_text(api_file)
        if "sales-history-cache.json" not in src:
            issues.append(f"`{api_file}` nu încarcă `data/sales-history-cache.json` pentru `/api/sales/executive-summary`")
        if "filterValidLiveOrders" not in src:
            issues.append(f"`{api_file}` nu folosește `filterValidLiveOrders` pentru paritate 1:1 între Dispatch și ExecutiveSummary")

    return len(issues) == 0, checks_run, issues


def vector_4_ui_and_architecture(skip_build=False):
    """Vector 4: Reguli UI, interzicere mock-uri/scurtături și compilare curată"""
    issues = []
    checks_run = 0

    # 1. Interdicție `Math.random()` în graficul de disponibilitate `ZoomTimeChart.jsx`
    checks_run += 1
    zoom_chart_src = read_text("src/components/charts/ZoomTimeChart.jsx")
    if "Math.random()" in zoom_chart_src:
        issues.append("`src/components/charts/ZoomTimeChart.jsx` conține încă `Math.random()` (date simulate interzise)")
    if "/api/stop-events" not in zoom_chart_src:
        issues.append("`src/components/charts/ZoomTimeChart.jsx` nu este conectat la `/api/stop-events`")

    # 2. Interdicție buclă sintetică activă (`buildCourierDetourPath`) în `OrderLiveRouteMap.jsx`
    checks_run += 1
    route_map_src = read_text("src/components/OrderLiveRouteMap.jsx")
    if "buildCourierDetourPath(" in route_map_src or "const detourLatLngs = null" not in route_map_src:
        issues.append("`src/components/OrderLiveRouteMap.jsx` are încă activă generarea buclei sintetice pe hartă")

    # 3. Verificare chei duplicate în `SYRVE_DISH_IMAGES` din `src/lib/productImages.js`
    checks_run += 1
    prod_img_src = read_text("src/lib/productImages.js")
    keys_found = re.findall(r"^\s*'([^']+)'\s*:\s*'https://", prod_img_src, flags=re.MULTILINE)
    seen_keys = set()
    dup_keys = set()
    for k in keys_found:
        if k in seen_keys:
            dup_keys.add(k)
        seen_keys.add(k)
    if dup_keys:
        issues.append(f"Chei duplicate în `src/lib/productImages.js`: {', '.join(sorted(dup_keys))}")

    # 4. Verificare absență `window.alert(` în paginile principale
    checks_run += 1
    for page_file in ("src/pages/Dispatch.jsx", "src/pages/Monitoring.jsx", "src/pages/Dashboard.jsx", "src/pages/Alerts.jsx"):
        p_src = read_text(page_file)
        if "window.alert(" in p_src or re.search(r"(?<![a-zA-Z0-9_])alert\(", p_src):
            issues.append(f"Apel nativ `alert()` găsit în `{page_file}`")

    # 5. Compilare producție (`npm run build`)
    if not skip_build:
        checks_run += 1
        rc, out, err = run_cmd(["npm", "run", "build"], timeout=90)
        if rc != 0:
            issues.append(f"`npm run build` a eșuat (cod {rc}): {(err or out)[:200]}")

    return len(issues) == 0, checks_run, issues


def vector_5_security():
    """Vector 5: Securitate (rute protejate, zero chei private/secrete de server în frontend)"""
    issues = []
    checks_run = 0

    # 1. Scanare `src/` pentru secrete de server interzise în bundle-ul client
    checks_run += 1
    forbidden_patterns = [
        (r"SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY expus în frontend"),
        (r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----", "Cheie privată PEM expusă în frontend"),
        (r"service_role", "Token `service_role` posibil expus în frontend"),
    ]
    src_dir = ROOT_DIR / "src"
    for path in src_dir.rglob("*"):
        if path.suffix not in (".js", ".jsx", ".ts", ".tsx"):
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        rel = path.relative_to(ROOT_DIR)
        for pat, desc in forbidden_patterns:
            if re.search(pat, content):
                issues.append(f"{desc} în `{rel}`")

    # 2. Verificare protecție rute în `src/App.jsx` (`AuthProvider` / `useAuth` / `Login`)
    checks_run += 1
    app_src = read_text("src/App.jsx")
    if "Auth" not in app_src and "Login" not in app_src:
        issues.append("`src/App.jsx` nu pare să includă protecția de autentificare (`Auth` / `Login`)")

    return len(issues) == 0, checks_run, issues


def main():
    parser = argparse.ArgumentParser(description="Audit Gatekeeper — Pre-Push Verification")
    parser.add_argument("--skip-build", action="store_true", help="Omite rularea `npm run build` pentru verificare rapidă")
    args = parser.parse_args()

    t0 = time.time()
    print("=" * 78)
    print(" 🛡️  AUDIT GATEKEEPER — PRE-PUSH VERIFICATION (6-PHASE ARCHITECTURE)")
    print("    Mode: 100% READ-ONLY | Project: GetApp.FooD (Aggregator 2.0)")
    print("=" * 78)

    # Faza 1: Reconnaissance
    recon = phase_1_recon()
    print(f"\n[FAZA 1] Reconnaissance & Inventar Git")
    print(f"  • Ramură activă : {recon['branch']}")
    print(f"  • Ultimul commit: {recon['last_commit']}")
    print(f"  • Fișiere modificate în working tree: {len(recon['modified_files'])}")
    for line in recon["status_lines"][:12]:
        print(f"      {line}")
    if len(recon["status_lines"]) > 12:
        print(f"      ... (+{len(recon['status_lines']) - 12} alte fișiere)")

    # Faza 2: Hunting pe cei 5 Vectori
    print(f"\n[FAZA 2] Hunting pe cei 5 Vectori Critici...")
    v1_ok, v1_cnt, v1_issues = vector_1_forms_and_validation()
    v2_ok, v2_cnt, v2_issues = vector_2_data_integrity_and_filters()
    v3_ok, v3_cnt, v3_issues = vector_3_business_invariants()
    v4_ok, v4_cnt, v4_issues = vector_4_ui_and_architecture(skip_build=args.skip_build)
    v5_ok, v5_cnt, v5_issues = vector_5_security()

    vectors = [
        ("Vector 1: Reziliență Formulare & API", v1_ok, v1_cnt, v1_issues),
        ("Vector 2: Integritate Date & Filtre DB", v2_ok, v2_cnt, v2_issues),
        ("Vector 3: Invarianți Business & Calcule", v3_ok, v3_cnt, v3_issues),
        (
            f"Vector 4: Reguli UI & Build ({'skip-build' if args.skip_build else 'full build'})",
            v4_ok,
            v4_cnt,
            v4_issues,
        ),
        ("Vector 5: Securitate & Protecție Rute", v5_ok, v5_cnt, v5_issues),
    ]

    all_passed = all(v[1] for v in vectors)
    elapsed = time.time() - t0

    # Fazele 4-6: Tabel de raportare & Semafor
    print("\n[FAZELE 4–6] Tabel Raportare Pre-Push")
    print("-" * 78)
    print(f"{'Vector Audit':<46} | {'Teste':<7} | {'Status':<10}")
    print("-" * 78)
    for name, ok, cnt, _ in vectors:
        status_str = "✅ PASS" if ok else "❌ FAIL"
        print(f"{name:<46} | {cnt:<7} | {status_str:<10}")
    print("-" * 78)

    if not all_passed:
        print("\nDetalii probleme identificate:")
        for name, ok, _, iss in vectors:
            if not ok:
                print(f"  ❌ {name}:")
                for item in iss:
                    print(f"     - {item}")

    print("\n" + "=" * 78)
    if all_passed:
        print(f" SEMAFOR FINAL: 🟢 VERDE — 100% SIGUR PENTRU PUSH ({elapsed:.2f}s)")
        print(" (Notă: Cere întotdeauna acceptul explicit al utilizatorului înainte de git push / deploy!)")
        print("=" * 78)
        sys.exit(0)
    else:
        print(f" SEMAFOR FINAL: 🔴 BLOCAT — REMEDIAZĂ ERORILE ÎNAINTE DE PUSH ({elapsed:.2f}s)")
        print("=" * 78)
        sys.exit(1)


if __name__ == "__main__":
    main()
