# Web Design Guidelines & Headless Webapp Testing (Vercel + Anthropic)

Surse instalate:
- `.agents/skills/web-design-guidelines/SKILL.md` + `references/web-interface-guidelines.md` (`vercel-labs/agent-skills` + `vercel-labs/web-interface-guidelines`)
- `.agents/skills/frontend-design/SKILL.md` (`anthropics/skills`)
- `.agents/skills/webapp-testing/SKILL.md` (`anthropics/skills`)

## Reguli obligatorii pentru orice UI / CSS / React în `src/`
1. **iOS Safari & Mobile Ergonomics:**
   - `<input>`, `<select>`, `<textarea>` trebuie să aibă `font-size >= 16px` pe ecrane mobile (`<= 767px`) pentru a preveni auto-zoom-ul pe iOS Safari.
   - `touch-action: manipulation` pe elemente interactive (`button`, `a`, `input`, `select`).
   - `overscroll-behavior: contain` în modale, drawer-e și sheet-uri (`.apple-sheet`).
   - `min-w-0` pe copiii flex/grid ca textul tradus (RO/EN/RU) să nu depășească ecranul (`scrollWidth <= clientWidth`).
   - `tabular-nums` pe prețuri, KPI-uri, ore și tabele; `prefers-reduced-motion` și `prefers-reduced-transparency` respectate.
2. **Accesibilitate & Semantică:**
   - Butoanele doar cu icon necesită `aria-label`; elementele interactive folosesc `<button>` / `<a>`, nu `<div onClick>`.
   - Focus vizibil cu `:focus-visible` (niciodată `outline-none` fără înlocuire).
   - Imaginile au dimensiuni clare / `alt`; listele mari nu blochează randarea; nu folosim `transition: all` pe animații noi.
3. **Verificare matematică în browser real (Playwright / Headless Chrome — `webapp-testing`):**
   - La audituri UI majore sau modificări de layout, rulează verificare reală în browser pe viewport-uri desktop (`1440px`) + mobile (`375px` / `390px`), verificând matematic `document.documentElement.scrollWidth <= window.innerWidth`, console errors (`0`), imagini rupte (`0`) și modalele deschise!
