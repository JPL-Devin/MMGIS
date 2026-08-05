# R5 — Sample depot tracking: report on MMGIS's plugin system

Branch: `devin/r5-sampling-1785952364` (pushed, no PR). **Zero core changes.**
`npm run plugins -- validate`, `npm run test:unit` (1060 passed),
`npm run test:plugins:unit` (16 new tests) and eslint are all green.

## 1. What I built / what actually works

Container `plugins/sample-depot/` (gitignored, `git add -f`'d):

- **backend/SampleDepot** — `sample_depots` + `sample_tubes` tables, routes `GET /depots`,
  `POST /depots/add`, `GET /tubes[?depot=]`, `POST /tubes/retrieve`, `POST /tubes/add`.
  **Verified live** against `npm start` + PostGIS with curl: created a depot, added a tube,
  listed it, retrieved it — real rows, real `retrieved_at`, `up()` migrations ran.
- **layertypes/SampleTubes** (`extends vector`, `source.fetch` → the API, plus a
  `legend.derive` that colours retrieved vs on-ground). Unit-tested with a stubbed
  `window.fetch`. **Not seen in a browser** — I never configured a mission layer of
  `type: sampletubes`, so drawing is unverified.
- **interactions/TubeRetrieve** (`main`, order 100, `applicableLayerTypes: ["sampletubes"]`) —
  click a tube → POST retrieve → refetch → `L_.updateVectorLayer`. Empty-map click adds a
  tube when the admin ticks `allowAdd`. Pure `logic.js` unit-tested. **Never clicked in a
  browser.**

So: the write path is proven, the render/click path is not. Blunt version: two thirds of
this is "validate passes", one third is "I saw the JSON".

## 2. Files

```
plugins/sample-depot/lib/depotApi.js                      # shared: routes, prop names, rows→GeoJSON
plugins/sample-depot/backend/SampleDepot/{plugin.json,plugin.js}
                                        models/{depots.js,tubes.js}
                                        routes/sampledepot.js
                                        tests/sampleDepot.spec.js
plugins/sample-depot/layertypes/SampleTubes/{plugin.json,sampleTubes.js,tests/sampleTubes.spec.js}
plugins/sample-depot/interactions/TubeRetrieve/{plugin.json,TubeRetrieve.js,logic.js,tests/tubeRetrieve.spec.js}
```

## 3. The seams

The facts that had to travel were *route paths* and *which property holds what*. I put them
in `lib/depotApi.js` — `API_PREFIX`, `ID_PROP = 'tube_id'`, `RETRIEVED_PROP = 'retrieved'`,
`tubesToGeoJSON()`, `apiUrl()` — and both frontend plugins import it relatively
(`import { ID_PROP } from '../../lib/depotApi'`). **The docs told me to do this**:
plugins/README.md:349-361 ("One feature, several plugins … `lib/` by convention … imported
relatively"), and it is also what makes it testable.

Type → interaction is declarative, as documented (plugins/README.md:369): the type declares
`"capabilities": { "defaultInteractions": { "click": ["tube:retrieve"] } }` and the
interaction declares `"applicableLayerTypes": ["sampletubes"]`, so a mission author never
names the interaction. I did **not** need `defaultAttachments` — this feature has no
attachment, so I didn't invent one to have one.

What the interaction needed to know about the *backend* (route shape, auth, cookie) came
from the shared lib too — not from anything the backend plugin exports, because a backend
plugin exports nothing to the frontend. That is fine within one container and would be a
copy-paste problem across containers.

## 4. Where I wanted to call another plugin and couldn't

**Reloading the layer after the write.** I wanted "re-acquire this layer", i.e. re-run the
layer type's `source.fetch`. There is no such call for a plugin, and the docs say so on
purpose (plugins/README.md:387 "no way to *call* another plugin's operations").
`TimeControl.reloadLayer` is time-specific (it does `layer.time.current = …` and returns
early with no `layer.time`), and nothing in the interactions README mentions a reload at
all. So the interaction **duplicates the fetch** through
`lib/depotApi.fetchTubesGeoJSON()` and pushes the result in with
`L_.updateVectorLayer(ctx.layerName, geojson)` — which I found by reading
`src/essence/Basics/Layers_/capture/LayerCapturer.js:116`, not from any README. It works
only because both plugins are mine; a third-party interaction over someone else's `source`
type could not do this.

## 5. Failed silently

- **`s.stopGuests` bricked the whole mount.** The backend README:64 says "put it *after* an
  `ensure*` on any write route", so I did. Every request — including `GET /tubes` — then
  returned `{"status":"failure","message":"User is not logged in."}` on an `AUTH=none` dev
  instance, because `stopGuests` (scripts/server.js:262) rejects any session with no
  `req.user`. Two traps stacked: it is **per-mount, not per-route** (there is no way to
  apply it to writes only from a plugin mount), and it answers **HTTP 200** with a failure
  body — so my `if (!res.ok) throw` sailed straight past it and the frontend would have
  treated "not logged in" as data. I removed it and left a comment saying why.
- **Backend "unit" test hits the database.** backend/README.md:227-232 says a unit-only spec
  "needs no database", but importing `plugin.js` imports the models, which import
  `API/connection`, which opens a pool at import time: the spec prints an
  `infrastructure_error` Sequelize stack and **passes anyway**. Any real plugin's
  `plugin.js` has models, so that promise is effectively false.

## 6. Docs: confusing / missing / contradictory

- backend/README.md:64 — `stopGuests` needs the `AUTH=off/none` caveat that `ensureAdmin`
  gets at line 116, plus the fact that it is mount-wide.
- backend/README.md:227 — "a unit-only spec … needs no database" (see above).
- backend/README.md:9-14 shows `models/<x>.js`, but `create backend` scaffolds **no
  `models/` directory and no model example** — the one family whose README promises "routes
  and a table" is the one the CLI half-scaffolds.
- The scaffold writes `routes/sampleDepot.js` (camelCase) while every doc example is
  lowercase (`routes/mymodule.js`); I ended up with both files for a minute.
- No doc anywhere answers "I wrote to my backend, how do I make the layer show it?" — the
  single most obvious thing a multi-family feature does.
- The `--extends` layertype scaffold hardcodes a `url` config row and `ctx.url` in `fetch`,
  which is wrong for exactly the case it scaffolds (an API-backed type has no url);
  layertypes/README.md:222 says so ("may have no `url` configured at all") but the scaffold
  doesn't.

## 7. What I liked

`create layertype … --extends vector` is genuinely a one-file data source, and the
scaffolded specs teach the traps (surfaces-not-operations, `config` defaults belong in code,
`browser-globals.js`, `plugin-contract.js` helpers) better than the prose does.
`validate`'s cross-family checks are good: it resolved `sample-depot/backend/SampleDepot` as
a dependency of a *frontend* plugin, and it warned about an unrelated broken core dependency
with the consequence spelled out ("left out of the generated registry and never loads").

## 8. Top 3 recommendations

1. **Give plugins a documented "re-acquire this layer" primitive** (e.g.
   `L_.reloadLayerData(layerName)` that re-runs the type's `source.fetch` and updates every
   surface). Every write-then-reflect feature needs it, and today each one re-implements its
   type's fetch and reaches into `L_.updateVectorLayer`.
2. **Fix the auth story for plugin routes**: make failed gates answer 4xx (or document
   loudly that `res.ok` ≠ success), give `stopGuests` per-route/method granularity, and add
   an AUTH×gate truth table to backend/README.md. Right now the documented-correct mount is
   unusable in dev and fails as a 200.
3. **Make "one feature, several plugins" a first-class CLI step** — `create feature <Name>
   --families backend,layertype,interaction` that emits the container with `lib/`, the
   cross-declared ids (`defaultInteractions`, `applicableLayerTypes`, `pluginDependencies`)
   already wired, a `models/` example, and an E2E stub. I hand-wrote all of that wiring, and
   every id is a silent-drop risk if mistyped.
