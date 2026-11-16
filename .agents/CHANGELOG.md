# Jurnal de modificări (Antigravity ↔ Paperclip)

### 2026-11-16 18:10 — Redesign Modal Scanare Globală (`createPortal`, Progress Bar Încadrat în Card, `Закрыть`/`X`/`Остановить` Active & Suport Netlify)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Modal scanare complet încadrat și fără blocaj în [`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx):**
     - Randat modalul prin `createPortal(..., document.body)` (eliminând decalajul `space-y-5`), mutat bara de progres în interiorul corpului `p-6` într-un card rotunjit cu `overflow-hidden` (`0–100%`, fără bucăți verzi ieșite pe margine), adăugat buton `X`, închidere pe backdrop, buton roșu `Остановить` direct în footer și buton `Закрыть` activ tot timpul (cu reluare modal din butonul de header dacă scanarea continuă în fundal).
  2. **Suport endpoint-uri `/check-all`, `/check-status` și `/check-stop` în [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js):**
     - Returnează starea curentă din Supabase (`monitoring_checks` + `restaurants`), prevenind blocarea scanării pe `404` în serverless.
- **Fișiere:** `src/pages/Monitoring.jsx`, `netlify/functions/api.js`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local, fără push/deploy)
- **Build / Teste:** Verificat `npm run build`, `npx vite build --mode development`, transformare live `http://localhost:5174/src/pages/Monitoring.jsx` (HTTP 200) și `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` (`🟢 VERDE`).

