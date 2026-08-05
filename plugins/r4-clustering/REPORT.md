# Third-party author report — dense point clustering across three plugin families

Branch: `devin/r4-clustering-1785893003` (pushed, no PR). Container: `plugins/r4-clustering`
(committed with `git add -f`). No core files were modified.

## 1. What I built, and what actually works

| plugin | family | files |
|---|---|---|
| `ClusteredVector` | layertype (`typeId: clusteredvector`, `extends: vector`) | `plugin.json`, `source.js`, `legend.js`, `config.js`, `lib/clustering.js`, `tests/clusteredVector.spec.js` |
| `ClusterCounts` | layerattachment (`attachmentId: cluster_counts`) | `plugin.json`, `clusterCounts.js`, `tests/clusterCounts.spec.js` |
| `ClusterExpand` | interaction (`interactionId: cluster:expand`) | `plugin.json`, `ClusterExpand.js`, `tests/clusterExpand.spec.js` |

Design: the type inherits Vector's whole renderer and replaces only `source` — it fetches
the layer's url once, caches the raw features, and returns a grid-clustered (or decimated)
FeatureCollection for the current zoom, with a per-feature `properties.style` sized/coloured
by cluster count and `_clusterCount` / `_clusterBounds` / `_clusterMembers` / `_isCluster`
written onto every emitted feature. `legend.derive` turns the count bins into `_legend`.
`config.normalize` defaults `variables.dynamicExtent: true`, which is what makes core
re-drive `source.fetch` when the view (and therefore the zoom) settles. The attachment draws
a divIcon count label per cluster; the interaction fits the map to `_clusterBounds` (or
publishes members in `list` mode) and stops the pipeline.

**Verified:**
- `npm run plugins -- validate` → all 61 plugins valid.
- `npm run plugins -- activate` registers all three (`src/pre/layertypes.js`,
  `layerattachments.js`, `interactions.js` all contain them; `INTERACTION_CONFIG_PATHS` and
  `APPLICABLE_LAYER_TYPES` picked up `cluster:expand`).
- 20 new unit tests pass (clustering invariants: every source feature counted exactly once,
  coarser zoom ⇒ fewer/larger clusters, single-member cells keep their properties, legend
  bins; attachment `make`/`syncData`/`onConfigChange` against a fake Leaflet; interaction
  `use` against a fake `Map_`).
- `npm run test:unit` → 1041 passed (core unaffected). ESLint clean apart from 4
  `import/no-anonymous-default-export` warnings, which every core plugin module also has.
  (Note `npx eslint` fails to parse anything unless `NODE_ENV` is set — `NODE_ENV=test npx
  eslint …`.)

**NOT verified — I never saw this in a browser.** No Postgres/mission/dense dataset was
stood up inside the time limit. So all of the following is unproven:
- that core calls the `source` surface at all for a type that only `extends` vector
  (I read `LayerCapturer` but did not run it);
- that the dynamic-extent refetch actually re-clusters on zoom rather than only on pan;
- that the attachment's labels land on the clusters and re-sync on each re-cluster;
- that `cluster:expand` is reachable — it is only offered through
  `capabilities.defaultInteractions`, which is the lowest-precedence source, and I could not
  confirm Configure's Interactions tab lists an interaction whose `applicableLayerTypes`
  names a non-core type;
- that the derived legend renders (and I expect it to go **stale**: `derive` runs when the
  LayersTool/LegendTool asks, but nothing re-asks after a zoom-driven re-cluster changes the
  bins, so the legend and the drawn colours can disagree).

## 2. The seams between the families — the actual finding

All three plugins had to agree on **`_clusterCount` / `_clusterBounds` / `_clusterMembers`
feature properties**, and there is no mechanism in the plugin system for that agreement:

- **No cross-plugin import path.** `lib/clustering.js` in the layertype exports
  `CLUSTER_PROPS`, but neither the attachment nor the interaction can import it: webpack
  aliases (`@basics`, `@essence`, `@design`, `@pre`, `@external`) all point into core, there
  is no `@plugins`, and a relative `../../layertypes/ClusteredVector/lib/clustering` reaches
  outside what the manifest declares (nothing validates it, and it breaks the moment a
  consumer is installed from a different container/repo). So I duplicated three string
  constants in two files and left comments pointing at each other. That is the single
  biggest authoring cost of a multi-family feature.
- **No way for one plugin to call another.** The interaction wants to say "expand this
  cluster" to the layer type (which owns the clustering grid and the raw cache) and cannot:
  there is no registry lookup exposed to plugins for another plugin's module, no
  `LayerTypeRegistry` on any documented plugin-facing surface. My workaround is to carry
  every fact the other two need inside the emitted feature's properties — including
  `_clusterMembers`, i.e. the raw features, which is memory I would rather not pay for.
- **State-sharing between the interaction and anything else** is only forward, down the
  pipeline (`ctx.state`), plus writing on `layerData` (`_clusterExpanded`), which is
  undocumented territory — the docs explicitly warn off `_`-prefixed core caches but say
  nothing about a plugin adding its own.
