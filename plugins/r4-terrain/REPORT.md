# r4-terrain — terrain profile feature: plugin-system test report

Branch `devin/r4-terrain-1785892984` pushed (no PR). Container is gitignored so I
`git add -f`'d it. `validate` passes (61 valid), 9/9 plugin unit tests pass,
eslint clean (1 style-warning identical to core's globe modules). **Zero core
changes.** I did NOT open the app in a browser, so treat "it draws/plots" as
unverified — see below.

## 1. What I built & what actually works

One feature = 3 plugins in container `r4-terrain`:

- **layertype `terrainprofile`** — `extends vector`, so it inherits vector's
  Leaflet map renderer, Cesium globe renderer, config/filter/picking for free,
  and I **wrote my own LithoSphere globe renderer** (`globe/lithosphere.js`) that
  draws the line as a free (non-clamped) `vector` layer so it reads as a section
  line above relief.
- **interaction `profile:pick`** — on click, a LineString feature becomes the
  profile; two point-feature clicks become endpoints A/B.
- **tool `TerrainProfile`** — resamples the line, queries elevation per sample
  via the existing `getbands` API (the same one the coordinate readout uses,
  `coordinates.coordelevurl`), and draws elevation-vs-distance as an inline SVG
  (no chart dep). Falls back to vertex Z, else says "no DEM configured" rather
  than plotting nothing.

**Honest status:** static contract is green (validate + unit tests + lint).
**Runtime is untested** — I did not stand up a reference mission, configure a
`terrainprofile` layer, and click features in a browser. So: I'm confident the
modules load and the seam logic is correct (unit-tested), but I have NOT seen the
globe renderer draw or the tool plot a real DEM profile. The globe (the intended
hard part) was **not blocked** at authoring time — the LithoSphere
`renderer.addLayer('vector', …)` path is documented and mirrors core's Vector
module — but "not blocked to write" ≠ "seen working."

## 2. Files

- `layertypes/TerrainProfile/{plugin.json, globe/lithosphere.js, tests/terrainProfile.spec.js}`
- `interactions/ProfilePick/{plugin.json, ProfilePick.js, tests/profilePick.spec.js}`
- `tools/TerrainProfile/{plugin.json, TerrainProfileTool.js, .css, tests/terrainProfileTool.spec.js}`
- `lib/profileStore.js` (shared state — see #3)

## 3. The seams between families — the core finding

**There is no first-class channel for an interaction and a tool to cooperate.**
`ctx.state` lives for exactly one pipeline run; there is no documented
cross-plugin event bus or shared store. So I had to **invent**
`lib/profileStore.js`: a tiny pub/sub kept on `window` (single instance
regardless of how webpack bundles the two plugins). The interaction imports it
and pushes picks; the tool imports it and subscribes. This is the one place I
wanted plugin A to hand data to plugin B and simply could not do it through the
platform.

- layertype ↔ tool: also implicit — the tool reads the picked line's GeoJSON;
  nothing formally binds "this tool serves this layertype."
- What I had to read core source for: how to get elevation at a point
  (undocumented in plugin docs) — found `getbands` + `coordinates.coordelevurl`
  only by grepping `src/essence/.../Coordinates.js`. The layertype/interaction/
  tool docs never mention an elevation/DEM-sampling primitive, which is
  surprising given the globe is terrain.

## 4. Failed silently (green validate, nothing happens)

- The README explicitly warns about this and it's real: `validate` + `activate`
  are happy with a plugin nothing is configured to use. My layertype only does
  anything once a mission's `layer.type` = `terrainprofile`; the interaction only
  runs once a layer names it; the tool only appears once a mission places it.
  None of that is checkable statically.
- Cross-plugin `window` store: if webpack ever code-split these into isolated
  scopes it would silently break with no error — works only because everything
  shares one `window`.

## 5. Docs confusing / contradictory (file:line)

- **The scaffolded layertype unit test does not understand `extends`.**
  `create layertype` generates `tests/<name>.spec.js` asserting
  `if (renderers.map) expect(modules.map).toBeDefined()` and a module per globe
  engine. A type that `extends` (the documented one-file path,
  `layertypes/README.md:71-98`) inherits those modules, so the generated test
  **fails** even though `plugins -- validate` passes. I had to rewrite my own
  generated test. The scaffold should special-case `extends`.
- **Renderer op-model mismatch:** the scaffolded `map.js` header says "Ops run
  before → main → after (make also has afterCommit); a bare function is shorthand
  for { main }", but `layertypes/README.md` (the operations table ~line 107-123)
  describes flat ops (`make`, `render`, `destroy`, …) with no before/main/after.
  Two different mental models in two files I'm told to read together.
- `README.md:584` lists `modules` surfaces as "`map`, `globe.<engine>`, `config`,
  `filter`, `time` and `capture`" — `capture` isn't documented anywhere in the
  layertype README's surface sections; `source`/`legend` (which ARE documented)
  are missing from that same list.
- `plugins -- create layertype` scaffolds map-only (`"globe": false`) and the
  README says `ThreeDTiles` is the smallest globe example — fine — but nothing
  scaffolds the `extends`-a-vector path, which is the recommended one for "draws
  like something MMGIS draws" (README:96-98). The default scaffold actively
  points you at the wrong starting shape for the common case.

## 6. What I liked

- `extends vector` is genuinely great: I got 2D map + Cesium globe + picking +
  filtering for free and only wrote the one renderer I wanted to differ.
  Per-surface, per-engine merge is exactly the right granularity.
- The CLI (`create` → `activate` → `validate`) is fast and the family READMEs are
  unusually candid ("You're not done when validate passes", "click a feature").
- Interactions being a pipeline with phases/order/`applicableLayerTypes`
  enforcement is clean.

## 7. Top 3 recommendations (ranked)

1. **Give multi-family features a supported shared-state / event channel.** The
   single biggest gap: an interaction that feeds a tool has to invent a `window`
   store. A blessed `mmgisAPI` pub/sub keyed by feature-name (or a documented
   "plugin bundle" that ships a layertype+interaction+tool together and shares a
   module) would remove the one thing I had to guess.
2. **Make the scaffolds and their generated tests `extends`-aware.** Offer
   `create layertype --extends vector` that scaffolds the one-file/override
   shape, and generate a contract test that checks the *effective* merged type
   (or skips inherited surfaces) so validate and the unit test agree.
3. **Document the runtime primitives a feature needs, not just the plugin
   contract.** Elevation sampling (`getbands`/`coordelevurl`),
   `L_.selectFeature`, `L_.layers.layer[name].toGeoJSON`, `radiusOfPlanetMajor` —
   I found all of these by grepping core. A short "primitives available to
   plugins" page would turn a lot of source-reading into lookups.