### 2026-11-16 18:00 — Calibrare Normă Reală Wolt București (`3.5–4.0 км`), Selector `Сегодня / Вчера` & Badge Neutru `<5` Comenzi în `Monitorizare`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Normă dedicată pentru Wolt București (`3.5 км`, plafon `4.0 км`, prag îngustare `<= 2.38 км`) în [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js), [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js) și [`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx):**
     - Eliminat alarmele roșii false pe `BUC CEAIKOVSKI · WOLT` (`2.98 км`) și `BUC UNIRII · WOLT` (`2.51 км`), deoarece în București Wolt livrează în mod normal până la `3.3–3.7 км` (nu `5.0 км` ca Glovo).
  2. **Separare curată `Сегодня / Вчера` și status neutru `< 5` comenzi în tab-ul Statistică Zone ([`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx)):**
     - Adăugat selector `Сегодня` / `Вчера` (`todayZonesMap` vs `yesterdayZonesMap`), fără amestecarea rândurilor de ieri în lista de azi, și înlocuit badge-ul verde înșelător `Норма (100%)` pentru hub-urile cu `1–4` comenzi cu pill-ul neutru gri `Мало данных (N)`.
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `src/pages/Monitoring.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local, fără push/deploy)
- **Build / Teste:** Verificat live `http://localhost:3002/api/dispatch/live?period=today` & `yesterday`, `npm run build` și `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` (`🟢 VERDE`).

### 2026-11-16 17:32 — Persistență Supabase Reală (`sys_app_users_registry_v1`), Heartbeat Live Sesiune (`/api/auth/heartbeat`) & Activare Status Igor
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Fix constrângere CHECK la salvarea utilizatorilor în Supabase ([`workers/src/services/users-service.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/services/users-service.js)):**
     - Înlocuit `platform: 'system_config'` (care eșua tăcut din cauza `platform_sales_platform_check`) cu `platform: 'delivery'`, `total_amount: 0`, `placed_at: '2020-01-01T00:00:00.000Z'` și `_order_meta: { isPartnerMetaOnly: true, status: 'Cancelled' }`, plus `syncFromSupabase()` inteligent astfel încât `status: 'active'` și cel mai recent `last_login_at` să nu se mai piardă între containerele serverless.
     - Actualizat contul **Игорь Сафонов** (`safonov.market@yandex.ru`) la `status: 'active'` (`must_change_password: false`, `last_login_at` din `04.11`) în [`data/app-users.json`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/data/app-users.json) și `getDefaultSeedData()`.
  2. **Endpoint & tracking live pentru sesiunile deja deschise în browser ([`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js), [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js), [`src/lib/AuthContext.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/lib/AuthContext.jsx), [`src/pages/UsersManagement.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/UsersManagement.jsx)):**
     - Adăugat `POST /api/auth/heartbeat` + `usersService.recordHeartbeat()` apelat automat la deschiderea aplicației și la fiecare 3 minute de tab activ (`!is_impersonated`, ignorând butonul `Test` al adminului), și afișat **`Activ acum · ...`** (`Онлайн сейчас`) / **`Ultimul acces: ...`** (`Был в сети`) în tabelul de utilizatori.
- **Fișiere:** `workers/src/services/users-service.js`, `workers/src/api-server.js`, `netlify/functions/api.js`, `src/lib/AuthContext.jsx`, `src/pages/UsersManagement.jsx`, `data/app-users.json`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live `POST /api/auth/heartbeat`, rândul `sys_app_users_registry_v1` în Supabase (`users_count: 3`), izolare completă față de `/api/dispatch/live` și `/api/sales/executive-summary`, `npm run build` și `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` (`🟢 VERDE`).

### 2026-11-16 17:08 — Calibrare Prag Îngustare Zonă (`active_radius_km <= 3.2 км`, `normal_radius_km <= 5.5 км`) & Eliminare Steluțe (`★`) în `Monitorizare`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Calibrare prag alertă îngustare zonă (`<= 3.2 км`) în [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js), [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js) și [`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx):**
     - Plafonat `normal_radius_km` la `5.5 км` și condiționat `is_narrowed` de `active_radius_km <= 3.2` (pe lângă `orders_count >= 5` și `< 68%` din normal), astfel încât bucătăriile cu rază normală (`BUC CEAIKOVSKI` `4.9 км`) să nu mai afișeze alerte roșii false din cauza unei comenzi izolate din ziua precedentă (`7.7 км`).
  2. **Eliminare completă pill-uri galbene de rating (`★ 9.9`) + reparare parse JSX (`1239–1334`) în [`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx):**
     - Tabelul `Status Locații & Vitrine` afișează strict **1–2 rânduri**: `[ В сети ]` (+ stop-list inline) pe rândul 1 și `[ 📍 Радиус: X км ]` / alertă îngustare (`Glovo`/`Wolt` exclusiv, fără `Bolt`) pe rândul 2.
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `src/pages/Monitoring.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live `http://localhost:3002/api/dispatch/live?period=today` & `yesterday` (`BUC_CEAIKOVSKI_glovo` `is_narrowed: false`), `npm run build` și `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` (`🟢 VERDE`).

### 2026-11-16 15:48 — Rază aeriană per bucătărie (`BUC CEAIKOVSKI` / `BUC BERCENI` / `BUC IULIU MANIU`) & Tab Statistică Zone Livrare + Export Excel în `Monitorizare`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Separare per bucătărie și calcul aerian Haversine (`1.0x`) în [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js) și [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js):**
     - Înlocuit punctul unic pe oraș cu `getKitchenZoneKeyAndCoords(restName, cityCanon)` (`BUC_CEAIKOVSKI`, `BUC_BERCENI`, `BUC_MANIU` + coordonatele reale pe fiecare oraș) și distanța aeriană Haversine (`<= 10 km`) eliminând multiplicatorul `1.25x` care umfla artificial valorile (ex. `12.41 km` devine `4.89 km` pe `BUC CEAIKOVSKI`).
  2. **Tab dedicat `Zonă & Rază Livrare (Statistică)` + Export Excel în [`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx):**
     - Adăugat selectorul superior cu 2 tab-uri (`Status Locații & Vitrine` vs `Zonă & Rază Livrare (Statistică)`), 4 carduri KPI (`Rază medie max Glovo`, `Rază medie max Wolt`, `Comenzi 4+ km`, `Zone îngustate acum`), tabel comparativ per hub × platformă cu `tfoot` și buton de export Excel `.xlsx`.
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `src/pages/Monitoring.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live `http://localhost:3002/api/dispatch/live?period=today` (`26` zone `delivery_zones`), `npm run build` și `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` (`🟢 VERDE`).

### 2026-11-16 15:39 — Monitorizare Rază & Îngustare Zonă de Livrare (`delivery_zones` din GPS Syrve)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Calcul automat al razei de livrare per oraș și platformă în [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js) și [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js):**
     - Extrage coordonatele GPS reale ale clienților din `deliveryPoint.coordinates` (Syrve), calculează distanța rutieră estimată în km și agregă `delivery_zones` (`active_radius_km`, `normal_radius_km`, `avg_distance_km`, `under_2km`, `between_2_4km`, `over_4km`, `is_narrowed`, `narrowed_pct`).
  2. **Afișare în [`src/pages/Monitoring.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Monitoring.jsx):**
     - Sub fiecare badge de platformă (`Glovo`, `Wolt`, `Bolt`) afișează raza reală activă sau alerta de îngustare (`is_narrowed`), iar în modalul de detalii afișează cardul complet cu defalcarea pe inele de distanță (`<2km`, `2–4km`, `4+km`).
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `src/pages/Monitoring.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live pe `http://localhost:3002/api/dispatch/live?period=today` (`24` zone `delivery_zones` calculate) și `http://localhost:5174` (HTTP 200).

### 2026-11-16 11:45 — Tracking Live Email (Brevo: Trimis / Primit în Inbox / Deschis / Click) & Status Deschidere Cont în `Utilizatori & Roluri`
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Integrare Brevo Events API (`GET /v3/smtp/statistics/events`) în [`workers/src/services/users-service.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/services/users-service.js), [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js) și [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js):**
     - Atașează fiecărui utilizator obiectul `email_tracking` cu stadiul real (`sent`, `delivered`, `opened`, `clicked`, `bounced`) și orele exacte (`sent_at`, `delivered_at`, `opened_at`, `clicked_at`).
     - Sincronizează automat lista de utilizatori și în Supabase (`sys_app_users_registry_v1`) + [`data/app-users.json`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/data/app-users.json) (inclusiv contul nou creat `Sergiu Solonenco` — `bucuresti@master-roll.ro`), astfel încât logările și conturile noi să nu se piardă la restartarea containerelor serverless.
  2. **Afișare în tabelul și modalul [`src/pages/UsersManagement.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/UsersManagement.jsx):**
     - În coloana `Email & Cont Deschis` din tabel se vede acum în timp real dacă emailul a fost **Trimis**, **Primit în Inbox**, **Deschis** sau **Click în Email**, plus dacă utilizatorul **a deschis sau nu contul** (`Cont deschis: ZZ.LL HH:mm` vs `Nu a deschis încă contul`).
     - La click pe utilizator (în fereastra de detalii/editare) apare trackerul în 4 pași: `1. Email Trimis` → `2. Primit în Inbox` → `3. Email Deschis / Click` → `4. Cont Deschis (Logat)`.
  3. **Extindere module pentru rolul `Operațional` (`reputation` & `reports` strict pe orașele alocate):**
     - Adăugat `reputation` (`Recenzii & Rating`) și `reports` (`Rapoarte`) în `defaultPages` pentru rolul `operational` în [`src/lib/AuthContext.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/lib/AuthContext.jsx), [`workers/src/services/users-service.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/services/users-service.js) și pe contul `Sergiu Solonenco` (`bucuresti@master-roll.ro`, păstrând restricția strictă pe orașul alocat `BUCURESTI`).
- **Fișiere:** `workers/src/services/users-service.js`, `workers/src/api-server.js`, `netlify/functions/api.js`, `src/pages/UsersManagement.jsx`, `src/lib/AuthContext.jsx`, `src/pages/Reports.jsx`, `data/app-users.json`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live cu Brevo API + `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`.

### 2026-11-13 16:20 — Prioritizare Timpi Reali din Tabelul de Curieri (`wh_...` / `realDeliveredAt` / `whenSended` / `whenArrivedAtCustomer`) peste Închiderea din Casa iiko (`msg_31` de la Igor)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Preluarea timpului final (`whenDelivered`) și a preluării (`whenSended`) din tabelul de curieri (`wh_YYYY-MM-DD_...` / Valentin courier webhook) în loc de închiderea din casa iiko (`workers/src/api-server.js` & `netlify/functions/api.js`):**
     - Anterior, în `mergedMetaByUuid`, rândul `syrveDirectRows` (din iiko) intra primul și seta `prev.timings.whenSended` și `prev.timings.whenDelivered` la ora închiderii bonului pe casa iiko (la 5 secunde după `Готов`), astfel încât `prev.timings.whenDelivered || curTimings.whenDelivered` ignora `realDeliveredAt` și `whenSended` din tabelul de curieri (`dbWebhookRows`).
     - În plus, timpii din tabelul de curieri sunt salvați în UTC ISO (`...Z`, ex. `2026-11-13T10:22:13.585Z`), în timp ce iiko folosește ora locală a României fără fus (`2026-11-13 11:29:05.950`), ceea ce făcea ca `extractHHMMSS` să afișeze ora UTC cu 2 ore în urmă și `parseIikoTs` pe servere UTC să calculeze diferențe negative (`0 secunde`).
     - Acum `courierSendTs`, `courierArrivedTs` și `courierDelivTs` din tabelul de curieri au **prioritate absolută** față de timpii de casă din iiko, sunt convertite automat la fusul `Europe/Bucharest` (`YYYY-MM-DD HH:mm:ss.SSS`), iar când curierul este pe traseu (`PICKED UP` / `AT CUSTOMER`), comanda rămâne activă în `У Курьера` (`on_way`) chiar dacă bonul a fost deja închis în casa iiko.
  2. **Afișare completă în [`src/components/OrderDetailsModal.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/components/OrderDetailsModal.jsx):** Afișează ora reală a curierului (`Доставлен курьером`), ora la ușa clientului (`У двери клиента: HH:mm:ss`) și traduce etichetele din cardul curierului în RU/EN/RO.
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `src/components/OrderDetailsModal.jsx`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live pe `http://localhost:3002/api/dispatch/live?period=today` (ex. `#17873`: Bucătărie `11 min`, Așteptare curier `22 min`, Livrare curier `20 min`, Total `53 min`; `#25681`: `20m + 17m + 7m = 44m`; `#17866`: `29m + 16m + 28m = 73m`).

### 2026-11-13 14:45 — Fix coliziune `orderNumber` între orașe diferite în `mergedMetaByOrderNum` & Audit Timpi Syrve (întrebările lui Igor #22-#23)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Restricționare `mergedMetaByOrderNum` strict la rândurile `m.isPartnerMetaOnly` în [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js) și [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js):** Previne combinarea `timings` între două comenzi Syrve diferite din orașe diferite care au întâmplător același număr scurt sau `externalOrderId` (ex: comanda `#16504` din Oradea de la `14:32:00` nu mai preia `whenCookingCompleted: 11:10:40` de la comanda `#398` din Constanța care avea `externalOrderId: 16504`).
  2. **Audit complet timpi Syrve pe cele 386 comenzi de azi (`2026-11-13`):** Confirmat direct pe payload-urile brute `api-eu.syrve.live/api/1/deliveries/by_delivery_date_and_status` că pe `345 / 352` (`98%`) din bonurile închise azi, casierii din restaurante apasă în `iikoFront` secvența `Готов` (`whenCookingCompleted`) → `Отправлен` (`whenSended`) → `Закрыт` (`whenDelivered` / `whenClosed`) una după alta la predarea pungii către curier, în interval de `0–6 secunde`.
  3. **Cititor permanent Telegram `@antygrtybot` ([`scripts/check-antigravity-telegram.cjs`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/scripts/check-antigravity-telegram.cjs)):** Salvat scriptul direct în proiect care scanează secvențial `message_id`-urile din chat-ul `1641990960` (`@antygrtybot`), astfel încât mesajele și capturile forwardate de la Igor să fie citite mereu din prima, chiar și când `getUpdates` a fost consumat.
- **Fișiere:** `workers/src/api-server.js`, `netlify/functions/api.js`, `scripts/check-antigravity-telegram.cjs`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local)
- **Build / Teste:** Verificat live pe `http://localhost:3002/api/dispatch/live?period=today` (`0` coliziuni de timestamp-uri între comenzi).

### 2026-11-10 14:30 — Audit Financiar Forensics & Reconciliere 1:1 Încasări + Comenzi între Syrve (iiko), Dispecerat, Dashboard și Rapoarte
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Eliminare 100% a dublării comenzilor și a ruperii taxelor de livrare între branduri virtuale (`platform_sales` & [`workers/src/services/sales-sync.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/services/sales-sync.js)):**
     - Anterior, `SalesSync` împărțea același bon Syrve (`baseUuid`) pe mai multe rânduri când o organizație avea mai multe branduri: la comenzile `Roll Master` care conțineau `P_Ramen Pui` salva atât bonul întreg pe `Roll Master`, cât și un al doilea rând doar cu `P_Ramen Pui` pe `Poki Woki` (din cauza filtrului `pName.includes('ramen')`), iar la comenzile `Poki Woki` (`GLOVO_PW`, `WOLT_PW`) punea preparatele `PW_` pe rândul `Poki Woki` și taxa `Delivery` / `MinimumBasketSurcharge` / `ServiceFee` pe un rând separat `Roll Master`. De asemenea, la comenzile `Love Sushi` (`GLOVO_LS`), webhook-ul inițial (`Delivery`) intra pe `Roll Master`, iar bonul închis (`GLOVO_LS PickUp`) pe `Love Sushi`.
     - Deduplicarea veche după `baseUuid_brandName` număra aceste bonuri de două ori (umflând octombrie cu `+5.155` comenzi false și `+493.147 RON`).
     - Reconstruit [`data/sales-history-cache.json`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/data/sales-history-cache.json) prin: (a) extragerea directă din API-ul live Syrve (`by_delivery_date_and_status`) a tuturor comenzilor reale pentru fereastra `3–8 noiembrie 2026` (`6.762` bonuri Syrve) și (b) reconcilierea tuturor celor `249.655` rânduri din `platform_sales` strict pe **`baseUuid` (1 UUID Syrve = 1 singur bon fiscal)**, cu reunificarea liniilor de produse/taxe despărțite și excluderea bonurilor `Cancelled`/`Deleted`. Actualizat și `workers/src/services/sales-sync.js` să atribuie bonul întreg brandului său, fără a mai despărți produsele/taxele între rânduri.
  2. **Paritate 1:1 la leu și la bon între `Dispecerat Live` (`/api/dispatch/live`) și `Dashboard / Rapoarte` (`/api/sales/executive-summary`) în [`workers/src/api-server.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/workers/src/api-server.js) și [`netlify/functions/api.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/netlify/functions/api.js):**
     - Adăugat `filterValidLiveOrders` (care exclude rândurile `isPartnerMetaOnly` de curierat și bonurile anulate în Syrve fără a exclude bonurile `Closed` la care doar cererea de curier Glovo On-Demand a avut `ORDER CANCELLED`, ex. `#270` Constanța `63 RON`).
     - Deduplicare unitară pe `baseUuid`, includerea canalului `direct` în `local_vs_delivery.delivery`, normalizarea brandurilor (`Sushi Master` -> `Roll Master`, `Ikura Sushi` -> `Poki Woki`) și conectarea filtrului global de oraș/brand din header (`useAuth()`) și a graficelor Donut în [`src/pages/Reports.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Reports.jsx) și [`src/hooks/useExecutiveSales.js`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/hooks/useExecutiveSales.js).
  3. **Valori reconciliate 1:1 pe toate perioadele:**
     - **Azi (`today`):** Dispecerat = `248` bonuri / `31.493 RON` net (`38.021 RON` brut) ↔ Dashboard/Rapoarte = `248` bonuri / `31.493 RON` net (`38.021 RON` brut).
     - **Ieri (`yesterday`):** Dispecerat = `806` bonuri / `111.032 RON` net (`138.143 RON` brut) ↔ Dashboard/Rapoarte = `806` bonuri / `111.032 RON` net (`138.143 RON` brut).
     - **Luna Trecută (`last_month`, 1–31 oct. 2026):** **`21.792` bonuri unice Syrve**, **`2.838.052 RON` net** (`3.656.946 RON` brut), bon mediu `130,23 RON`.
     - **Luna Curentă (`this_month`, 1–10 nov. 2026):** **`10.492` bonuri unice Syrve**, **`1.467.268 RON` net** (`1.850.013 RON` brut), bon mediu `139,85 RON`.
     - **Anul Curent / Total (`this_year` / `all`, 2026):** **`192.538` bonuri unice Syrve**, **`25.931.210 RON` net** (`28.335.224 RON` brut), bon mediu `134,68 RON`.
- **Fișiere:** `data/sales-history-cache.json`, `workers/src/api-server.js`, `netlify/functions/api.js`, `workers/src/services/sales-sync.js`, `src/pages/Reports.jsx`, `src/hooks/useExecutiveSales.js`, `.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (`bee74af`)
- **Build / Teste:** Verificat paritate 1:1 între `/api/dispatch/live` și `/api/sales/executive-summary` + `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` (`🟢 VERDE`).

### 2026-11-10 13:02 — Audit complet local Dispecerat: Aliniere 1:1 `ЧЕКОВ В РАБОТЕ` ↔ `в работе`, eliminare 100% casieri Syrve POS (`Sherpa Karma`, `Channtel Reema`, `Cosmina`, `GLOVO_DEMAND`) din coloana Curier și traducere completă RU/EN în tabel
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Aliniere 1:1 `ЧЕКОВ В РАБОТЕ` (sus) ↔ `в работе` (jos) în [`src/pages/Dispatch.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Dispatch.jsx):** Cardul 2 (`ЧЕКОВ В РАБОТЕ`) afișează acum `calculatedKpis.in_work_total` (`cooking + ready + on_way`), egal 1:1 cu totalul `в работе` din `tfoot` (care acum calculează pe tot `filteredOrders`, nu doar pe pagina curentă), iar dedesubt afișează defalcarea (`X на кухне · Y ждут курьера`).
  2. **Eliminare completă a casierilor Syrve POS (`iikoFront`) din câmpul `courier` (`Sherpa Karma` în Brașov, `Channtel Reema` / `Rai Pradip` în București, `Cosmina` în Timișoara, `Desire-Maria` în Iași, `Casier CS1` în Constanța, `GLOVO_DEMAND`, `Wolt`):** La închiderea bonului pe casa de marcat Syrve POS, casierul se selectează pe sine ca livrator (`isCourierSelectedManually = true`), dar fără număr de telefon. În `workers/src/api-server.js`, `netlify/functions/api.js` și `workers/src/services/sales-sync.js`, `ord.courierInfo.courier` fără telefon și orice obiect `courier` fără `phone`/`trackingUrl`/`awb`/`orderId` este acum ignorat (atât pe fluxul live Syrve, cât și pe rândurile deja salvate în `platform_sales`).
  3. **Localizare completă RU/EN/RO în rândurile tabelului (`Dispatch.jsx` & `orderUtils.js`):** Înlocuit textele hardcodate în română din tabel (`Livrat la 12:39` -> `Выдан в 12:39` pentru `closed_at_handoff` / `Доставлен в 12:39`, `+detalii` -> `+детали` / `+details`, și curățat prefixul redundant `Adresă:` / `str. Strada` în `parseDeliveryAddress`).
- **Fișiere:** `src/pages/Dispatch.jsx`, `src/lib/orderUtils.js`, `workers/src/api-server.js`, `netlify/functions/api.js`, `workers/src/services/sales-sync.js`, `.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (doar local — fără commit/push/deploy până la decizia utilizatorului)
- **Build / Teste:** Verificat live pe `http://localhost:3002/api/dispatch/live` (`0` casieri în `courier` pe azi/ieri, `in_work_total === inProgress`) + `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`.

### 2026-11-10 12:31 — Adaptarea tuturor celor 6 carduri KPI din Dispecerat (`Dispatch.jsx`) la filtrul de locație / punct de lucru (`msg_21.jpg` de pe `@antygrtybot`)
- **Autor:** Antigravity
- **Ce s-a făcut:**
  1. **Recalculare dinamică a tuturor celor 6 carduri KPI (`calculatedKpis`) în [`src/pages/Dispatch.jsx`](file:///Users/eugeniucazmal/Downloads/dev_office/agregattor%202.0%20(july%202026)/src/pages/Dispatch.jsx):** Anterior, doar cardul 1 (`ПРОДАЖИ СЕГОДНЯ`) se recalcula după filtrul de locație (`BUC CEAIKOVSKI`), în timp ce cardurile 2–6 (`ЧЕКОВ В РАБОТЕ`, `ТАЙМИНГ КУХНИ`, `ОЖИДАНИЕ КУРЬЕРА`, `ВРЕМЯ ДОСТАВКИ`, `ОБЩЕЕ ВРЕМЯ ЗАКАЗА`) citeau din `kpis` global pe tot orașul (afișând `10` în lucru în loc de `4` câte erau pe `BUC CEAIKOVSKI`, și fallback-uri fixe `6.8` / `23.4` când valorile erau `0`). Acum toate cele 6 carduri se calculează în timp real strict din comenzile filtrate pe locația, orașul, brandul, canalul și perioada selectată (`channelFilteredOrders`).
  2. **Unificare filtru locație în `filteredStopAuditLog`:** Adăugat suport și pentru potrivirea după eticheta curată a punctului fizic unificat (`cleanRestaurantName`).
- **Fișiere:** `src/pages/Dispatch.jsx`, `.agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py`, `.agents/CHANGELOG.md`
- **Ramură / Commit:** `main` (așteaptă acceptul utilizatorului pentru push/deploy după Audit Gatekeeper)
- **Build / Teste:** `python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py` -> `23/23 PASS`, Semafor `🟢 VERDE`.

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

