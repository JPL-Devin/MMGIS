# r4-seismic — plugin-system field report

Branch: `devin/r4-seismic-1785892982` — container `plugins/r4-seismic` (`git add -f`'d).

## 1. What I built / what actually works

- **layertype `seismic`** — `extends: vector`, one module: `source.fetch` (live FDSN/USGS `format=geojson`, bbox from `ctx.view`, `starttime/endtime` from `ctx.time`, `mag`→`properties.magnitude`, coord[2]→`properties.depth_km`, `time_iso`) + `config.normalize` (defaults `dynamicExtent: true`, style `color: prop-magnitude`, and the ring attachment's config).
- **layerattachment `magnitude_rings`** — `L.circle` per event, radius `scale·2^mag`, depth-banded colour, `syncData` rebuild (hot path: refetch on every pan), `onConfigChange` retune.
- **interaction `seismic:summary`** — click → popup summary + highlights events within ±N min *and* their rings.

**Verified:** `plugins -- validate` clean, `activate` puts all three in `src/pre/*`, 11 new `@unit` tests pass, `npm run test:unit` 1041 pass, eslint clean (warnings only, see 5). I hit the real USGS endpoint with curl and confirmed the response shape my `normalizeEvents` assumes.

**NOT verified — I never saw it in a browser.** No mission was configured, no server started. So: whether `source.fetch` is actually dispatched for an `extends`-ing type, whether `config.normalize` runs, whether `prop-magnitude` styling works, whether Configure renders my rows, whether my popup fights `info:open` (both are `main`; mine is order 150) — all unknown. Treat the runtime as untested.

## 2. Files

- `layertypes/Seismic/{plugin.json,seismic.js,lib/usgs.js,tests/seismic.spec.js}` (scaffolded `map.js` deleted — wrong start for `extends`)
- `layerattachments/MagnitudeRings/{plugin.json,magnitudeRings.js,lib/rings.js,tests/magnitudeRings.spec.js}`
- `interactions/SeismicSummary/{plugin.json,SeismicSummary.js,lib/summary.js,tests/seismicSummary.spec.js}`

No core files changed.

## 3. The seams — the weakest part

- **Nothing links the three.** No manifest way to say "this feature is these three plugins". `pluginDependencies` exists for interactions (core uses `core/tools/Draw`) but is undocumented for a layertype needing an attachment/interaction. My workarounds: the layertype declares `capabilities.defaultInteractions.click: ["seismic:summary","info:open"]` (documented, good), and — the ugly one — its `config.normalize` **writes another plugin's `configPath`** (`variables.layerAttachments.magnitudeRings`) to turn the rings on by default. A string literal from another plugin's manifest, in mine; renaming the attachment's `configPath` silently breaks the layertype.
- **Interaction → attachment.** `ctx` has no handle on attachments. I had to read `plugins/core/layerattachments/README.md:73` to learn rings live at `L_.layers.attachments[host].magnitude_rings` (`attachmentId` doubling as `sublayerKey`) — nothing in the interactions docs mentions this. And there is **no per-feature index**, so I invented a private contract: the attachment stamps `_seismicFeatureId`/`_seismicBaseStyle` on each ring and the interaction re-derives the map by `eachLayer`. Two plugins that must ship together, coupled by an undocumented underscore field.
- **Wanted and couldn't:** import one plugin from another. `ringRadiusMeters`/`depthColor` are **duplicated verbatim** in `layertypes/Seismic/lib/usgs.js` and `layerattachments/MagnitudeRings/lib/rings.js` because there's no supported cross-plugin (or per-container) import path. Also wanted to *ask* the attachment for a feature's ring rather than scan its layer group.

## 4. Silent failures

- `kindAlias: "seismic"` (a string) → `validate` errored, but the very next `plugins -- activate` **exited 0** and just dropped the interaction from `src/pre/interactions.js` with a grey `-` in a 60-line list. If you run `create` → edit → `activate` without `validate`, you get a green terminal and an interaction that never fires.
- `config.normalize` writing a foreign `configPath` fails silently by construction if that path ever changes.

## 5. Docs issues

- `plugins/core/interactions/README.md:81` mentions `kindAlias` but never says it is an **array** of legacy kind strings; the scaffold omits it. The validator's message is good; the doc isn't.
- The scaffolded interaction spec **imports the handler module**, which contradicts `plugins/core/interactions/README.md:129-134` ("importing it in a Node test fails on the first alias"). Any interaction that touches `L_` — most — must rewrite the spec it was given. I did.
- The scaffolded layertype spec asserts `modules.map` is defined; for an `extends` type with a single non-render `module` that assertion passes only via its `module ? {map: module}` fallback, i.e. it "passes" for the wrong reason.
- `npx eslint plugins/...` dies with a Babel parsing error unless `NODE_ENV` is set — worth a line in the "Validation" section.
- The scaffolds' own `export default { make }` trips the repo's `import/no-anonymous-default-export` lint rule (5 warnings, all from following the docs' worked example verbatim).

## 6. Liked

`extends: vector` + the `source` surface really is a ~50-line plugin for live data — core keeping extent/debounce/staleness/zoom-gate was the single biggest win. Attachment core defaults meant 70 lines for the rings. `layertypes/README.md:264-273` (styling precedence, `prop-<name>`) answered exactly the question I had. The "You're not done when `validate` passes" table set correct expectations, and the CLI's next-steps output is genuinely useful.

## 7. Top 3 recommendations

1. **A feature/bundle manifest** spanning families: cross-family `requires` + one place to declare default config for the plugins it bundles, so a layertype never hardcodes another plugin's `configPath`. Validate it (missing sibling = error, not a quiet no-op).
2. **Make attachments addressable from an interaction**: `ctx.attachments` plus a documented per-feature lookup (`attachment.forFeature(id)` or core-maintained `attachment._byFeatureId`), so cooperating plugins stop inventing underscore fields.
3. **A per-container shared-lib import** (e.g. `@plugin/<container>/lib/...`) to kill the copy-paste, and three small fixes: document `kindAlias` as an array, make `activate` non-zero/loud when it drops a plugin, and ship `extends`-aware layertype and singleton-aware interaction scaffolds/specs.
