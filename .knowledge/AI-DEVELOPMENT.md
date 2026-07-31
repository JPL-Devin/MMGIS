# Spec-Driven Development (spec-kit)

MMGIS carries [spec-kit](https://github.com/github/spec-kit) tooling for feature work that is large
enough to be worth designing before writing. Most tasks are not. Rules and commands live in
[../AGENTS.md](../AGENTS.md); this file only covers the spec workflow.

## Use it or skip it

**Use spec-kit** when the work spans multiple subsystems (map + globe + backend), changes the data
model or an API contract, touches auth/security, needs stakeholder agreement on behavior, or will take
more than a couple of days.

**Skip it** for bug fixes, styling, dependency bumps, copy changes, adding a single plugin that follows
an existing contract, refactors with no behavior change, and anything you can hold in your head. Just
make the change and open a PR.

If you are unsure, skip it. A stale spec is worse than no spec.

## The workflow

Slash commands, in order. Each writes into `specs/NNN-feature-name/`.

| Command | Produces | Purpose |
|---|---|---|
| `/speckit.specify` | `spec.md` | User scenarios, functional requirements, success criteria. **No implementation detail.** |
| `/speckit.plan` | `plan.md` | Technical approach, affected files, data model, API contracts, constitution check |
| `/speckit.tasks` | `tasks.md` | Ordered, individually reviewable tasks |
| `/speckit.implement` | code | Executes tasks in order |
| `/speckit.checklist` | `checklist.md` | Pre-merge verification |

Review `spec.md` before planning and `plan.md` before generating tasks — correcting a spec costs
minutes, correcting an implementation costs days. If a task looks like more than a day's work, split
it.

## The constitution

`.specify/memory/constitution.md` holds the project's non-negotiable principles (documentation-first,
test coverage, incremental delivery, geospatial data integrity, real-time collaboration safety, …).
`/speckit.plan` checks the plan against it and flags violations, which must be either fixed or
justified in the plan's Complexity Tracking section. Amend the constitution by PR — never work around
it silently.

## Keeping specs honest

A spec describes intent at a point in time; the code moves on. So:

- **A spec is never authoritative about how the code works today.** The code is, and after it the
  README next to the code. `specs/archive/` in particular predates the plugin architecture — do not
  design against it.
- **Delete `tasks.md` once a feature ships.** It has no readers after merge.
- **If a spec's described architecture no longer exists, archive the spec** rather than leaving it to
  mislead the next agent.
- Prefer describing behavior over naming files; file paths in specs rot fastest.

## Also

- Plan geospatial work with the coordinate system, projection, and bounds stated explicitly, and test
  across the map, globe, and viewer surfaces.
- Real-time/WebSocket features need a concurrency and conflict story in `plan.md` before implementation.
