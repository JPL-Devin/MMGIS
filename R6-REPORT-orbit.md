# R6 — Observation swath planning against a live catalogue

Third-party author's report on building one feature across three plugin families
(plus a backend for the catalogue itself) on top of
`devin/1785790516-finalize-layertype-plugins`.

Branch: `devin/r6-orbit-1785954570`. No core files modified.

---

## 1. What I built, and what actually works

One container, `plugins/swath-planning/`, holding four plugins and a shared lib.

| plugin | id | what it does |
|---|---|---|
| `layertypes/SwathCatalogue` | `typeId: swathcatalogue`, `extends: vector` | `source.fetch` pages through a POST-only catalogue for the current viewport; `config.expand` defaults `variables.dynamicExtent: true` |
| `layerattachments/SwathLook` | `attachmentId: swath_look` | an arrow from each swath's centre showing its roll/look direction, with a `left/right NN°` tooltip |
| `interactions/SwathConflicts` | `interactionId: swath:conflicts` (main, order 200) | on click, computes footprint overlaps against the other swaths currently in view; leaves the result on `ctx.state.swathConflicts` and opens a popup |
| `backend/SwathCatalogueAPI` | — | the made-up catalogue: `POST /api/swathCatalogueAPI/search` with body `{bbox, page, pageSize, time}` → `{page, pages, total, features}` |
| `lib/swathGeometry.js` | — | bbox/centroid/overlap/look-vector maths, imported relatively by all three frontend plugins, free of `src/essence` so it is unit-testable |

### Verified

- `npm run plugins -- validate` — green, 62 plugins, the only warning is the
  pre-existing `core/interactions/ChemistryUse` → `core/tools/ChemistryTool`
  dependency warning that is there on the base branch too.
- `npm run test:plugins:unit` — 15 new `@unit` tests pass, including the one
  that matters most: `fetch` issues three POSTs for a three-page response, sends
  the viewport bbox in the body, and returns the concatenated features.
- `npm run test:unit` — 1084 pass with my container present (and 1084 with it
  removed, so I add no core-test regressions).
- `NODE_ENV=development npx eslint plugins/swath-planning --ext .js` — clean.
  (Without `NODE_ENV` set, eslint fails to parse *every* file with a
  `babel-preset-react-app` error — worth knowing before you conclude a plugin is
  broken.)
- The backend route driven over real HTTP by mounting it in a bare Express app:
  `bbox [-10,-5,10,5]`, `pageSize 5` → `total 45, pages 9, 5 features`, first
  feature `{swath_id: "SW-165", look_azimuth: 345, roll_deg: 16,
  look_direction: "right", start_utc: "2026-06-15T…", duration_s: 135}`.

### NOT verified — be blunt about this

I never loaded MMGIS in a browser. No PostGIS container, no mission, no layer
of `type: swathcatalogue` configured, so:

- I have not seen a single swath drawn.
- I have not seen the look-direction arrows.
- I have not clicked a swath, so the popup, `swathsInView()`'s use of
  `L_.layers.layer[layerName]` and `Map_.map.getBounds()`, and the pipeline
  placement of `swath:conflicts` are **unproven**.
- I have not watched a pan/zoom trigger a re-request, which is the single most
  important behavioural claim in this feature.

Everything above the line is a contract check. "Validate passes" is exactly what
the docs warn it is (`plugins/README.md:335`, "You're not done when `validate`
passes") and that is honestly where this stands for the rendering half.

The parts I would bet on: `source.fetch`'s request shaping and paging (directly
tested), the conflict maths (directly tested), the arrow geometry (directly
tested against a Leaflet stub), and the backend (tested over HTTP). The parts I
would not: anything that requires the app's globals.

---

## 2. Branch and files

Branch `devin/r6-orbit-1785954570`, off
`devin/1785790516-finalize-layertype-plugins`. The container is gitignored, so
it is `git add -f`'d onto the branch.

