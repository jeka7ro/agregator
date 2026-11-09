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