- **Config is three separate subtrees** with no relation: `variables.clustering.*` (layer
  type), `variables.layerAttachments.clusterCounts.*` (attachment),
  `variables.interactions.clusterExpand.*` (interaction). An admin has to enable clustering
  in one tab, the labels in a second and the interaction in a third for one feature to work,
  and nothing tells them the pieces belong together. `minCount` is duplicated in the
  attachment and the interaction because neither can read the other's config (the
  interactions README is explicit that this is forbidden).
- **What I had to read core source for:** the shape of a `_legend` entry
  (`shape`/`color`/`strokecolor`/`value` — I found it in
  `plugins/core/tools/Legend/*.js` around line 426, it is in no README), and whether
  attachment `syncData` is dispatched on a dynamic-extent data update
  (`src/essence/Basics/Layers_/display/sublayers.js:129` `syncSublayerData`, reached from
  `data/geojson.js` on `updateVectorLayer`).
- **What I had to invent:** zoom-driven re-clustering. The layertype README has no "the view
  moved" hook; the only one is `variables.dynamicExtent` + `source.fetch` reading
  `ctx.view.zoom`, which is documented as a *data extent* mechanism, not a level-of-detail
  mechanism. When `ctx.view` is absent I fall back to `window.Map_?.map?.getZoom?.()`, which
  is exactly the kind of global reach the docs tell you to avoid.

## 3. Things that failed silently

- Scaffolding `create layertype` leaves a `map.js` that I no longer declared in `modules`
  after switching to `extends: vector`. `validate` stayed green with an undeclared module
  file sitting in the plugin directory, even though the layertype README says "a module with
  no declared engine is an error" (`plugins/core/layertypes/README.md:67-69`). I deleted it
  by hand.
- My manifest declares `capabilities.renderers.map` with no `modules.map` (inherited).
  Green — correct per `extends`, but indistinguishable from the mistake of forgetting the
  module.
- `capabilities.defaultInteractions.click: ["cluster:expand"]` validates with no check that
  the id exists or is enabled. A typo here is a feature that simply never fires.
- An attachment declaring `applicableLayerTypes: ["clusteredvector"]` — a type from another
  plugin — is not cross-checked either.

## 4. Docs: confusing, missing or contradictory

- `plugins/README.md:1040-1043` says to run plugin tests with `npx cross-env
  PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/…/tests/`, but the scaffolded
  spec files say "Run with `npm run test:plugins:unit`"
  (e.g. the header of every generated `tests/*.spec.js`). There is no `test:plugins:unit`
  script in `package.json`. The scaffold contradicts the README.
- Nothing documents the `_legend` entry shape that the `legend` surface is supposed to
  write (`plugins/core/layertypes/README.md:275-293` says "the shape the LegendTool draws"
  and stops). Core's only `derive` examples delegate to a tool instead of building entries,
  so there is no worked example.
- `plugins/core/layertypes/README.md:228-236` covers dynamic extent as a data-volume
  feature; it is also the only zoom hook, and that is not said anywhere.
- The layertype README's checklist (line ~540) tells you to implement `make` per surface;
  for an `extends`-based type the right answer is "implement nothing on the render surface",
  which is said 400 lines earlier and not repeated where you act on it.
- No README in any family says how two plugins that must cooperate should share code or
  constants. The attachment README's "never read the host's config directly" and the
  interaction README's "never read another interaction's settings" close the obvious doors
  without opening a sanctioned one.

## 5. What I liked

- `extends: vector` is genuinely excellent: a dense-point layer type became three small
  non-render modules and zero renderer code, and it inherited picking, styling, filtering
  and both globes.
- `source.fetch` as "given this, give me GeoJSON" is the right shape — I never touched
  debouncing, staleness or clearing.
- Per-feature `properties.style` winning over configured style is what let the type ship a
  sensible look with no mission configuration at all.
- The attachment contract's "return whatever you like on the attachment object and get it
  back verbatim" made `syncData`/`onConfigChange` trivial (`_config`, `_radius`-style
  stashing).
- The CLI: `create` → `activate` → `validate` is fast, and `activate`'s diff output
  (`+ ltp_clusteredvector__source`, `- ltp_clusteredvector__map`) is exactly the feedback
  needed.
- Interactions being pure `use(ctx)` functions made a real unit test possible in minutes.

## 6. Top 3 recommendations

1. **Give plugins a way to share code and to find each other.** A `@plugins` webpack alias
   (or a manifest-declared `exports` map plus a documented
   `PluginRegistry.get(id).exports`) so a cooperating set can import one module of shared
   constants/helpers, and so an interaction can call the layer type that produced the
   feature it was handed instead of screen-scraping properties. Today the only shared
   vocabulary is duplicated string literals.
2. **Make a multi-family feature installable and configurable as one unit.** A `feature`
   (or `bundle`) manifest that names a layertype + attachments + interactions, enables them
   together, and gives Configure one place to switch the whole capability on — plus
   validation that the ids it references exist. Right now an admin must find three settings
   in three tabs and nothing hints that they belong together.
3. **Add a documented level-of-detail hook to the layertype contract** — e.g. an
   `onViewChange(layerObj, ctx)` on the render surface, or explicit blessing of
   dynamic-extent-as-LOD with the zoom guaranteed in `ctx` — and re-ask `legend.derive`
   after data changes so a derived legend can't go stale. As a close fourth: `validate`
   should flag module files present but undeclared, and unknown ids in
   `defaultInteractions`/`applicableLayerTypes`.