```
plugins/swath-planning/
├── lib/swathGeometry.js
├── layertypes/SwathCatalogue/
│   ├── plugin.json
│   ├── swathCatalogue.js
│   └── tests/swathCatalogue.spec.js
├── layerattachments/SwathLook/
│   ├── plugin.json
│   ├── swathLook.js
│   └── tests/swathLook.spec.js
├── interactions/SwathConflicts/
│   ├── plugin.json
│   ├── SwathConflicts.js
│   ├── logic.js
│   └── tests/swathConflicts.spec.js
└── backend/SwathCatalogueAPI/
    ├── plugin.json
    ├── plugin.js
    ├── routes/swathCatalogueAPI.js
    └── tests/swathCatalogueAPI.spec.js
```

(I deleted the scaffolded `backend/SwathCatalogueAPI/models/` — the scaffold's
own comment says a plugin that stores nothing should, and this one stores
nothing.)

---

## 3. Where the system resisted

**No core change was needed.** That is the headline: a viewport-bound, paged,
POST-with-a-body data source is expressible entirely in a plugin. `source.fetch`
hands you `ctx.view` / `ctx.time` / `ctx.trigger` / `ctx.dynamicExtent` and keeps
the extent watcher, debounce, settling, zoom gate, request staleness, the move
threshold, layer clearing and reload subscribers in core. That division is
correct and it is the best thing about the layertype family.

Four places it pushed back anyway.

### 3.1 A POST source loses url resolution, and has to re-implement it

`ctx.url` is documented as "the layer's url with time placeholders resolved and
mission-relative paths made absolute" (`plugins/core/layertypes/README.md:229`).
For a POST source the endpoint is not a `url` in the layer's sense — there is no
GET to make — so I put it in my own `variables.swathCatalogue.endpoint`, and
`ctx.url` is `''`. Which means I re-implement, badly, what core already does:

```js
// plugins/swath-planning/layertypes/SwathCatalogue/swathCatalogue.js
const endpointOf = (layerObj) => {
    const raw = layerObj?.variables?.swathCatalogue?.endpoint || DEFAULTS.endpoint
    if (/^https?:\/\//.test(raw) || raw.startsWith('/')) return raw
    const root = window.mmgisglobal?.ROOT_PATH || ''
    return `${root.replace(/\/$/, '')}/${raw}`
}
```

This is the thing I most suspect is wrong. `window.mmgisglobal.ROOT_PATH` is an
app global a plugin arguably should not be reading, my version handles none of
the cases core's does (time placeholders, `Missions/…` relative paths, the
`IS_DOCKER` branch Tile's `resolveUrl` cares about at
`plugins/core/layertypes/README.md:187-191`), and every future non-GET source
will write the same twenty lines slightly differently.

`config.resolveUrl` is not the escape hatch: it only gets the last word on a url
**core is about to fetch**. There is no "resolve this string for me, I'll do the
transport" call. The alternative — putting the endpoint in the layer's real
`url` field and letting `ctx.url` carry it — feels like it should be the
intended path, but nothing in the docs says a `source`-backed type may do that,
and `plugins/core/layertypes/README.md:225` explicitly says "A `source`-backed
type may have no `url` configured at all", which reads like the opposite advice.
I could not tell which was intended.

### 3.2 `fetch` is all-or-nothing, so paging cannot stream

`fetch` returns one FeatureCollection
(`plugins/core/layertypes/README.md:214`). With a paged API that means draining
every page before anything reaches the map:

```js
while (page < pages && page < maxPages) {
    const res = await window.fetch(url, { method: 'POST', … })
    …
    pages = Number(body.pages) || 1
    page += 1
}
```

Sequential (the page count is only known after page 0), and nothing paints until
the last one lands. My only lever is `maxPages`, which is a **silent
truncation**: the user sees a plausible map that is missing swaths, with no
indication. A source that could `yield` pages, or call a `ctx.emit(features)`,
would fix both the latency and the truncation.

Related: core owns request staleness, which is right — but I cannot tell from
inside `fetch` whether my own in-flight page loop has been superseded by a newer
view. If core aborts me, pages 3..9 of the stale view are still being requested.
An `AbortSignal` on `ctx` would settle it. I looked for one; there isn't one in
the documented `ctx` table.

### 3.3 `dynamicExtent` is a layer setting for a type-level fact

