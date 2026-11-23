---
trigger: always_on
---
# Apple Design & HIG Guidelines (Reguli UI/UX GetApp.FooD)

Sursă: `dickwu/apple-design-skill` — skill complet cu **124 pagini oficiale Apple Human Interface Guidelines** în `.agents/skills/apple-design/SKILL.md` și `.agents/skills/apple-design/references/hig/`.

## Când se activează obligatoriu
La orice task care implică **design, audit UI/UX, layout, componente, tabele, grafice, dark mode, Liquid Glass / glassmorphism, accesibilitate, responsivitate mobilă sau îmbunătățiri vizuale** în `src/`:

1. **Încarcă `.agents/skills/apple-design/SKILL.md`** și citește strict paginile HIG relevante din `.agents/skills/apple-design/references/hig/` (8–12 fișiere maxim, niciodată tot folderul):
   - **Set obligatoriu de bază:** `accessibility.md`, `layout.md`, `typography.md`, `color.md`, `designing-for-macos.md` + `references/cross-platform.md`.
   - **Set contextual (după ce e pe ecran):** `lists-and-tables.md`, `charts.md` / `charting-data.md`, `dark-mode.md`, `liquid-glass.md`, `materials.md`, `sidebars.md`, `toolbars.md`, `sheets.md`, `buttons.md`, `search-fields.md`, `motion.md`.
2. **Aplică cele 8 principii Apple HIG (2026):** *Purpose, Agency, Responsibility, Familiarity, Flexibility, Simplicity, Craft, Delight* — adaptate la stack-ul web **React + Tailwind CSS + macOS Tahoe Skin** al GetApp.FooD (traducând termenii Apple în componente React/CSS reale, fără a dilua principiul).
3. **Standard de calitate obligatoriu (cifre, nu adjective):**
   - Contrast verificabil (WCAG AA `>= 4.5:1` text normal, `>= 3:1` text mare / iconuri; verifică ambele teme Light și Dark).
   - Tipografie clară (`SF Pro` / system-ui, `tabular-nums` pentru cifre financiare și tabele, fără fonturi monospace robotizate în UI operațional).
   - **Liquid Glass cu reținere (`liquid-glass.md`):** doar pe suprafețe de navigație / bară superioară / header-e flotante — **niciodată** pe conținut de date, celule de tabel sau carduri aglomerate unde scade lizibilitatea; respectă `prefers-reduced-motion` și `prefers-reduced-transparency`.
   - Fără scroll orizontal pe mobil, focus vizibil la tastatură, stări explicite de loading / gol / eroare.
4. **La audituri / review-uri UI:** citează explicit regula (`file.md › Heading`) + `path:line` din cod și folosește formatul structurat din `SKILL.md` (*Summary, Critical, Improvements, Craft notes, What works, Platform notes*), fără a inventa probleme unde designul este deja solid.
