# specs/

Spec-kit output for in-flight features: `specs/NNN-feature-name/`. See
[../.knowledge/AI-DEVELOPMENT.md](../.knowledge/AI-DEVELOPMENT.md) for when to use the workflow at all
(most changes should skip it).

## `archive/` is not authoritative

`specs/archive/` holds specs for features that already shipped. They are **historical records of
intent, not descriptions of the current system**, and several describe architecture that no longer
exists — notably the pre-plugin design in which layer types and feature-click "kinds" were branched on
inside core. Building against them will produce exactly the code the plugin refactor removed.

**Never cite `specs/archive/` as a source for how MMGIS works today.** Authority runs: the code >
[../AGENTS.md](../AGENTS.md) and the nearest nested `AGENTS.md` > the README next to the code
(`plugins/README.md`, `plugins/core/layertypes/README.md`, `blueprints/README.md`) > `.knowledge/` >
`docs/pages/`.

When a feature ships, move its directory here.
