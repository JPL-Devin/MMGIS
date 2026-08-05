# Hazard Zones — report from authoring a multi-family MMGIS plugin bundle

Branch: `devin/r4-packaging-1785893022` (no PR).

## 1. What I built / what actually works

"Hazard zones" as one container, `plugins/hazard-zones` (force-added):

- `layertypes/HazardZone` — `typeId: hazardzone`, `extends: vector`, single
  `module` exporting only the `config` (normalize: severity prop + style
  defaults) and `legend` (derive: severity→colour `styleMatching`) surfaces. No
  renderer of its own.
- `layerattachments/HazardBuffer` — `attachmentId: hazard_buffer`,
  `applicableLayerTypes: ["hazardzone"]`, draws the exclusion band
  (`make`/`syncData`/`onConfigChange`).
- `interactions/HazardReport` — `hazard:report`, main/300, reports which zones +
  buffers a clicked feature's centroid lies in, popup + `ctx.state.hazardZones`.
- `lib/` — shared, dependency-free geometry + report logic.

Verified: `plugins -- validate` clean (61/61, no warnings after the fixes), all
three appear in the generated `src/pre/{layertypes,layerattachments,interactions}.js`,
13 plugin unit tests pass, `npm run test:unit` 1041 pass, eslint clean except the
same `no-anonymous-default-export` warnings core plugins have.

**Not verified in a browser** — I never had a mission with a `hazardzone` layer
up, so nothing here is proven to draw: the Leaflet band, the popup, the severity
legend and the Configure tabs are all untested at runtime. Treat "validate
passes" as exactly that. The buffer is also a vertex-scaling approximation, not
a true buffer (wrong on concave zones).

## 2. Files

Branch `devin/r4-packaging-1785893022`, container `plugins/hazard-zones/`:

- `layertypes/HazardZone/{plugin.json, hazardZone.js, tests/hazardZone.spec.js}`
- `layerattachments/HazardBuffer/{plugin.json, hazardBuffer.js, tests/hazardBuffer.spec.js}`
- `interactions/HazardReport/{plugin.json, HazardReport.js, tests/hazardReport.spec.js}`
- `lib/{hazardGeometry.js, hazardReport.js, tests/hazardGeometry.spec.js}`
- `README.md`, `package.json`, `REPORT.md`

Core (outside the container): `API/updateTools.js` — see section 3.

## 3. The seams (and the one core change)

- **layertype→attachment**: `applicableLayerTypes: ["hazardzone"]`. Clean,
  documented, worked first try.
- **layertype→interaction**: `capabilities.defaultInteractions.click:
  ["hazard:report"]`. Declarative and nice.
- **interaction→attachment: no supported path.** `ctx.config` is deliberately
  only my own settings, and the attachment README forbids reading a host's
  `configPath` directly. I ended up reading the built attachment out of
  `L_.layers.attachments[hostName].hazard_buffer._bufferedFeatures` — a path I
  got from prose in `plugins/core/layerattachments/README.md:137`, not from any
  API. There is no `L_.getAttachment(layer, attachmentId)` and no way for one
  plugin to *call* another (no registry lookup by `attachmentId` /
  `interactionId` exposed to plugins), so cooperation is either shared globals or
  a shared `lib/` inside one container. A container-level `lib/` works (webpack
  resolves the relative import fine) but is undocumented — I guessed it.
- **Core change (1 place, 6 lines, unavoidable):** `API/updateTools.js` built its
  `enabledPluginIds` set from `["tools","backend","components","interactions"]`
  only. An interaction that declares `pluginDependencies:
  ["<container>/layertypes/HazardZone"]` therefore had a "missing" dependency and
  was **silently excluded from `src/pre/interactions.js`** while
  `plugins -- list` still showed it enabled and green. I added `layertypes` /
  `layerattachments` to that set. Without it, a multi-family feature cannot
  declare its own dependencies — the documented mechanism actively breaks the
  feature.

## 4. Silent failures

- The above: green `list`, green `validate` ("All 61 valid"), interaction simply
  never loads.
- **Installing from a local path renames the container to the directory
  basename.** `install /home/ubuntu/mmgis-hazard-zones` produced container
  `mmgis-hazard-zones`, so every plugin ID changed and all my
  `pluginDependencies` (`hazard-zones/...`) broke → interaction dropped from the
  registry again. Plugin IDs depending on the install directory name means a
  container cannot reliably reference its own plugins. Renaming the dir to
  `hazard-zones` fixed it.
- `validate` has an "absent from `src/pre/interactions.js`" warning (it fired the
  first time) but it did **not** fire in the renamed-container case — the dep
  warning seems to replace it, so the most dangerous variant is the quieter one.
- `install` from a local path copies the source repo's `.git`, so the installed
  container becomes an embedded git repo and `git add -f` silently stages a
  gitlink instead of files.

**Round trip (uninstall → install → list/enable/state):** `uninstall
hazard-zones` removed the directory, regenerated all three registries, and
**wiped `plugin-state.json` back to `{"plugins":{}}` — a deliberate per-plugin
`disable` did not survive** the reinstall (everything comes back enabled). A
local-path install adds **no** `registries.json` entry (git installs do), so
`install <name>` / `update` don't work for it afterwards. Files, manifests and
generated registries all round-tripped intact.

## 5. Docs issues

- `plugins/README.md:878-889` says `pluginDependencies` is "primarily used by
  tools to declare which backends they need" — it doesn't say the other families
  aren't in the resolver's set, which is precisely the trap.
- Nothing documents container-level shared code (`lib/`) or cross-plugin imports,
  though a multi-family feature needs one.
- `plugins/README.md:285` documents that a local path installs under its
  basename, but nothing warns that this changes plugin IDs and thus
  `pluginDependencies`.
- `plugin-cli/scaffolds/interaction/tests/__name__.spec.js` imports the
  interaction module and calls `use()`; the interactions README (Testing section)
  says a module importing `L_` can't be imported in Node. Both are right, so the
  scaffolded test **fails as soon as you follow the authoring docs** — I had to
  rewrite mine to import the lib instead.
- `plugins/core/layerattachments/README.md:137` is the only place the attachment
  storage path is stated, and it's the seam every cooperating plugin needs.

## 6. What I liked

`extends` — the layertype is 55 lines and inherits Vector's whole renderer;
`create` scaffolds that are real files with the vocabulary commented inline;
`validate`'s module-level static parse (a typo'd operation is an error, not a
silent no-op); `applicableLayerTypes` on the attachment being enough to scope it
to my new type; `configPath` + `config.rows` giving me Configure forms with zero
Configure code; and the "You're not done when validate passes" table, which is
exactly the right warning.

## 7. Top 3 recommendations

1. **Make cross-family references first-class**: include every family in the
   `pluginDependencies` resolver (the fix I had to make), and give plugins a read
   API — `L_.getAttachment(layerName, attachmentId)`,
   `LayerTypeRegistry.get(typeId)`, `Interactions.get(interactionId)` — so one
   plugin can find another without reading core source or private `_` fields.
2. **Make the container the identity, not the directory**: honour a declared
   container name (e.g. `package.json` → `mmgis.container`) on install, and
   support `self/...` or bare `layertypes/HazardZone` in `pluginDependencies` so
   a container's internal references survive being installed under any path.
3. **Support a container as a unit**: document/standardise `lib/` for shared
   code, make `uninstall`/`install` preserve `plugin-state.json` entries (or
   `--keep-state`), strip the copied `.git`, and have `validate` fail loudly —
   not warn — when an enabled plugin is absent from a generated registry.
