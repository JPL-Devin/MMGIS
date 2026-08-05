# Field annotations — multi-family plugin report

Branch: `devin/r4-annotation-1785892986` (JPL-Devin/MMGIS), no PR, no core files changed.

## 1. What I built / what actually works

Three plugins in container `plugins/field-annotations/` (gitignored, `git add -f`'d):

- backend `Annotations`: Sequelize model `field_annotations`, `GET /api/annotations/list`, `POST /api/annotations/add`, mounted `s.ensureAdmin(false,false,true)` (public GET, admin write).
- layertype `Annotation` (`typeId: annotation`, `extends: vector`, single `module`): `source.fetch` hits `/api/annotations/list`, styles features, `config.normalize` gives the layer an empty url.
- interaction `AnnotationAdd` (`annotation:add`, main/100, `applicableLayerTypes: ["annotation"]`): on a click with no feature, prompts, POSTs, then `Map_.refreshLayer` on every `type === 'annotation'` layer.

Honest status: **`validate` passes, 10 plugin unit tests pass, `npm run test:unit` (1041) passes — I never saw it in a browser.** No DB, no server run, no mission configured with an `annotation` layer, so the end-to-end loop (click → row → refetch → point appears) is **untested**. Prettier applied; `npx eslint` on the container errors with "Using `babel-preset-react-app` requires NODE_ENV/BABEL_ENV" for every ESM file — a repo lint-config issue, not my code.

## 2. Files

- `backend/Annotations/{plugin.json,plugin.js,routes/annotations.js,models/annotations.js,lib/geojson.js,tests/annotations.spec.js}`
- `layertypes/Annotation/{plugin.json,annotation.js,lib/pure.js,tests/annotation.spec.js}`
- `interactions/AnnotationAdd/{plugin.json,AnnotationAdd.js,tests/annotationAdd.spec.js}`

## 3. The seams — this is where it hurts

- **Nothing connects the three families.** They find each other only by string constants I invented: the URL `/api/annotations` (duplicated in the backend mount and the frontend), and `typeId === 'annotation'` hardcoded in the interaction's refresh loop. There is no "my backend plugin's prefix" lookup on the frontend, and no way for a layertype to declare "this interaction belongs to me".
- **I wanted the layertype to expose a `refresh()` the interaction could call, and could not.** A layertype's module is only reachable via `LayerTypeRegistry`, and nothing in the docs says an interaction may import it — so the interaction reaches around the type and calls `Map_.refreshLayer` on core directly. It also means the interaction knows the type's data lives behind an HTTP endpoint, which is exactly what `source` was supposed to encapsulate.
- **Sharing config across families is impossible.** `ctx.config` is deliberately per-interaction ("Never read another interaction's settings out of `ctx`", interactions README:63) and there is no channel to read the layertype's `variables.annotationColor` from the interaction, or vice versa. My only shared surface was a plain module import (`layertypes/Annotation/lib/pure.js` imported by the interaction) — that works because webpack builds the whole container, but nothing documents it as legitimate and it would break the moment the two plugins live in different containers.
- **I had to read core source** for: whether `source.fetch` is actually wired (`src/essence/Basics/Layers_/capture/LayerCapturer.js:246-310`), the `Map_.refreshLayer` signature (`src/essence/Basics/Map_/Map_.js:529`), and how to get the mission name (`L_.mission`). None of these are in the plugin docs.
- **The backend can't tell the frontend it exists.** No plugin-provided runtime config reaches `window.mmgisglobal`, so if an admin disables the backend the layertype just silently fetches a 404.

## 4. Silent failures

- `defaultInteractions` — used as a real concept in `plugins/README.md:211` ("or a layer type's `defaultInteractions`") — is **not a recognized manifest field**: validate emits "unknown top-level field", keeps it, and it does nothing. Worse, **that warning is printed into the stdout of `validate --json`, making the JSON unparseable**, which broke three of core's own tests (`tests/unit/pluginCli.spec.js:341,350`, `pluginCliE2e.spec.js:740`) until I deleted the field. Any third-party manifest that trips a warning breaks `--json` for everyone.
- `source.fetch` failures are swallowed to a `console.warn` (LayerCapturer.js:206) — a broken backend gives an empty layer, not an error.
- Requiring `plugin.js` in a unit test transitively opens a DB connection (the model imports `API/connection`), printing `infrastructure_error: Unable to connect to the database` in a test that passes. Confusing, and undocumented.

## 5. Docs

- No core layertype uses the `source` surface, so the feature the docs push for API-backed layers (layertypes README:200-257) has zero in-repo example; I had to read `LayerCapturer` to trust it.
- The layertype scaffold is the wrong starting point for `extends` (the README admits this at layertypes/README.md:94-98) — `create layertype` still wrote `map.js` and a `modules.map` manifest I had to delete.
- interactions README:129-134 says a module touching `L_` can't be unit tested and to keep logic in a pure function — true, but the scaffolded spec **imports the module itself** and therefore cannot pass for any real interaction (jquery dies on the stubbed `document`). The scaffold contradicts its own docs.
- Nothing anywhere explains how a frontend plugin should build a URL to its own backend plugin (`ROOT_PATH` handling); I guessed `window.mmgisglobal.ROOT_PATH`.

## 6. What I liked

`extends: vector` + one `source.fetch` really did make a live-data layer a ~30-line plugin; the CLI scaffolds three families in seconds and auto-activates; the backend README's auth section (especially the `AUTH=off` warning) is genuinely good and saved me a wrong gate.

## 7. Top 3 recommendations

1. Give plugins a way to address each other: a documented per-plugin API base (`Plugins.backendUrl('Annotations')`) and a way for an interaction to call its layertype's surface (`LayerTypeRegistry.get(type).source.refresh(layerName)`), so a feature isn't held together by string literals.
2. Make a "feature" a first-class grouping — one manifest field (`feature: "field-annotations"`) that ties a backend + layertype + interaction together, drives `defaultInteractions` for real, and lets them share a config subtree.
3. Ship one worked multi-family example in-repo (a `source`-backed layertype talking to a core backend plugin) and fix the two things that make green output lie: keep warnings off `--json` stdout, and make the scaffolded interaction spec test a pure function instead of importing the module.
