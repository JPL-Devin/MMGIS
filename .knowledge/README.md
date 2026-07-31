# .knowledge/

Supporting context for AI agents. **Start at [../AGENTS.md](../AGENTS.md)** — it holds the rules and
routes you here. Nothing in this directory overrides it.

| File | Read it when |
|------|-------------|
| [AI-GETTING-STARTED.md](AI-GETTING-STARTED.md) | You need to get MMGIS running, or it won't start. Setup, ports, commands, mission creation, pitfalls. |
| [conventions.md](conventions.md) | You need naming, code style, where-does-this-file-go, git conventions, or a fix for a specific symptom. |
| [code-patterns.md](code-patterns.md) | You need a copy-paste template (Express route, Sequelize model, tool plugin, WebSocket handler) or an orientation map of the tree. |
| [AI-DEVELOPMENT.md](AI-DEVELOPMENT.md) | You are starting a large feature and want the spec-kit workflow. |

## Where documentation belongs

Follow this split when you add documentation. Content living in exactly one place is the only thing
that stays true.

| Kind of knowledge | Home | Why |
|---|---|---|
| Hard rules, commands, routing | `AGENTS.md` (root) | Loaded on every task |
| How a subsystem works | A `README.md`/`AGENTS.md` **next to that code** (e.g. `plugins/`, `plugins/core/layertypes/`, `blueprints/`) | Gets updated by whoever changes the code |
| Rules scoped to one directory | A nested `AGENTS.md` in that directory | Agents read the nearest one first |
| Gotchas learned the hard way | `.knowledge/conventions.md` | Not derivable from the code |
| Anything a user would read | `docs/pages/` | Published site |

**Do not copy content between tiers — link to it.** Duplicated prose is how `src/essence/Tools/`
ended up cited in three files months after the directory stopped existing.

Also avoid: filesystem trees in more than one file, version numbers, "Last Updated" stamps, and
counts ("16 tools"). They rot silently and cost trust in everything around them.

`specs/archive/` is historical and **not authoritative** — it describes the pre-plugin architecture.
