# Conventions & Gotchas

Naming, style, placement, and hard-won lessons. Hard rules live in [../AGENTS.md](../AGENTS.md);
this file is the detail behind them.

## Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Singletons | Trailing `_` | `L_`, `Map_`, `Globe_`, `F_`, `ToolController_`, `ComponentController_`, `Viewer_`, `TimeControl_` |
| Files | PascalCase | `Map_.js`, `LayerInterface.js` |
| CSS classes | kebab-case | `.tool-panel`, `.map-container` |
| Constants / ENVs | UPPER_SNAKE | `DB_HOST`, `AUTH` |
| Plugin directories | PascalCase, inside a plural type dir | `plugins/core/tools/Measure/` |
| Plugin manifest `type` | singular | `"type": "layertype"` in `layertypes/` |

## Code style

4-space indent, single quotes, `async`/`await` over callbacks, Prettier defaults.

## Where does this file go?

| You are writing | Put it in |
|---|---|
| A toolbar tool | `plugins/core/tools/<Name>/` (or your own container) |
| An Express feature + tables | `plugins/core/backend/<Name>/` |
| A layer type renderer | `plugins/core/layertypes/<Type>/` |
| Feature click/hover behavior | `plugins/core/interactions/<Name>/` |
| An always-on UI component | `plugins/core/components/<Name>/` |
| A generic, reusable UI component | `src/design-system/components/` |
| MMGIS-specific chrome (top bar, coordinates, cursor info) | `src/essence/Basics/UserInterface_/` |
| Layer state / lifecycle logic | `src/essence/Basics/Layers_/<concern>/` |
| Config or sample data a feature needs | `blueprints/Missions/` |

A tool renders into **`#toolPanel`** (or `#tools` when it is in the mobile / split-screen container,
or its own `targetId` if one is set) and may drive the viewer, map, and globe — it should never reach
into unrelated UI. Keep setup and teardown paired (the `interfaceWithMMGIS()` /
`separateFromMMGIS()` convention) so `destroy()` leaves no listeners behind.

## Git

- Branches: `master` (production), `development` (active development — branch from here),
  `feature/NNN-name`, `hotfix/desc`.
- Commits: imperative mood.

## Symptom → cause

| Symptom | Cause |
|---|---|
| `/configure` blank or splash-only | Configure app not built: `cd configure && npm install && npm run build` |
| Your frontend change isn't showing | You're on 8888. Browse **8889** in dev; 8888 is the API |
| A new tool/component/interaction doesn't appear | Regenerate the registries: `npm run plugins -- activate` |
| A new **layer type** doesn't appear after `activate` | `activate` skips layer types — restart the server, `npm run build`, or run `node -e "require('./API/updateTools').updateLayerTypes()"` |
| Server refuses to start after a manifest edit | Manifest invalid — validation runs at startup. `npm run plugins -- validate` |
| Layer type "claims a renderer it ships no module for" | `capabilities.renderers` and `paths` disagree; they are cross-checked |
| A renderer op silently never runs | Typo'd operation name — `npm run plugins -- validate` statically rejects unknown ops/phases |
| DB connection fails | `.env` credentials, PostgreSQL+PostGIS running, `DB_HOST=db` under Docker |
| `SECRET too short` | Must be ≥24 characters |
| ENV change has no effect | Triple-update required: `.env`, `sample.env`, `docs/pages/Setup/ENVs/ENVs.md` |
| WebSocket dead | `ENABLE_MMGIS_WEBSOCKETS=true`, and the proxy must allow WS upgrade |
| SPICE errors | `SPICE_SCHEDULED_KERNEL_DOWNLOAD=true` and `/Missions/spice-kernels-conf.json` |
| Column missing on an existing table | `sequelize.sync()` runs without `alter: true` — add it in the model's `up()` |

## Lessons from past sessions

- **Startup migrations can race.** Model `up()` functions (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
  are invoked from a backend plugin's `onceSynced`, and some are not awaited. A query issued right
  after startup can beat its own migration.
- **Fatal startup errors must be logged, not thrown**:
  `logger('error', msg, 'server', null, 'infrastructure_error')`.
- **Path traversal:** `../` in a layer URL is legitimate — MMGIS prepends
  `/Missions/<current_mission>/` to relative paths and cross-mission references are a real use case.
  It must never resolve outside `/Missions`. Validate against `/Missions`, not one mission's
  subdirectory, and make sure it still holds when MMGIS is served from a subpath. Key files:
  `scripts/middleware.js` (`onlyExistingFilepaths`, `isPathInsideRoot`),
  `plugins/core/backend/Utils/routes/utils.js` (time-directory listing with `_time_` split paths).
  Timetilesets have extra pathing nuances.
- **Admin auth applies even when `AUTH=off`.** `/api/configure/*` needs session permission `"111"` or
  `"110"`; only `/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get`, and
  `/api/geodatasets/search` are whitelisted (`ensureAdmin` in `scripts/server.js`). Tests must handle
  auth in every `AUTH` mode, or `test.skip()` with a reason.
- **Parallelizing with child sessions:** each child pushes to its own named branch and does **not**
  open a PR. Only the parent opens the consolidated PR.
