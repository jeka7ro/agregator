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

