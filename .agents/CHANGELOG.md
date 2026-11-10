# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-10 10:53 — Căutare globală bonuri în Dispecerat (Azi + Ieri + fără blocare în filtre) și curățare metadate istorice DB (`#14034`, `#9441`, `#9442`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Căutare globală după nr. bon în `Dispatch.jsx` + `/api/dispatch/live?search=...`:** Când se caută un bon în bara de căutare (ex. `14034`, `#14034`, `9441`, `9442`), căutarea nu mai este blocată de filtrul activ `Azi` / `Ieri` sau de filtrele de oraș/brand/canal/tab — bonul este găsit și afișat imediat indiferent din ce zi face parte.
  2. **Prioritate `meta.city` / `meta.conception` în `resolveMatchingRestaurant`:** Chiar și pentru rândurile vechi salvate în `platform_sales` cu `restaurant_id = BUC CEAIKOVSKI`, sub-locația reală din metadate (`SM BUC UNIRII`) are prioritate și rezolvă `BUC UNIRII (Roll Master)`.
  3. **Eliminare casieri salvați istoric ca falși curieri (`isCashierOrAutoAggregatorCourier`):** Rândurile vechi din `platform_sales` care aveau `Channtel Reema` / `Cosmina` salvate în `m.courier` cu `isManual: false` pe Glovo/Wolt/Bolt sunt filtrate la unificare (`mergedMetaByUuid`).
  4. **Protecție imagini Syrve în `product-matcher.js` și `productImages.js`:** Blocarea oricărei imagini Smash Me (`/7601594/`) pe produse Roll Master / Love Sushi / `P_` (precum `P_COMBO BURGER+ COCA COLA` -> Sushi Burger Somon) și blocarea pozei de sos Teriyaki 25g (`e0d7070d...`) pe preparate Wok/Soba (`PW_Soba Vegan Sos Teriyaki`).
- **Fișiere:** `src/pages/Dispatch.jsx`, `src/hooks/useLiveDispatch.js`, `src/lib/productImages.js`, `workers/src/api-server.js`, `workers/src/services/product-matcher.js`, `netlify/functions/api.js`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (fără commit/push/deploy — așteaptă acceptul utilizatorului după Audit Gatekeeper)
- **Build / Teste:** Verificat live pe `localhost:3002/api/dispatch/live?search=14034`, `9441`, `9442` și rulat `run_prepush_audit.py`.

