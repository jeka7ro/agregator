
## REGULĂ STRICTĂ - UI NOTIFICATIONS
- NICIODATĂ nu folosi `alert()`, `confirm()` sau `prompt()` native din browser în această aplicație.
- Toate notificările, avertismentele sau confirmările trebuie făcute exclusiv prin componente UI interne (ex: Toast, Modal, Dialog, stări locale în React).

## REGULĂ STRICTĂ - GIT PUSH & DEPLOY
- NICIODATĂ nu rula `git push` sau `netlify deploy --prod` automat fără acordul / confirmarea explicită a utilizatorului.
- Toate modificările se dezvoltă, se verifică și se testează local. Comanda de PUSH către GitHub sau DEPLOY în producție se execută EXCLUSIV după ce utilizatorul solicită sau confirmă direct acest lucru.

## REGULĂ STRICTĂ - PORT LOCAL (5174)
- Această aplicație (`agregattor 2.0`) rulează **EXCLUSIV pe `http://localhost:5174/`** (iar API-ul pe `http://localhost:3002`).
- Portul `5173` este rezervat altei aplicații și nu trebuie ocupat niciodată de acest proiect.
