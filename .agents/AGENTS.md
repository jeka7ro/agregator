---
trigger: always_on
---
# Sincronizare continuă Antigravity ↔ Paperclip

Acest proiect este lucrat atât din Antigravity (pe Mac), cât și de la distanță prin Paperclip.

## La începutul fiecărei sesiuni (obligatoriu)
1. Citește `.agents/CHANGELOG.md` (ultimele 10 intrări).
2. Rulează `git status --short` și `git log -5 --oneline`.
3. Dacă există modificări făcute de un agent Paperclip sau commit-uri noi de la ultima ta intrare, rezumă-le utilizatorului în 2–3 rânduri înainte să faci orice altceva.
4. Nu suprascrie și nu șterge modificări făcute din Paperclip fără să întrebi utilizatorul.

## După fiecare modificare aplicată în Antigravity (obligatoriu)
Adaugă o intrare nouă DEASUPRA celor existente în `.agents/CHANGELOG.md` în formatul:
### YYYY-MM-DD HH:MM — <titlu scurt>
- **Autor:** Antigravity
- **Ce s-a făcut:** <descriere scurtă>
- **Fișiere:** <lista fișierelor modificate>
- **Ramură / Commit:** <numele ramurii și hash-ul, dacă s-a făcut commit>
- **Build / Teste:** <rezultat>

## Înainte de orice `git commit` / `git push` / `netlify deploy` (OBLIGATORIU — Audit Gatekeeper)
1. Rulează obligatoriu scriptul de verificare Pre-Push:
   ```bash
   python3 .agents/skills/audit-gatekeeper/scripts/run_prepush_audit.py
   ```
2. Dacă verdictul este `🔴 BLOCAT`, este **STRICT INTERZIS** să faci `git commit`, `git push` sau `netlify deploy` până când toate erorile nu sunt remediate.
3. Chiar și când verdictul este `🟢 VERDE — 100% SIGUR PENTRU PUSH`, **prezintă tabelul de audit utilizatorului și cere permisiunea explicită** înainte de a executa `git push` sau `netlify deploy`. Nu rula niciodată `git push` sau `netlify deploy` fără acceptul explicit al utilizatorului!

## Citirea mesajelor de pe Telegram / de la Igor (OBLIGATORIU — `@antygrtybot`)
Când utilizatorul scrie chiar și un singur cuvânt precum **`telegram`**, **`telgram`**, **`tg`** (sau spune să verifici mesajele pe Telegram / grup / de la Igor):
1. **NU** căuta în `.env` (`@GetAppAlertBot`) și **NU** te baza doar pe `getUpdates`.
2. Rulează **IMEDIAT** comanda:
   ```bash
   node scripts/check-antigravity-telegram.cjs
   ```
3. Acest script citește direct după `message_id` din chat-ul `Antigravity bot` (`@antygrtybot`, `chat_id: 1641990960`) unde utilizatorul dă forward la mesajele și capturile lui Igor, și salvează eventualele poze în `data/telegram_inbox/msg_<id>.jpg`. Citește pozele nou descărcate cu `read_file` și rezolvă / răspunde direct la ce este în ultimele mesaje!

## Reguli de Inginerie Karpathy (OBLIGATORIU — `.agents/rules/karpathy-guidelines.md`)
Aplică cele 4 principii din skill-ul `.agents/skills/karpathy-guidelines/SKILL.md` la fiecare modificare:
1. **Think Before Coding:** enunță explicit ipotezele, nu ghici pe ascuns, întreabă când e ambiguu, semnalează soluții mai simple.
2. **Simplicity First:** cod minim care rezolvă exact cererea — zero abstracții speculative sau feature-uri necerute.
3. **Surgical Changes:** atinge strict fișierele și liniile cerute; nu reforma/refactoriza cod adiacent și nu atinge fișiere nelegate din working tree.
4. **Goal-Driven Execution:** definește criterii verificabile concrete (inclusiv testare pe rolul/scope-ul exact afectat: ex. manager pe un oraș + admin) și verifică E2E înainte să declari finalizat.

## Reguli UI/UX Apple Design & HIG (OBLIGATORIU — `.agents/rules/apple-design-guidelines.md`)
Pentru orice modificare vizuală, layout, tabel, grafic, dark mode, Liquid Glass sau audit UI/UX în `src/`:
- Încarcă `.agents/skills/apple-design/SKILL.md` și citește strict paginile relevante din `.agents/skills/apple-design/references/hig/` (8–12 fișiere: setul de bază `accessibility.md`, `layout.md`, `typography.md`, `color.md`, `designing-for-macos.md`, `references/cross-platform.md` + 3–6 pagini pentru ce e pe ecran).
- Folosește cifre verificabile (contrast WCAG `>= 4.5:1`, `tabular-nums`, zero scroll orizontal mobil, `prefers-reduced-motion` / `prefers-reduced-transparency`), aplică Liquid Glass exclusiv pe navigație/bare (nu pe conținut de date) și citează regula exactă (`file.md › Heading` + `path:line`).

## Reguli Web Interface, iOS Safari & Testare Headless (OBLIGATORIU — `.agents/rules/web-interface-and-testing.md`)
Aplică `.agents/skills/web-design-guidelines/references/web-interface-guidelines.md` (Vercel), `.agents/skills/frontend-design/SKILL.md` și `.agents/skills/webapp-testing/SKILL.md` (Anthropic):
- `font-size >= 16px` pe `<input>/<select>/<textarea>` pe mobil (anti-zoom iOS Safari), `touch-action: manipulation`, `overscroll-behavior: contain` pe modale, `min-w-0` pe flex/grid, zero overflow orizontal pe mobile (`375px`/`390px`) și desktop (`1440px`), verificat matematic în browser real la audituri UI.

## Reguli Superpowers: Verification Before Completion & Systematic Debugging (OBLIGATORIU — `.agents/rules/superpowers-verification.md`)
Aplică `.agents/skills/verification-before-completion/SKILL.md` și `.agents/skills/systematic-debugging/SKILL.md` (`obra/superpowers`):
- **Nicio declarație „rezolvat / merge” fără rulare proaspătă de verificare și dovezi reale.**
- **Nicio reparație „la ghici” fără analiza cauzei rădăcină (Phase 1–4) la toate granițele sistemului (UI ↔ Local API ↔ Netlify AWS ↔ Supabase ↔ Platforme externe).**