`plugins/core/layertypes/README.md:238-243` is explicit and it is right that this
is awkward: a viewport-driven source only works if the *layer* sets
`variables.dynamicExtent: true`, which a type cannot declare. The
documented workaround is to default it in `config.expand`, which I did:

```js
function expand(layerObj) {
    layerObj.variables = layerObj.variables || {}
    if (layerObj.variables.dynamicExtent == null)
        layerObj.variables.dynamicExtent = true
    return layerObj
}
```

But `expand` is documented as "how one configured layer becomes many"
(`:170`) and using it to poke a default into `variables` is a side effect, not
an expansion. It also means an admin who unticks the box in my Configure row
gets a layer that fetches the whole world and never re-requests, with no warning.
A `capabilities.requiresDynamicExtent: true` — or simply letting a type declare
layer-config defaults — would express what I actually mean.

### 3.4 The bbox has no stated CRS or units

`ctx.view` is `minx/miny/maxx/maxy` plus `zoom/tilt/center/source`, and
`ctx.crsCode` is "the mission's CRS code without its `EPSG:` prefix"
(`:231-233`). Nothing says what units `minx…maxy` are in. I assumed lon/lat
degrees because the README's own OGC example passes them straight into a `bbox`
query parameter (`:250-257`). On a projected planetary CRS I would be sending
metres to an API expecting degrees and would never know — my request would
succeed and return nothing.

---

## 4. The seams between the families

The facts my layer type knows and the other two need are all **property names**,
plus one derived number.

| fact | who needs it | how it travels |
|---|---|---|
| `look_azimuth` | attachment | `capabilities.defaultAttachments.swath_look.azimuthProp` |
| `roll_deg` | attachment **and** interaction | `defaultAttachments.swath_look.rollProp` and `defaultInteractions.click["swath:conflicts"].rollProp` |
| `look_direction` | attachment | `defaultAttachments.swath_look.sideProp` |
| `swath_id` | interaction | `defaultInteractions.click["swath:conflicts"].idProp` |
| `conflicts` (count) | styling, and as a cheap prior for the interaction | written into `feature.properties` by `source.fetch` |

