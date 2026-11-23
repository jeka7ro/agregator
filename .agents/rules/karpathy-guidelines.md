---
trigger: always_on
---
# Karpathy Engineering Guidelines (Reguli Permanente de Codare)

Sursă: `multica-ai/andrej-karpathy-skills` (skill complet + exemple în `.agents/skills/karpathy-guidelines/SKILL.md` și `.agents/skills/karpathy-guidelines/references/examples.md`).

**Principiu de bază:** Acuratețe și claritate înainte de viteză. Aplică aceste 4 reguli la orice task de codare, debugging sau refactoring din GetApp.FooD.

## 1. Think Before Coding (Gândește înainte să scrii cod)
- **Nu presupune și nu ascunde incertitudinile.** Enunță explicit ipotezele înainte de implementare.
- Dacă există mai multe interpretări sau abordări valide, prezintă-le scurt utilizatorului — nu alege pe ascuns.
- Dacă există o soluție mai simplă decât cea cerută, spune clar și argumentat.
- Dacă ceva e neclar sau ambiguu, oprește-te, numește exact ce lipsește și întreabă.

## 2. Simplicity First (Simplitatea pe primul loc)
- **Cod minim care rezolvă exact problema.** Nimic speculativ.
- Nu adăuga feature-uri, opțiuni, fallback-uri sau configurabilitate care nu au fost cerute.
- Nu crea abstracții/helper-e pentru cod folosit o singură dată.
- Nu adăuga error-handling pentru scenarii imposibile; validează la granițe (API, formulare, webhook-uri Syrve).
- Dacă ai scris 200 de linii și se poate curat în 50, simplifică.

## 3. Surgical Changes (Modificări chirurgicale)
- **Atinge strict fișierele și liniile necesare cererii curente.**
- Nu „îmbunătăți" cod adiacent, comentarii sau formatare care nu țin de task.
- Nu refactoriza cod care funcționează deja fără să ți se ceară.
- Respectă stilul existent al fișierului și **nu suprascrie** modificări pre-existente din working tree (ex. Paperclip sau `git status`).
- Șterge doar importurile/variabilele/funcțiile rămase orfane **din cauza propriilor tale modificări**; dacă observi dead code pre-existent, menționează-l fără să-l ștergi neîntrebat.
- **Testul de aur:** Fiecare linie schimbată în `git diff` trebuie să ducă direct la cererea utilizatorului.

## 4. Goal-Driven Execution (Execuție bazată pe criterii verificabile)
- Transformă orice cerere într-un obiectiv verificabil concret înainte să începi:
  - *„Repară bug-ul X"* → reproduce problema (inclusiv pe rolul/scope-ul exact al utilizatorului afectat, ex. manager pe un singur oraș `BUCURESTI` + `admin`), fixează, verifică că s-a rezolvat E2E.
  - *„Adaugă filtrul Y"* → verifică matematic că KPI-urile, tabelele, graficele și paginarea dau cifre identice înainte și după.
- Pentru task-uri cu mai mulți pași, formulează un plan scurt cu verificare per pas:
  `1. [Pas] → verificare: [comandă / criteriu]`
- Nu declara un task „rezolvat" fără dovadă de verificare reală (`node --check`, test API/E2E, `npm run build` și `run_prepush_audit.py`).