### 2026-11-10 10:35 — Implementare sistem automat de verificare Pre-Push `audit-gatekeeper` (6 faze, 100% READ-ONLY)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. Crearea [`.agents/skills/audit-gatekeeper/SKILL.md`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/.agents/skills/audit-gatekeeper/SKILL.md) cu arhitectura în 6 faze și cei 5 vectori critici adaptați proiectului.
  2. Crearea scriptului executabil [`.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py) (cu `--skip-build` și `npm run build` complet implicit, 100% READ-ONLY).
  3. Actualizarea [`.agents/AGENTS.md`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/.agents/AGENTS.md) și [`.agents/rules/paperclip-sync.md`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/.agents/rules/paperclip-sync.md) cu obligația rulării `run_prepush_audit.py` și interdicția de `git push` / `netlify deploy` fără verdictul `🟢 VERDE` și fără acceptul explicit al utilizatorului.
- **Fișiere:** `.agents/skills/audit-gatekeeper/SKILL.md`, `.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`, `.agents/AGENTS.md`, `.agents/rules/paperclip-sync.md`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (fără commit/push — așteaptă acceptul utilizatorului)
- **Build / Teste:** `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` -> `23/23 teste PASS` (`0.95s`), Semafor `🟢 VERDE`.

### 2026-11-10 10:29 — Deploy în producție pe `https://getapp.food` (`netlify deploy --prod`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  - Rularea `npx vite build` și `npx netlify-cli deploy --prod` (deploy ID `6af2d5ae842179f1b19822e1`), deoarece repo-ul GitHub nu făcea auto-deploy în Netlify la `git push`.
  - Verificat live pe `https://getapp.food/api/dispatch/live?period=yesterday`: comanda `#14034` afișează `BUC UNIRII (Roll Master)`, poza de Sushi Burger Roll Master, `closed_at_handoff: true` (`По выдаче`), fără `18m` livrare falsă și fără casiera `Channtel Reema` la curier.
- **Fișiere:** `src/lib/productImages.js`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `082518f` (deployed to `https://getapp.food`)
- **Build / Teste:** `vite build` + `netlify deploy --prod` OK; verificat live pe `https://getapp.food`.

### 2026-11-09 23:04 — Potrivire exactă sub-locații București (Unirii / Titan / Ceaikovski) și persistență webhook curier partener
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Mapare exactă pe sub-locații București (`resolveMatchingRestaurant`):** S-a adăugat verificarea după `iiko_restaurant_id` și sub-locația din București (`UNIRII` / `Bucuresti-02`, `TITAN` / `Bucuresti-03`, `CEAIKOVSKI` / `Bucuresti-01`) înainte de potrivirea generică pe orașul `BUCURESTI`, astfel încât comenzile de pe `SM BUC UNIRII` (ex. `#14034`) să nu mai fie atribuite primei locații din București (`BUC CEAIKOVSKI`).
  2. **Persistență webhook curier partener (`wh_YYYY-MM-DD_<ref>`):** Salvarea și unificarea după UUID și numărul comenzii a datelor trimise de partenerul de livrare pentru comenzile `Сайт/Приложение` (`Livrare SM`).
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `src/pages/Dispatch.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `9d00382` + commit sub-locații București
- **Build / Teste:** `npx vite build` OK; verificat pe `#14034` (`SM BUC UNIRII`).

### 2026-11-09 22:08 — Rezolvare integrală a celor 10 puncte semnalate de Igor pe grupul Telegram (verificat local)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Timpi & Statusuri reale iiko (`#9441`, `#9442`):** S-a eliminat suprascrierea artificială la 48 min cu timpi falși (`5m` așteptare / `16m` sau `20m` livrare). Dacă bonul este închis în iiko POS simultan cu predarea către curier (`closed_at_handoff`), se afișează `По выдаче` / `La predare` și `4. Закрыт в кассе (при выдаче)`. Dacă `whenSended` este nul (`—`), comanda rămâne în starea reală din iiko (`Gata / Așteaptă Curier` / `В приготовлении`) și afișează `—` la livrare.
  2. **Date livrare Partener pentru comenzile proprii (`Сайт/Приложение` / `Livrare SM` — `#9441`):** S-a reparat persistența webhook-ului de la partenerii de livrare (Valentin middleware: `curier`, `curier_order_id`, `order_traking_url`, `delivery_fee`, `status`, `whenSended`, `whenDelivered`) prin salvarea unei înregistrări indexate `wh_YYYY-MM-DD_<ref>` în `platform_sales` și unificarea după UUID + numărul comenzii (`mergedMetaByOrderNum`), s-a exclus operatorul de casă (`Cosmina`) din câmpul curier când `operator.id === courier.id`, și s-a actualizat eticheta la `Курьер партнёра` / `Curier Partener`.
  3. **Webhook POS Casierie (`TableOrderUpdate` Timișoara):** S-a definit `const withTimeout = fastWithTimeout` la nivel global în `netlify/functions/api.js` (unde arunca `ReferenceError: withTimeout is not defined` în `processIikoOrders()`).
  4. **Unificare puncte fizice în filtrul `Все Точки`:** Locațiile multi-brand de la aceeași adresă fizică (`BUC UNIRII`, `BUC TITAN`, `BUC CEAIKOVSKI`, `SIBIU`, `CLUJ`) sunt grupate într-o singură opțiune în dropdown.
  5. **Harta Traseului Curierului (`OrderLiveRouteMap.jsx`):** S-a eliminat bucla triunghiulară sintetică (`detourLatLngs`), păstrând exclusiv geometria stradală OSRM și eticheta `Расчетный маршрут (OSRM по улицам)`.
  6. **Filtru Oraș în `Мониторинг` + Buton Central `Сбросить фильтры`:** S-a adăugat butonul global `Сбросить фильтры` / `Reset filtre` în bara de sus (`MainLayout.jsx`), selector de oraș în `Monitoring.jsx` și sincronizare completă cu `useSearchParams`.
  7. **Stop-List iiko (`Produs`):** S-a reparat `getStopList()` în `workers/src/services/iiko-client.js` (parcurgerea `tg.items[]` cu `balance <= 0`) și s-au filtrat intrările fără nume din cache și din `Monitoring.jsx`.
  8. **Graficul `Динамика доступности и аптайма` (`ZoomTimeChart.jsx`):** S-a înlocuit `Math.random()` cu date reale din `checks` și `/api/stop-events`, cu afișarea numelor locațiilor oprite în tooltip și buton direct `Журнал остановок` -> `/alerts`.
  9. **Poză `P_COMBO BURGER+ COCA COLA` (Roll Master):** S-a mapat la imaginea oficială Syrve a Sushi Burger-ului Roll Master în `src/lib/productImages.js` și `workers/src/services/product-matcher.js`.
  10. **Eliminare URL-uri false `/search?q=` (Tulcea Wolt etc.):** S-au curățat cele 17 URL-uri de căutare din Supabase `restaurants`, `data/restaurants-cache.json` și `data/live-checks-cache.json`, iar canalele neconfigurate sunt marcate cu `Нет канала` / `Fără canal` fără alerte false.
- **Fișiere:** `netlify/functions/api.js`, `workers/src/api-server.js`, `workers/src/services/iiko-client.js`, `workers/src/services/product-matcher.js`, `src/lib/productImages.js`, `src/pages/Dispatch.jsx`, `src/pages/Monitoring.jsx`, `src/pages/Alerts.jsx`, `src/pages/Dashboard.jsx`, `src/layouts/MainLayout.jsx`, `src/components/OrderLiveRouteMap.jsx`, `src/components/charts/ZoomChartsSuite.jsx`, `src/components/charts/ZoomTimeChart.jsx`, `data/restaurants-cache.json`, `data/live-checks-cache.json`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` / `0b62e02` (pushed to `origin/main`)
- **Build / Teste:** `npx vite build` trecut fără erori (661ms); suita automată de verificare API + Syrve + Puppeteer UI: `10/10 PUNCTE TRECUTE`.

### 2026-11-09 15:43 — Inițializare sincronizare continuă Antigravity ↔ Paperclip
- **Autor:** Antigravity
- **Ce s-a făcut:** Crearea fișierelor de reguli `.agents/rules/paperclip-sync.md`, `.agents/AGENTS.md` și inițializarea `.agents/CHANGELOG.md` cu starea curentă a depozitului Git (ultimul commit: `caeb629 fix(sales): sync POS table orders, show net and gross sales, map Poki-Woki Constanta org`).
- **Fișiere:**
  - `.agents/rules/paperclip-sync.md` (nou)
  - `.agents/AGENTS.md` (actualizat)
  - `.agents/CHANGELOG.md` (nou)
  - Stare curentă `git status --short`: `M data/app-users.json`, `M data/customers-cache.json`, `M data/live-checks-cache.json`, `M data/reviews-cache.json`, `M data/stop-events-cache.json`, `M data/violations-cache.json`, `M index.html`, `M src/components/AppLogo.jsx`, `M src/components/OrderLiveRouteMap.jsx`, `M src/components/UserAvatar.jsx`, `M src/components/WebhookIntegrationModal.jsx`, `M src/index.css`, `M src/layouts/MainLayout.jsx`, `M src/lib/AuthContext.jsx`, `M src/lib/orderUtils.js`, `M src/pages/CouriersMap.jsx`, `M src/pages/Customers.jsx`, `M src/pages/Login.jsx`, `M src/pages/UsersManagement.jsx`, `M workers/src/services/users-service.js`, `?? public/logo-radar.png`, `?? public/logo-radar.svg`
- **Ramură / Commit:** `main` / `caeb629` (`fix(sales): sync POS table orders, show net and gross sales, map Poki-Woki Constanta org`)
- **Build / Teste:** Build de producție verificat (`vite build` OK) și sincronizat cu `https://getapp.food`.