The manifest side is straight out of the docs (`plugins/README.md:373-396`, "the
settings problem the last two rows solve is worth spelling out"). It works
exactly as advertised and it is the single best design decision in the plugin
system: the property names live once, in the manifest of the plugin that knows
them, and neither consumer reads the other's config. Both consumers still apply
their own runtime defaults, so they work standalone on a hand-configured
`vector` layer too — which the docs also tell you to do
(`plugins/core/interactions/README.md:124-126`).

```jsonc
// layertypes/SwathCatalogue/plugin.json
"capabilities": {
  "defaultAttachments": {
    "swath_look": { "azimuthProp": "look_azimuth", "rollProp": "roll_deg",
                    "sideProp": "look_direction", "lengthDeg": 0.6 }
  },
  "defaultInteractions": {
    "click": { "swath:conflicts": { "idProp": "swath_id", "rollProp": "roll_deg" } }
  }
}
```

**The part I invented.** `fetch` computes an overlap count per feature and writes
it to `properties.conflicts`:

```js
conflictCountsFor(features).forEach((count, i) => {
    features[i].properties.conflicts = count
})
```

Nothing documents "derive properties in `fetch` for other plugins to read" as a
seam. The nearest thing is the styling advice at
`plugins/core/layertypes/README.md:280` ("the cheapest way to style live data is
to compute the property you want to style by in `fetch`"), which is about the
*renderer* reading it, not a sibling plugin. It happens to be the right shape —
it is data, not a call, and `plugins/README.md:400` says a plugin that needs
another's work "should read what it left behind rather than invoke it" — but I
extended that rule from interactions/attachments to layer-type-produced feature
properties on my own. Worth documenting explicitly, because the alternative
(having the interaction recompute geometry per click) is what a less careful
author would write.

The one seam I could **not** express declaratively: the interaction needs "the
other swaths in the current view", and there is no `ctx` field for the host
layer's features. I read them off the live Leaflet layer:

```js
const layer = L_.layers.layer?.[ctx.layerName]
l.eachLayer((sub) => { if (sub.feature) … })
```

`ctx.layerData` is the *config*, not the data. This is the only place I touch a
singleton, and it is the reason the handler cannot be unit tested. A
`ctx.features` (or `L_.getLayerGeoJSON(name)` in the documented `ctx` table)
would remove it.

---

## 5. What failed silently

1. **`applicableLayerTypes` pointing at the wrong type.** The scaffolds hand you
   `["vector", "vectortile", "query"]` (interaction) and `["vector", "query"]`
   (attachment). With those left as-is and my type declaring both in
   `defaultAttachments` / `defaultInteractions`, `validate` was **green** and the
   plugins would simply never be offered on a `swathcatalogue` layer — the
   attachment is filtered out of the host's list, the interaction is dropped by
   the runner. `plugins/README.md:398` says "`validate` warns when a declared
   default can never apply" and `tests/unit/pluginCliE2e.spec.js:837` tests
   exactly that check ("a declared attachment that refuses this type as a host is
   reported"), so the check exists — but I never saw the warning fire for my
   container. I fixed the manifests before investigating why, so I cannot say
   whether the check missed my case or I misread the output; either way, the
   failure mode is "everything green, nothing appears", which is the worst kind.
2. **`dynamicExtent` unticked** → `ctx.view` is `null`, my `bboxOf` falls back to
   `[-180,-85,180,85]`, the layer fetches once and never re-requests. No error,
   no console warning, a map that looks fine and is silently static.
3. **`maxPages` truncation** (§3.2) — missing data, no signal.
4. **An anonymous default export.** `export default { make, syncData }` — which
   is literally what the layerattachments README's worked example shows
   (`plugins/core/layerattachments/README.md:390`) — trips
   `import/no-anonymous-default-export` in the repo's own eslint config. Only a
   warning, and only visible if you know to set `NODE_ENV` first, so it is
   effectively silent. The README example and the lint config disagree.
5. **A flaky core test.** On one run, `tests/unit/updateInteractions.spec.js:126`
   ("invalid interaction is skipped, valid ones still registered") failed while
   my container was present; on three subsequent runs, with and without the
   container, it passed and the full suite was 1084/1084. That spec installs
   fixture plugins into a real container and regenerates `src/pre/interactions.js`,
   so I suspect it races against a concurrent `plugins -- activate` (I had one
   running) rather than being caused by my plugins — but I could not reproduce it
   to prove that, and I am flagging it rather than calling it unrelated.

---

## 6. Docs: confusing, missing or contradictory

- **`plugin-cli/scaffolds/layertype-extends/plugin.json:71-72`** (and
  `plugin-cli/scaffolds/layertype/plugin.json:77`) scaffold a Configure row
  `{"field": "url", "name": "Service URL"}`. For the case the README says
  `source` exists for — "a `POST` body, request headers, pagination, an SDK"
  (`plugins/core/layertypes/README.md:216-218`) — that row is dead config that
  an admin will fill in and nothing will read. The `--extends` scaffold in
  particular starts you at `source.fetch` *and* gives you a url row; those two
  defaults contradict each other.
- **`plugins/core/layertypes/README.md:225`** — "A `source`-backed type may have
  no `url` configured at all" — versus **`:229`**, where `ctx.url` is the only
  path to core's url resolution. Neither says whether a POST endpoint *should*
  live in `url` (to get resolution for free) or in the type's own `variables`.
  This is §3.1 and it is the single doc gap that cost me the most time.
- **`plugins/core/layerattachments/README.md:184-185`** says `syncData` is given
  "the new `geojson`, `onlyClear`, and — as `make` got them — `layerObj`,
  `config` and `zIndex`, so a redraw needs nothing stashed". The worked example
  30 lines later stashes anyway, with a comment asserting the opposite:
  `// Kept for syncData below, which is handed new data but not the config.`
  (`:372-373`). One of the two is wrong; I hedged and wrote
  `config || attachment._cfg`, which is exactly the defensive noise good docs
  should prevent.
- **`plugins/core/layertypes/README.md:227-236`** — the `ctx` table for `source`
  gives no units/CRS for `view`, and no abort signal (§3.2, §3.4).
- **`plugins/core/layertypes/README.md:214`** describes `fetch` as running on
  "each dynamic-extent view change" but the `trigger` row at `:230` is where you
  learn `'view'` and `'time'` exist. Fine once read twice; the table row is
  ~90 words in one cell and is the densest thing in the document.
- **Missing entirely:** how an interaction gets its host layer's *features*
  (§4). The `ctx` table (`plugins/core/interactions/README.md:45-59`) has
  `layerData` (config) and `layer` (the clicked feature's Leaflet layer) and
  nothing for "the layer's data", so an interaction that reasons about more than
  one feature has to reach into `L_.layers.layer` with no guidance on its shape
  (it can be an array; sublayers may be markers or paths; the docs say nothing).
- **Small but real:** nothing warns that eslint fails on every plugin file
  without `NODE_ENV`/`BABEL_ENV` set. The "Validate and test" instructions in
  `plugins/README.md` mention `validate` and the unit tests, not lint.

---

## 7. What I liked, and what was easier than expected

- **`--extends vector` is excellent.** One command, one file, and I inherited
  drawing, picking, styling, filtering and both globes. `plugins/core/layertypes/README.md:71-113`
  is the clearest section in the whole documentation set, and the "per operation,
  not per surface" merge is exactly the semantics you want.
- **`defaultAttachments` / `defaultInteractions` solve a real problem.** The
  README anticipates precisely the mistake I was about to make (have the layer
  type write into the attachment's `configPath`) and gives the right answer in
  the same breath. Three plugins, one declaration of each property name, no
  cross-reads, and both consumers still work standalone.
- **The scaffolds are honest.** `create interaction` giving you a `logic.js`
  beside the handler, with a comment explaining that the handler will become
  un-importable the moment it touches `L_`, meant my unit tests wrote
  themselves. `tests/helpers/plugin-contract.js` (`manifestOf`,
  `unresolvedModules`) is a small thing that catches a whole class of typos.
- **`ctx` on `source.fetch` gave me more than I expected**: extent, zoom, time
  window with a `requery` flag, filters, spatial filter, CRS code, and a
  `trigger` that distinguishes the initial make from a view settle. I computed
  almost nothing myself — the bbox came straight out of `ctx.view`, the time
  window straight out of `ctx.time`. The *only* things I had to compute were the
  endpoint url (§3.1) and my own paging loop.
- **Zero core changes**, for a feature that spans three families and a backend.
  That is the system working.

---

## 8. Top 3 recommendations, ranked

1. **Close the url gap for non-GET sources.** Either document that a
   `source`-backed type should put its endpoint in the layer's `url` and rely on
   `ctx.url` (and delete the "may have no url at all" sentence, or qualify it),
   or add `ctx.resolveUrl(raw)` so a plugin can get core's resolution — time
   placeholders, mission-relative paths, the Docker branch — without core doing
   the transport. Today every POST/SDK/header-auth source will hand-roll
   `window.mmgisglobal.ROOT_PATH` string surgery, and each one will be subtly
   wrong in a different deployment.
2. **Let `source.fetch` deliver incrementally, and give it an `AbortSignal`.** An
   async generator, or a `ctx.emit(features)` callback, turns a paged catalogue
   from "blank map until page 9" into progressive draw and removes the
   `maxPages` silent-truncation footgun. The signal lets a plugin stop paging a
   view the user has already left — core already knows the request is stale, it
   just cannot tell me.
3. **Give an interaction access to its layer's features, and make the
   type↔consumer type mismatch loud.** (a) Add `ctx.features` (or a documented
   `L_` accessor) so an interaction that reasons about more than the clicked
   feature does not reach into `L_.layers.layer` — that reach is also what makes
   the handler untestable. (b) Make `validate` *error*, not warn, when a
   container's layer type declares a `defaultAttachment`/`defaultInteraction`
   whose `applicableLayerTypes` excludes that `typeId`; green-validate plus
   nothing-appears (§5.1) is the failure this whole exercise found most easily.
