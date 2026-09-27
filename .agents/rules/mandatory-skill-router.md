---
trigger: always_on
---

# Mandatory Skill Router — MathVision Kids

Before performing any substantial implementation, review, refactor, debugging, design, testing, or artifact task, you MUST route the task through the installed workspace skills.

## Mandatory procedure

1. Read the user's request and identify the task domains.
2. Inspect the available skills under `.agents/skills/`.
3. Select the most specific relevant skill(s).
4. Read each selected skill's `SKILL.md` BEFORE editing code or producing the implementation.
5. Follow the selected skill instructions during the task.
6. Do NOT load unrelated skills.
7. Use at most 3 skills by default. Use more only when the task genuinely spans more independent domains.
8. If no installed skill matches, explicitly use:
   `Skills matched: none`
9. Never claim a skill was applied unless its `SKILL.md` was actually read during the task.
10. Every implementation report must contain a `## Skills Applied` section.

## Canonical Skill Resolution

- Canonical workspace skills live under `.agents/skills/`.
- When a matching skill exists in both `.agents/skills/` and `.agent/skills/`, **ALWAYS** use the `.agents/skills/` copy.
- **Never** load a legacy duplicate from `.agent/skills/` when a canonical copy exists under `.agents/skills/`.
- Use `.agent/skills/` only as a backward-compatible fallback when **no canonical skill exists** under `.agents/skills/`.
- The task-start declaration must show the exact canonical `SKILL.md` path actually read.
- If the loaded path begins with `.agent/skills/` and a `.agents/skills/` equivalent exists, the routing is **INCORRECT** and must be corrected.

## Required task-start declaration

Before implementation, output or internally establish:

SKILL ROUTING
Task domains: <domains>
Skills matched:
- <exact skill identifier>
Skills loaded:
- <exact .agents/skills/.../SKILL.md path>

Then proceed with implementation.

## Routing guidance

- UI/UX design, redesign, user flows:
  `ui-ux-pro-max`

- React / React Native implementation, refactoring, rendering or performance:
  `vercel-react-best-practices`

- Accessibility, forms, keyboard/focus, ARIA, touch targets, contrast:
  `fixing-accessibility`

- Web visual review and modern web design:
  `web-design-guidelines`

- Motion / animation performance:
  `fixing-motion-performance`

- General UI styling:
  `ui-styling`

- Brand / logo / visual identity:
  `brand`

- Design systems:
  `design-system`

- General comprehensive design work:
  `design`

- Slides / presentations:
  `slides`

- Banner / poster work:
  `banner-design`

- Code simplification, minimal diffs, YAGNI, lazy senior dev mode:
  `ponytail`

- Code review, anti-bloat, detecting over-engineering:
  `ponytail-review`

- Codebase simplicity audit, dead code, duplicate helpers:
  `ponytail-audit`

- Backend / Spring / API:
  use `ponytail` if simplifying/refactoring, otherwise no UI/design skill unless another installed skill genuinely matches.

- AI / OCR / model work:
  use no unrelated UI/design skill unless the task also contains an actual UI component.

## Selection rules

Prefer the most specific skill first.

Examples:

"Redesign the React login screen"
→ `ui-ux-pro-max`
→ `vercel-react-best-practices`
→ `fixing-accessibility`

"Reduce unnecessary React re-renders"
→ `vercel-react-best-practices`

"Audit login form accessibility"
→ `fixing-accessibility`
→ optionally `web-design-guidelines`

"Fix Spring Boot refresh-token bug"
→ `Skills matched: none`
unless a backend-specific installed skill exists.

"Create defense slides"
→ `slides`

Do NOT load every skill for every task.

## MathVision Kids project precedence

When instructions conflict, use this priority:

1. Owner's explicit instruction
2. MathVision Kids project rules in `AGENTS.md`
3. Current task acceptance criteria
4. Matching Agent Skill instructions
5. Generic Agent preferences

Always preserve these project rules:

- Inspect before modifying.
- Implement only within the requested scope.
- Test after implementation.
- Create the required report.
- STOP after the requested phase.
- Never commit or push unless the owner explicitly permits it.
- Never train or modify AI model artifacts unless explicitly authorized.
- Never fabricate runtime, browser, physical-device, accuracy, or test evidence.
- Preserve Student Mobile when the task scope is web-only.
- Spring Boot remains the security authority for authentication and RBAC.

## Final report traceability

Every substantial implementation report must include:

## Skills Applied

For each skill:
- exact skill identifier
- exact `SKILL.md` path
- why it was selected
- what instructions from the skill materially affected the implementation

If none apply:

`Skills Applied: None — no installed skill matched this task.`