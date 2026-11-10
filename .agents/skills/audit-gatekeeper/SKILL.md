---
name: audit-gatekeeper
description: Sistem automat de verificare Pre-Push în 6 faze (inspirat din cloudflare/security-audit-skill), adaptat pentru arhitectura duală (Workers + Netlify Functions), invarianții Syrve/iiko, formularele, cache-urile DB și regulile UI ale proiectului GetApp.FooD (Aggregator 2.0). Rulează OBLIGATORIU înainte de orice git commit / git push / netlify deploy.
---

# Audit Gatekeeper — Pre-Push Verification System (6-Phase Architecture)

Acest skill definește protocolul obligatoriu de verificare înainte de orice `git commit`, `git push` sau `netlify deploy --prod`. Toate verificările sunt **100% READ-ONLY** pe baza de date și pe fișierele aplicației.

## Când se activează (Obligatoriu)
1. Înainte de a propune sau executa orice `git commit`, `git push` sau `netlify deploy`.
2. După finalizarea oricărui set de modificări în frontend (`src/`), backend (`workers/src/` sau `netlify/functions/api.js`) sau cache-uri (`data/`).
3. La cererea explicită a utilizatorului de a verifica proiectul cap-coadă.

> **REGULĂ CRITICĂ DEEXECUȚIE:** Agentul NU are voie să facă `git push` sau `netlify deploy` fără:
> 1. Verdictul `🟢 VERDE — 100% SIGUR PENTRU PUSH` de la scriptul `.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`.
> 2. **Acceptul explicit al utilizatorului** după prezentarea tabelului de audit.

---

## Arhitectura în 6 Faze

### Faza 1: Reconnaissance & Inventar (`git status -s`, `git diff`)
- Inventariază toate fișierele modificate, adăugate sau șterse (`git status --short`, `git diff --stat`).
- Verifică dacă există modificări externe (ex. Paperclip / altă sesiune) care nu trebuie suprascrise.
- Verifică paritatea arhitecturală: dacă s-a modificat logica din `workers/src/api-server.js`, verifică dacă modificarea corespunzătoare a fost aplicată și în `netlify/functions/api.js` (și invers).

### Faza 2: Hunting pe 5 Vectori Critici

#### Vector 1: Reziliența Formularelor, Rute API și Parsarea Datelor
- **Sintaxă & Referințe Backend:** Verifică cu `node --check` atât `workers/src/api-server.js`, cât și `netlify/functions/api.js` și toate serviciile din `workers/src/services/`.
- **Prevenire `ReferenceError` / `500` în Webhook-uri:** Asigură că funcțiile utilitare critice (`withTimeout`, `fastWithTimeout`, `extractBaseOrderUuid`, `computeOrderGrossAmount`) sunt definite în scopul global al ambelor servere API înainte de a fi apelate în `processIikoOrders()` sau `/api/dispatch/live`.
- **Parsare Numerică Rezilientă:** Inputurile și importurile (CSV/XLSX/formulare/webhook-uri) trebuie să suporte valori goale `""`, `null`, `undefined` și numere cu virgulă (`"12,5"` -> `.replace(',', '.')`) fără a produce `NaN`, `422` sau `500`.

#### Vector 2: Integritatea Datelor, Filtre Multi-Locație și Cache-uri DB
- **Integritate Cache-uri JSON (`data/`):** Verifică validitatea JSON și structura `data/restaurants-cache.json`, `data/live-checks-cache.json`, `data/app-users.json`.
- **Zero URL-uri False `/search?q=`:** Niciun restaurant din cache nu are voie să conțină URL-uri generice de căutare (`/search?q=`) pe `glovo_url`, `wolt_url`, `bolt_url` (care provoacă alerte false de oprire, ex. Tulcea Wolt).
- **Zero Produse Fantomă în Stop-List:** `data/live-checks-cache.json` și `workers/src/services/iiko-client.js` nu trebuie să genereze poziții generice `"Produs"` fără nume real din iiko Front.
- **Izolare Sub-Locații București (`UNIRII` / `TITAN` / `CEAIKOVSKI`):** `resolveMatchingRestaurant()` trebuie să filtreze după `iiko_restaurant_id` și sub-locație înainte de potrivirea generică pe orașul `BUCURESTI`.

