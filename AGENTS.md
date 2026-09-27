# HandAI — Agent Instructions

## Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

---

## INSTRUCTION PRECEDENCE ORDER

1. **Owner explicit instruction** (user's current message)
2. **MathVision Kids project rules** (this section)
3. **Task-specific acceptance criteria**
4. **Matching Agent Skills** (`.agents/skills/`)
5. **Generic agent preferences**

---

## PROJECT RULES

- Inspect → implement → test → report → STOP
- No commit/push unless owner explicitly permits
- No model training unless explicitly authorized
- Preserve Student Mobile when task scope is web-only
- Backend remains authority for RBAC/auth
- Do not fabricate physical-device evidence
- Student-facing UI must NOT show: Expo, Metro, LAN, localhost, ports, Spring Boot, FastAPI, MinIO, Redis, PostgreSQL, API URLs, developer instructions, terminal instructions, demo/test account emails, architecture/debug information

---

## MANDATORY SKILL ROUTING POLICY

**Required behavior before every substantial implementation task:**

1. Read the user's task description.
2. Identify task domains (e.g., "React UI", "accessibility", "animation").
3. Inspect the workspace skill registry at `.agents/skills/`.
4. Match the task to the **most specific relevant skill(s)** (max 3 default, more only if task genuinely spans separate domains).
5. **Read the matching `.agents/skills/<skill>/SKILL.md` BEFORE editing any code.**
6. Follow skill instructions during implementation.
7. If multiple independent domains exist, use multiple relevant skills.
8. Do NOT load unrelated skills.
9. If no skill matches, explicitly state `Skills matched: none`.
10. Before final response/report, state: `Skills applied: <skill1>, <skill2>, ...`

### Task-Start Declaration

Every substantial implementation task must begin with:

```
SKILL ROUTING
Task domains: <identified domains>
Skills matched:
- <exact frontmatter identifier> (.agents/skills/<folder>/SKILL.md)
Skills loaded: YES / NO
```

3–6 lines maximum. Do not make this verbose.

### Report Traceability

Every phase report under `report/` must include:

```markdown
## Skills Applied

- `<exact frontmatter identifier>`
  - SKILL.md: `.agents/skills/<folder>/SKILL.md`
  - Why selected: <reason>
  - Applied to: <specific areas>
```

If no skills apply: `Skills Applied: None — no installed skill matched the task.`

---

## SKILL ROUTING MATRIX

Use the **actual installed skills** at `.agents/skills/` to route tasks.

| Task Domain | Primary Skill | Secondary Skill(s) |
|---|---|---|
| UI / visual redesign / page layout | `ui-ux-pro-max` | `web-design-guidelines` |
| React / React Native implementation | `vercel-react-best-practices` | — |
| Accessibility audit / fix | `fixing-accessibility` | — |
| Animation / motion / rendering perf | `fixing-motion-performance` | — |
| Brand / logo / visual identity | `brand` | `design` |
| Design system / tokens | `design-system` | `design` |
| General UI styling / components | `ui-styling` | — |
| Presentations / slides | `slides` | — |
| Banner / poster / hero image | `banner-design` | `design` |
| Comprehensive design task | `design` | (sub-skills as needed) |
| Web UI review / audit | `web-design-guidelines` | `fixing-accessibility` |
| Code simplification / YAGNI / minimal diffs | `ponytail` | — |
| Code review / anti-bloat / over-engineering | `ponytail-review` | `ponytail-audit` |
| Technical debt audit / simplicity | `ponytail-debt` | `ponytail-gain` |
| Backend / Spring / database / API | `ponytail` (if simplifying/refactoring) | — |
| AI model / training / OCR | _(no UI/design skill)_ | — |

### Routing Examples

| Task | Skills Selected |
|---|---|
| "Redesign login page in React" | `ui-ux-pro-max`, `vercel-react-best-practices`, `fixing-accessibility` |
| "Fix animation stutter on dashboard" | `fixing-motion-performance` |
| "Create PowerPoint defense presentation" | `slides` |
| "Refactor authentication service cleanly" | `ponytail` |
| "Review PR for over-engineering and bloat" | `ponytail-review` |
| "Review portal accessibility" | `fixing-accessibility`, `web-design-guidelines` |
| "Design a social media banner" | `banner-design` |

### Selection Rules

- Prefer the **most specific** skill first.
- Do NOT load all skills on every task.
- Backend-only tasks must NOT trigger UI/design skills.
- Maximum **3 skills** per task unless the task genuinely spans more domains.

---

## CANONICAL SKILL DIRECTORY

All workspace skills live at:

```
.agents/skills/<skill-name>/SKILL.md
```

### Canonical Path Priority

1. **`.agents/skills/<skill-name>/SKILL.md`** — Always use this path.
2. **`.agent/skills/<skill-name>/SKILL.md`** — Legacy fallback. Use ONLY if no canonical copy exists under `.agents/skills/`.

**Hard rule:** If a skill exists in both `.agents/skills/` and `.agent/skills/`, the agent MUST load from `.agents/skills/`. Loading from `.agent/skills/` when a canonical copy exists is a routing error.

See `SKILLS_INSTALLED.md` for the full registry.
