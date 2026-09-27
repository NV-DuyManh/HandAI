# MathVision Kids — Installed Skills Registry

> Last updated: 2026-09-12T21:58+07:00
> Canonical path: `.agents/skills/<skill-name>/SKILL.md`
> Legacy path (DO NOT ROUTE): `.agent/skills/<skill-name>/SKILL.md`

## Canonical Path Priority

1. **`.agents/skills/<skill-name>/SKILL.md`** — Always use this path.
2. **`.agent/skills/<skill-name>/SKILL.md`** — Legacy fallback. Use ONLY if no canonical copy exists under `.agents/skills/`.

**Hard rule:** If a skill exists in both `.agents/skills/` and `.agent/skills/`, the agent MUST load from `.agents/skills/`. Loading from `.agent/skills/` when a canonical copy exists is a routing error.

## Active Skills

| Skill Identifier (frontmatter `name`) | Folder | Canonical SKILL.md | Description | Status | Legacy Duplicate |
|---|---|---|---|---|---|
| `ui-ux-pro-max` | `ui-ux-pro-max` | `.agents/skills/ui-ux-pro-max/SKILL.md` | UI/UX design intelligence for web, mobile, and desktop. | ACTIVE | `.agent/workflows/ui-ux-pro-max.md` (workflow format, not a skill duplicate) |
| `vercel-react-best-practices` | `react-best-practices` | `.agents/skills/react-best-practices/SKILL.md` | React and Next.js performance optimization guidelines from Vercel Engineering. | ACTIVE | `.agent/skills/react-best-practices/` — `LEGACY_DUPLICATE_DO_NOT_ROUTE` (OS access denied; cannot move) |
| `fixing-accessibility` | `fixing-accessibility` | `.agents/skills/fixing-accessibility/SKILL.md` | Audit and fix HTML accessibility issues including ARIA labels, keyboard navigation, focus management, color contrast, and form errors. | ACTIVE | REMOVED — moved to `.agent/skills-legacy/fixing-accessibility/` |
| `fixing-motion-performance` | `fixing-motion-performance` | `.agents/skills/fixing-motion-performance/SKILL.md` | Audit and fix animation performance issues including layout thrashing, compositor properties, scroll-linked motion, and blur effects. | ACTIVE | REMOVED — moved to `.agent/skills-legacy/fixing-motion-performance/` |
| `web-design-guidelines` | `web-design-guidelines` | `.agents/skills/web-design-guidelines/SKILL.md` | Review UI code for Web Interface Guidelines compliance. | ACTIVE | REMOVED — moved to `.agent/skills-legacy/web-design-guidelines/` |
| `ui-styling` | `ui-styling` | `.agents/skills/ui-styling/SKILL.md` | Create beautiful, accessible user interfaces with shadcn/ui components (Radix UI + Tailwind), Tailwind CSS utility-first styling, and canvas-based visual designs. | ACTIVE | — |
| `design` | `design` | `.agents/skills/design/SKILL.md` | Comprehensive design skill: brand identity, design tokens, UI styling, logo generation, corporate identity, HTML presentations, banner design, icon design, social photos. | ACTIVE | — |
| `design-system` | `design-system` | `.agents/skills/design-system/SKILL.md` | Token architecture, component specifications, and slide generation. Three-layer tokens (primitive→semantic→component), CSS variables, spacing/typography scales, component specs. | ACTIVE | — |
| `brand` | `brand` | `.agents/skills/brand/SKILL.md` | Brand voice, visual identity, messaging frameworks, asset management, brand consistency. | ACTIVE | — |
| `slides` | `slides` | `.agents/skills/slides/SKILL.md` | Create strategic HTML presentations with Chart.js, design tokens, responsive layouts, copywriting formulas, and contextual slide strategies. | ACTIVE | — |
| `banner-design` | `banner-design` | `.agents/skills/banner-design/SKILL.md` | Design banners for social media, ads, website heroes, creative assets, and print. Multiple art direction options with AI-generated visuals. | ACTIVE | — |
| `ponytail` | `ponytail` | `.agents/skills/ponytail/SKILL.md` | Lazy senior dev mode. Forces the simplest, shortest solution that actually works: YAGNI, stdlib first, minimal diffs, no unrequested abstractions. | ACTIVE | — |
| `ponytail-review` | `ponytail-review` | `.agents/skills/ponytail-review/SKILL.md` | Code review through the Ponytail lens: flags over-engineering, unneeded abstractions, bloat, and YAGNI violations. | ACTIVE | — |
| `ponytail-audit` | `ponytail-audit` | `.agents/skills/ponytail-audit/SKILL.md` | Repository-wide simplicity audit: dead code, duplicate helpers, unused dependencies, and boilerplate. | ACTIVE | — |
| `ponytail-debt` | `ponytail-debt` | `.agents/skills/ponytail-debt/SKILL.md` | Technical debt audit and quantification. | ACTIVE | — |
| `ponytail-gain` | `ponytail-gain` | `.agents/skills/ponytail-gain/SKILL.md` | Complexity vs value gain evaluation. | ACTIVE | — |
| `ponytail-help` | `ponytail-help` | `.agents/skills/ponytail-help/SKILL.md` | Ponytail quick reference guide and cheat sheet. | ACTIVE | — |

## Identifier Notes

| Folder | Frontmatter `name` | Notes |
|---|---|---|
| `react-best-practices` | `vercel-react-best-practices` | Folder name differs from frontmatter name. Frontmatter `name` is the authoritative skill identifier used in routing matrix and reports. |
| `ponytail` | `ponytail` | Primary lazy senior dev skill. |

## Legacy Duplicate Status

| Original Legacy Path | Content Match | Filesystem Status | Routing Status |
|---|---|---|---|
| `.agent/skills/fixing-accessibility/` | Byte-identical to canonical | Moved to `.agent/skills-legacy/fixing-accessibility/` | `LEGACY_DUPLICATE_DO_NOT_ROUTE` |
| `.agent/skills/fixing-motion-performance/` | Byte-identical to canonical | Moved to `.agent/skills-legacy/fixing-motion-performance/` | `LEGACY_DUPLICATE_DO_NOT_ROUTE` |
| `.agent/skills/web-design-guidelines/` | Byte-identical to canonical | Moved to `.agent/skills-legacy/web-design-guidelines/` | `LEGACY_DUPLICATE_DO_NOT_ROUTE` |
| `.agent/skills/react-best-practices/` | Byte-identical to canonical | **Still present** (OS access denied on move) | `LEGACY_DUPLICATE_DO_NOT_ROUTE` — canonical `.agents/skills/` version must always be loaded instead |

## Workspace Rules

| Rule | Path | Activation |
|---|---|---|
| Mandatory Skill Router | `.agents/rules/mandatory-skill-router.md` | ALWAYS ON (workspace rule auto-loaded by Antigravity) |
| Ponytail (Lazy Senior Dev Mode) | `.agents/rules/ponytail.md` | ACTIVE ON DEMAND / CODING (The ladder: YAGNI -> stdlib -> minimal diff) |
