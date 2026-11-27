# Superpowers: Verification Before Completion & Systematic Debugging (`obra/superpowers`)

Surse instalate:
- `.agents/skills/verification-before-completion/SKILL.md`
- `.agents/skills/systematic-debugging/SKILL.md` (+ `root-cause-tracing.md`, `defense-in-depth.md`, `condition-based-waiting.md`)

## 1. Legea de Fier a Verificării (`verification-before-completion`)
**ZERO declarații de „gata / rezolvat / merge” fără dovadă proaspătă rulată în tura curentă!**
- Identifică exact comanda / testul care demonstrează afirmația.
- Rulează comanda complet (fără să te bazezi pe rulări vechi sau presupuneri de tip „ar trebui să meargă”).
- Citește întreg output-ul și verifică exit code `0` și cifrele reale.
- Abia apoi raportează rezultatul utilizatorului, citând dovada exactă.

## 2. Legea de Fier a Debugging-ului Sistematic (`systematic-debugging`)
**NICIO reparație fără investigarea cauzei rădăcină (Phase 1) mai întâi!**
1. **Phase 1 — Root Cause Investigation:** citește eroarea completă, reproduce consistent pe date reale / producție, trasează fluxul de date cap-coadă la fiecare graniță (frontend → API/Netlify → DB / platformă externă).
2. **Phase 2 — Pattern Analysis:** compară codul care merge cu cel care eșuează (ex. paritate `workers/src/api-server.js` ↔ `netlify/functions/api.js`, IP local RO ↔ AWS US Netlify).
3. **Phase 3 — Hypothesis & Minimal Test:** formulează o ipoteză precisă și testeaz-o minim înainte să modifici codul.
4. **Phase 4 — Fix at Source + Defense in Depth:** repară sursa reală, nu simptomul, și verifică E2E că simptomul original a dispărut.