#### Vector 3: Invarianți de Business și Calcule Critice (Teste Etalon)
- **Etalon 1 — Timpi și Statusuri Reale iiko (`closed_at_handoff`):**
  - Când `whenSended` și `whenDelivered`/`whenClosed` sunt la diferență `<= 90s` (bon închis la casă la predarea către curierul Bolt/Glovo/Wolt), `isClosedAtHandoff = true` și `delivery_minutes = 0` (fără `18m` sau `20m` inventate).
  - Comenzile cu `hasRealIikoTimings` nu sunt niciodată forțate în `delivered` la 48 min cu timpi sintetici (`5m` așteptare / `16m` livrare).
- **Etalon 2 — Filtrare Casier din Câmpul Curier (`isOperatorSameAsCourier`):**
  - Când `courierInfo.courier` are același ID sau nume ca `operator` (ex. casiera `Cosmina`, `Channtel Reema`) și `isCourierSelectedManually === false`, casiera este exclusă automat din `courier`.
- **Etalon 3 — Clasificare Brand & Imagini Produse (`detectBrandFromItems` & `getProductImage`):**
  - `P_COMBO BURGER+ COCA COLA` și `P_Sushi Burger Somon` -> brand `Roll Master` + imaginea oficială Syrve Sushi Burger (`2ad07ee9-9df0-4dc6-8898-e73c2db6bf2e.jpg`), niciodată burgerul de vită Smash Me.
  - `PW_Soba Vegan Sos Teriyaki.` -> brand `Poki Woki`.
  - `RollMaster Phi♥LOVE♥delphia` -> brand `Roll Master`.
- **Etalon 4 — Calcul Net vs Gross (`computeOrderGrossAmount`):**
  - Suma brută (`gross_amount`) este întotdeauna `>= total_amount` (suma netă după discount).

#### Vector 4: Reguli UI, Arhitectură și Compilare Curată
- **Fără Scurtături sau Mock-uri în UI:**
  - `ZoomTimeChart.jsx` nu are voie să folosească `Math.random()` pentru disponibilitate/opriri.
  - `OrderLiveRouteMap.jsx` nu are voie să adauge bucle sintetice (`detourLatLngs`) peste ruta stradală OSRM.
  - Fără chei duplicate în dicționarele de imagini (`src/lib/productImages.js`).
  - Fără `window.alert(` sau `window.confirm(` blocante în fluxurile principale.
- **Build Production (`npm run build`):** Compilarea Vite trebuie să treacă cu `exit code 0`.

#### Vector 5: Securitate (Auth, IDOR, Secrete Expuse)
- **Zero Secrete de Server în Frontend (`src/`):** Niciun fișier din `src/` nu are voie să conțină `SUPABASE_SERVICE_ROLE_KEY`, chei private Syrve sau parole de administrare hardcodate.
- **Protecție Rute Frontend:** Rutele aplicației din `src/App.jsx` trebuie să fie protejate prin contextul de autentificare (`AuthContext` / `ProtectedRoute`).

### Faza 3: Independent QA Verification (Sub-Agent Review)
- Pentru modificări complexe (care ating mai mult de 3 fișiere sau modifică calcule financiare / sincronizări Syrve), agentul poate invoca sub-agentul `research` (read-only) pentru a verifica independent diff-ul față de cerințele utilizatorului.

### Fazele 4–6: Raportare Standardizată & Semafor Pre-Push
Orice rulare a auditului se încheie cu afișarea tabelului pe cei 5 vectori și Semaforul final:
- `🟢 VERDE — 100% SIGUR PENTRU PUSH` (toți cei 5 vectori au trecut cu `PASS`)
- `🔴 BLOCAT` (cel puțin un vector are `FAIL` — este interzis orice `commit` / `push` / `deploy` până la remediere)

---

## Cum se rulează scriptul automat

### Rulare completă (implicit, include `npm run build`):
```bash
python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py
```

### Rulare rapidă (fără `npm run build`, în timpul dezvoltării):
```bash
python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py --skip-build
```

