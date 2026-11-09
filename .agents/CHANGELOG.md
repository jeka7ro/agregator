# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-09 22:08 — Rezolvare integrală a celor 10 puncte semnalate de Igor pe grupul Telegram (verificat local)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Timpi & Statusuri reale iiko (`#9441`, `#9442`):** S-a eliminat suprascrierea artificială la 48 min cu timpi falși (`5m` așteptare / `16m` sau `20m` livrare). Dacă bonul este închis în iiko POS simultan cu predarea către curier (`closed_at_handoff`), se afișează `По выдаче` / `La predare` și `4. Закрыт в кассе (при выдаче)`. Dacă `whenSended` este nul (`—`), comanda rămâne în starea reală din iiko (`Gata / Așteaptă Curier` / `В приготовлении`) și afișează `—` la livrare.
  2. **Etichetă Curier Livrare Proprie (`Livrare SM`):** Comenzile cu `channel_type === 'own_delivery'` afișează acum `Собственный курьер` / `Curier Propriu` în loc de `Курьер Агрегатора`.
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

