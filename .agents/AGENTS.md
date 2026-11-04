
## REGULĂ STRICTĂ - UI NOTIFICATIONS
- NICIODATĂ nu folosi `alert()`, `confirm()` sau `prompt()` native din browser în această aplicație.
- Toate notificările, avertismentele sau confirmările trebuie făcute exclusiv prin componente UI interne (ex: Toast, Modal, Dialog, stări locale în React).

## REGULĂ STRICTĂ - GIT PUSH & DEPLOY
- NICIODATĂ nu rula `git push` sau `netlify deploy --prod` automat fără acordul / confirmarea explicită a utilizatorului.
- Toate modificările se dezvoltă, se verifică și se testează local. Comanda de PUSH către GitHub sau DEPLOY în producție se execută EXCLUSIV după ce utilizatorul solicită sau confirmă direct acest lucru.

## REGULĂ STRICTĂ - PORT LOCAL (5174)
- Această aplicație (`agregattor 2.0`) rulează **EXCLUSIV pe `http://localhost:5174/`** (iar API-ul pe `http://localhost:3002`).
- Portul `5173` este rezervat altei aplicații și nu trebuie ocupat niciodată de acest proiect.

## REGULĂ STRICTĂ - FĂRĂ EMOJI ÎN UI
- NICIODATĂ nu folosi emoji-uri (ex: `🏪`, `🏠`, `🛵`, `📍`, `🗺️`, `💬`, `📸`, `📞`, `⏱`) în interfață, butoane, badge-uri, tabele sau hărți.
- Folosește EXCLUSIV iconițe vectoriale SVG din `lucide-react` sau text curat.

## REGULĂ STRICTĂ - PAUZĂ NOCTURNĂ (22:00 - 10:00)
- Orice verificare automată în fundal (workers, scrapers, email sync) trebuie să fie OPRITĂ complet între orele `22:00` și `10:00` (ora României, `Europe/Bucharest`) pentru a nu consuma trafic sau Disk IO.

## REGULĂ STRICTĂ - BUTOANE ȘI BADGE-URI PE UN SINGUR RÂND
- NICIODATĂ un buton, pill sau badge nu are voie să treacă pe două sau mai multe rânduri.
- Toate butoanele și badge-urile trebuie să aibă obligatoriu `whitespace-nowrap shrink-0` și aceeași înălțime uniformă pe linie.

## REGULĂ STRICTĂ - STANDARD TABELE, TOTALURI ȘI PAGINARE (SMARTDEVIZE UI RULES)
Toate tabelele din aplicație (Dispatch, Monitoring, Reputation, Customers, Reports, Alerts) TREBUIE să respecte obligatoriu următoarele reguli:
1. **Coloana 1 `Nr.` (`#`)**: Numerotare curentă (`startIndex + idx + 1`) centrată (`w-10 text-center`).
2. **Rânduri compacte (Single-Line / Truncate)**: NICIODATĂ nu afișa texte lungi pe mai multe rânduri, instrucțiuni lungi de livrare sau detalii de clădire (`Bloc`, `Scară`, `Etaj`, `Interfon`, comentarii lungi) direct în celulele tabelului. În tabel se afișează DOAR strada curată trunchiată (`truncate`), iar toate detaliile extinse se ascund în fereastra modală de **Detalii Comandă / Detalii Client**.
3. **Header-e Sortabile (`th`)**: Click pe coloanele principale sortează crescător/descrescător cu indicator (`▲` / `▼` / `⇅`).
4. **Căutare rapidă cu contor**: Input rotunjit cu iconiță `Search`, contor rezultate `{totalFiltered} / {total}` și buton `X` de resetare.
5. **Rând de Totaluri `<tfoot>` (`Σ Total Pagină:` + `Gen:` Total General)**:
   - Col 1: `Σ`
   - Col 2: `Total Pagină:` + număr înregistrări pe pagină `(din X total)`
   - Coloanele numerice/valori: Suma pe pagină + dedesubt `Gen:` (Totalul General pentru toate înregistrările filtrate).
6. **Footer standard de Paginare & Selector Rânduri**:
   - Selector `Rânduri:` (`10`, `15`, `25`, `50`, `100`, `Toți`)
   - Indicator `Total: X înregistrări (valoare RON)`
   - Navigare `Pagina X din Y` cu butoane rotunde `<` și `>`.
