# R6 — Live fleet state: a third-party plugin author's report

Branch: `devin/r6-fleet-1785954571` (off `devin/1785790516-finalize-layertype-plugins`)
Container: `plugins/fleet-live/` (gitignored by design; committed with `git add -f`)
Core files modified: **none** (`src/`, `API/`, `configure/`, `plugin-cli/` untouched)
Time box: ~20 minutes of work.

---

## 1. What I built, and what actually works

One feature — live rover fleet state with a persistent store — spread across four
plugins in one container, exactly as `plugins/README.md` ("One feature, several
plugins") prescribes.

| plugin | family | what it does |
|---|---|---|
| `FleetState` | backend | table `fleet_live_state`; `GET /state` (rows → GeoJSON), `POST /report` (telemetry upsert), `POST /note` (operator note) |
| `FleetRovers` | layertype | `extends: "vector"`, a single `module` exporting `source.fetch` that reads `/api/fleetstate/state` and styles each feature by health |
| `FleetPanel` | component | fleet-wide readout pinned top-right, polled from the same endpoint |
| `RoverNote` | interaction | click a rover → `POST /note` → make the layer reflect the write |
| `lib/fleetApi.js` | shared module | the HTTP client *and* the property-name contract the other three agree on |

### What is actually verified

- `npm run plugins -- validate` — **green**, 62 plugins valid (the one dependency
  warning is pre-existing: `core/interactions/ChemistryUse` → `core/tools/ChemistryTool`).
- `npm run test:unit` — **1084 passed**.
- Plugin unit tests (`PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/fleet-live/`) — **11 passed**, including the ones I wrote against `interactions/RoverNote/logic.js`.
- `NODE_ENV=development npx eslint plugins/fleet-live` — **clean**.
- `npm run plugins -- activate` registers all of it: `src/pre/components.js` gains
  `FleetPanel`, `src/pre/interactions.js` gains `interaction_RoverNote_RoverNote`,
  `src/pre/layertypes.js` gains `ltp_fleetrovers__module`.

### What is NOT verified — be blunt about this

**I never saw any of it in a browser.** No server was started, no mission was
configured to use the layer type or place the component, and the database table
was never created (the plugin unit tests run without a DB and log
`Unable to connect to the database` from `API/connection` as they do so). So:

- the layer drawing, and whether the inherited Vector renderer likes what my
  `source.fetch` returns — **untested**;
- the component mounting, and *whether `init(vars)` is even called for a
  component that isn't placed in a mission's config* — **untested**;
- the click → `POST /note` → refresh path, the single most interesting part of
  this feature — **untested end to end**;
- the `up()` migration and `sequelize.sync()` creating `fleet_live_state` —
  **untested**;
- the auth behaviour of the mount under a real `AUTH=off` server — reasoned from
  reading `scripts/server.js:441-470`, not observed.

"Validate passes" here means the manifests and module exports are coherent and
the registries were regenerated. It does not mean the feature works.

---

## 2. Branch and files

Branch: `devin/r6-fleet-1785954571`.

```
plugins/fleet-live/
├── backend/FleetState/
│   ├── plugin.json                 # routes/prefix/auth label, priority, envs: []
│   ├── plugin.js                   # onceInit mount, onceSynced -> up()
│   ├── models/fleetState.js        # fleet_live_state + idempotent up()
│   ├── routes/fleetState.js        # GET /state, POST /report, POST /note
│   └── tests/fleetState.spec.js    # scaffolded manifest/lifecycle unit tests
├── layertypes/FleetRovers/
│   ├── plugin.json                 # typeId fleetrovers, extends vector, defaultInteractions
│   ├── fleetrovers.js              # export default { source: { fetch } }
│   └── tests/fleetRovers.spec.js   # scaffolded contract test
├── components/FleetPanel/
│   ├── plugin.json                 # hasVars, config.rows (refreshSeconds)
│   ├── FleetPanel.js               # init/refresh/destroy, polls + listens for the event
│   ├── FleetPanel.css
│   └── tests/fleetPanel.spec.js
├── interactions/RoverNote/
│   ├── plugin.json                 # rover:note, main/100, configPath + config.rows
│   ├── RoverNote.js                # async use(ctx): post, refresh, notify
│   ├── logic.js                    # pure decide(feature, config) — the tested part
│   └── tests/roverNote.spec.js     # 4 unit tests, 3 of them mine
└── lib/fleetApi.js                 # FLEET_PROPS, HEALTH_COLORS, getFleet, postNote, decorate
```

The scaffold's `layertypes/FleetRovers/map.js` was deleted when I switched the
type to `extends: "vector"` + a single `module`.

---

## 3. Where the system resisted me

### 3a. The write-then-refresh path — no supported way to ask for a re-fetch

This is the finding I care most about, and it is the exact question the task
asked me to report on.

My interaction writes to my backend. The layer must then show the new note. I
looked for the supported way to say *"the data behind this layer changed, please
re-acquire it"* and there isn't one:

- The interaction `ctx` table (`plugins/core/interactions/README.md:47-62`) has
  `feature`, `layer`, `layerName`, `layerData`, `layerVar`, `layerTypeChain`,
  `event`, `eventType`, `additional`, `config`, `state`, `stop`, `Map_`.
  Nothing about reloading. `ctx.Map_` is the singleton, so the capability is
  *reachable*, but as a singleton, not as an interaction API.
- The `source.fetch` `ctx.trigger` vocabulary
  (`plugins/core/layertypes/README.md:230`) is exhaustively
  `'make' | 'view' | 'time'` — "the initial make, a refresh interval, and a time
  change", plus the two dynamic-extent cases. **Every one of them is core-driven
  on a schedule or a user gesture.** There is no trigger for "something wrote".
- `plugins/core/layertypes/README.md:220` even says core keeps "telling reload
  subscribers" to itself — so subscribers exist, and a plugin cannot become one.

What I ended up writing, in `plugins/fleet-live/interactions/RoverNote/RoverNote.js`:

```js
// Make the layer reflect the write. There is no "this layer's data
// changed, re-acquire it" call in the interaction ctx, so we reach for
// the singleton: Map_.refreshLayer(layerObj) is what core's own
// refresh intervals use, and for a source-backed vector layer it ends
// in source.fetch again.
const layerObj = ctx.layerData || L_.layers.data[ctx.layerName]
if (layerObj) await L_.Map_?.refreshLayer?.(layerObj)
```

Three things make me suspect this is wrong:

1. `Map_.refreshLayer` (`src/essence/Basics/Map_/Map_.js:529`) is documented
   nowhere in `plugins/`. I found it by grepping core. Its signature is
   `(layerObj, cb, skipOrderedBringToFront, stopLoops, resolvedUrl)` — four
   parameters whose meaning a plugin author has no way to learn, and whose
   comment at line 548 talks about "manual API calls" as though such callers
   exist but without saying who may be one.
2. The optional chaining (`L_.Map_?.refreshLayer?.()`) is me hedging against an
   interface I have no contract for. If this were supported API I would just call it.
3. `capabilities.map.refreshByRemake` (documented at
   `plugins/core/layertypes/README.md:553`) means Vector — and therefore my type,
   by `extends` — *remakes* rather than reloads on a refresh. So my click may be
   tearing down and rebuilding the whole Leaflet layer to change one note string,
   and the active-feature highlight / open Info panel state may or may not
   survive that. Untested, and I could not find out from the docs which it is.

**What I wanted to express:** `ctx.refreshLayer()` in an interaction, arriving at
`source.fetch` as `ctx.trigger === 'refresh'`. That would be the whole thing.

### 3b. Auth — no gate expresses what I meant

I wanted: *anyone who can use this instance may write an operator note.* Working
through `plugins/core/backend/README.md:96-160` and `scripts/server.js`:

| gate | what happens with `AUTH=off` |
|---|---|
| `s.ensureAdmin()` | unreachable — there is no way to log in (README point 2) |
| `s.ensureAdmin(false, false, true)` | GETs public, but my POSTs are still admin-only, so still unreachable |
| `s.ensureAdmin(false, false, true, true)` | both relaxed — i.e. no gate at all, dressed as one |
| `s.stopGuests` | rejects when the user is a guest **or `AUTH` is `off`** — blocks the very instance I'm developing in |
| `s.ensureUser()` | passes |

So I mounted with `s.ensureUser()`. But reading
`scripts/server.js:441-461` shows why it passes:

```js
if (
  (req.headers.authorization == null && process.env.AUTH != "local") ||
  ...
) { next(); }
```

`ensureUser()` is a **no-op unless `AUTH=local`**. My "security boundary" is
therefore an honest label and nothing more in this instance — which is fine, and
maybe correct, but I arrived at it by reading core, not from the docs. The
backend README states each of these facts individually and never draws the
conclusion "a user-writable plugin route should mount `ensureUser()`".

I left the reasoning in the code so the next reader doesn't have to redo it
(`plugins/fleet-live/backend/FleetState/plugin.js:13-16`).

### 3c. Interaction → component: no channel, so I invented one

`ctx.state` is explicitly scoped to the click pipeline
(`plugins/core/interactions/README.md:64-67`: "one object reused down the
pipeline"). My component is not in any pipeline. `plugins/README.md:370`'s
"plugin → plugin, at runtime" row offers exactly two options: share a module, or
leave something on the layer (`L_.layers.attachments[...]`) — the first is
one-way at import time and the second requires the reader to be polling the layer.

So in `RoverNote.js`:

```js
window.dispatchEvent(new CustomEvent('fleet-live:changed', { detail: result }))
```

and in `FleetPanel.js`:

```js
// The interaction has no way to tell a component anything, so it
// broadcasts a window event and we listen for it.
window.addEventListener('fleet-live:changed', FleetPanel.state.onChanged)
```

I invented the event name and the mechanism. Nothing in the docs sanctions or
forbids it, there is no namespacing convention, and two containers could collide
on an event name with no validation to catch it.

### 3d. Smaller resistances

- **A component has no documented mount point.** The scaffold gives you
  `init(vars)` and a comment. `OperationsClock` is "fixed bottom-center" by CSS
  and appends to the DOM itself. So my component does
  `document.body.appendChild(el)` with `position: absolute; z-index: 1001` and a
  hardcoded `top: 60px` that I picked to clear a toolbar I have not looked at.
  There is no container element, no slot, and no z-index guidance — so two
  third-party components will overlap.
- **`defaultIcon` for a layer type silently degrades.** `plugins/README.md:452`
  says Configure resolves layertype icons against `configure/src/core/layerTypeVisuals.js`
  and *"a name that isn't in that map — including any MDI name — silently falls
  back"*. I picked `Polyline` because it already exists there. Getting a
  distinctive icon for a third-party type requires a core change. The docs are
  admirably honest about this; it is still a wall.
- **Testing a `source.fetch` is not possible in unit tests.** `fleetrovers.js`
  imports `lib/fleetApi.js`, which touches `window` — so the Node unit test path
  can't import it, and the layertype README offers no `runSource`-style harness
  equivalent to the interaction family's `runInteractions(ids, ctx, { handlers, config })`
  (`plugins/core/interactions/README.md:170`). My type's only test is the
  scaffolded manifest-contract one.

---

## 4. The seams between the families

The fact everyone needs: **the property names my layer type puts on each feature** —
`rover` (the identity), `health` (drives colour), `battery`, `note`. Also the
health→colour mapping. Three consumers:

1. **layertype → interaction: the documented way, and it works.** The interaction
   must know which property carries the rover id. `plugins/README.md:369` and
   `plugins/core/interactions/README.md:141-152` say a type configures an
   interaction it ships via `capabilities.defaultInteractions`, so
   `layertypes/FleetRovers/plugin.json`:

   ```json
   "defaultInteractions": {
       "click": { "rover:note": { "idProp": "rover" } }
   }
   ```

   and `interactions/RoverNote/logic.js` reads it as `ctx.config` with its own
   runtime default, as the docs insist:

   ```js
   const { idProp = FLEET_PROPS.id, notePrefix = 'Acknowledged' } = config || {}
   ```

   This is genuinely good: the interaction is written once and behaves the same
   whether my type configured it or an admin typed it into the Interactions tab,
   and the admin never types the property name twice. `validate` also
   cross-checks the id (I confirmed the check exists —
   `tests/unit/pluginCliE2e.spec.js:867` "an unknown default interaction is
   reported in either declaration form").

2. **layertype → component: undocumented; I invented it.** There is no
   `defaultComponents`, and a component is placed by the mission, not by a layer.
   So the names live in `lib/fleetApi.js` as `FLEET_PROPS` and `HEALTH_COLORS`,
   imported by all three frontend plugins. This *is* `plugins/README.md:361`'s
   "code they all need goes in a plain module … `lib/` by convention" — so the
   mechanism is sanctioned; what is not documented is that it is the **only**
   answer for the type→component seam, and that nothing validates it. If I rename
   `health` in the backend, `validate` stays green and the panel goes grey.

3. **backend → layertype: a URL string, agreed by convention.** `lib/fleetApi.js`
   builds `` `${root()}api/fleetstate/state` `` and the backend mounts
   `s.ROOT_PATH + '/api/fleetstate'`. Those two strings must agree and nothing
   checks them. `plugin.json`'s `routes.prefix` documents the mount but
   `plugins/core/backend/README.md:190` says plainly that core does not enforce
   it. The `ROOT_PATH`/no-leading-slash recipe
   (`plugins/core/backend/README.md:~215`) is documented well and I followed it
   verbatim; I would have got it wrong otherwise.

---

## 5. Anything that failed silently

- **Deleting `map.js` left a dangling import in a generated file.** After
  switching to `extends` + `module`, `src/pre/layertypes.js` still imported
  `plugins/fleet-live/layertypes/FleetRovers/map`. `validate` did report it —
  *"imports plugins/fleet-live/layertypes/FleetRovers/map which no longer exists"* —
  but as a **warning** alongside a `✓ All 62 plugin(s) valid` success line, and
  only because I happened to re-run `validate`. Nothing in `create`'s "next
  steps" warns that changing `modules`/`module` invalidates the registry; you
  learn it from `plugins/README.md:347` ("this bites on the *second* change"),
  which is a great sentence but is 300 lines from where you're working.
- **A dependency typo silently unloads a plugin.** `ChemistryUse` is excluded
  from the generated registry repo-wide because `core/tools/ChemistryTool`
  doesn't exist. This is exactly the failure mode `plugins/README.md` warns about,
  and it exists *in the repository right now* — which is itself evidence of how
  easy it is to miss. My four plugins all declare
  `"pluginDependencies": ["fleet-live/backend/FleetState"]`; if I had written
  `core/backend/FleetState` they would all have vanished, with a warning, from a
  command whose last line still says "all valid".
- **A `status: 'failure'` body arrives as HTTP 200.** Documented
  (`plugins/core/backend/README.md`, auth surprise #4) and I handled it in
  `lib/fleetApi.js`'s `unwrap()` — but it is precisely the thing a third-party
  author writing `if (!res.ok)` will get wrong and see as "the write worked and
  nothing happened".
- **The plugin unit-test run prints `infrastructure_error  Unable to connect to
  the database` for every backend spec and still exits green.** Correct
  behaviour, alarming output; a new author will think their test is broken.

---

## 6. Confusing, missing or contradictory docs (file:line)

| where | problem |
|---|---|
| `plugins/core/layertypes/README.md:9` | "core wires your type into … refresh/reload … with no core changes" — but the document never says how a plugin *asks* for a refresh. Combined with `ctx.trigger`'s closed list at line 230, a reader concludes refresh is purely core's, which leaves §3a with no answer. |
| `plugins/core/layertypes/README.md:230` | `ctx.trigger` enumerates `'make' \| 'view' \| 'time'` as if exhaustive. If `Map_.refreshLayer()` is a legitimate plugin call, its trigger belongs in this table; if it isn't, the table should say so. |
| `plugins/core/layertypes/README.md:553` | `map.refreshByRemake` is listed in the capability table with no discussion of what a remake costs (selection state? open Info panel? attachments?). For a live-data type, refresh cost is the design decision. |
| `plugins/core/backend/README.md:96-160` | Four excellent "surprises" about auth that never conclude. Add one line: "for a route real users must write to, `s.ensureUser()`" — and state that `ensureUser()` is a no-op unless `AUTH=local` (`scripts/server.js:455`), which is load-bearing and currently only discoverable by reading core. |
| `plugins/core/backend/README.md:~190` | `routes` is "DESCRIPTIVE ONLY" and `routes.auth` is "a label for humans". Fine — but the manifest then contains a security-looking field that lies if you edit the mount. A `validate` cross-check would be cheap. |
| `plugins/README.md:370` | The "plugin → plugin, at runtime" row covers attachment↔host and pipeline state, but not interaction→component or anything→component. A component is a first-class family with no runtime seam documented at all. |
| `plugin-cli/scaffolds/component/*` (as delivered by `create component`) | `init(vars)` with "Called when the component is initialized" — no statement of *when*, whether `destroy` is ever called, where to attach DOM, or what z-index band to use. Compare the tool scaffold, which hands you `toolPanel`. |
| `plugins/core/interactions/README.md:47-62` | The `ctx` table is the natural place a reader looks for "how do I make my layer update"; its absence there is what sends you into core. |
| `plugins/core/layertypes/README.md` (whole) | No testing section. The interactions README's Testing section (line ~160) is genuinely useful and sets the expectation that each family has one. |

---

## 7. What I liked, and what was easier than expected

- **`extends: "vector"` is the best thing here.** A real live-data layer type is
  15 lines and one manifest key. I got Vector's drawing, picking, styling,
  filtering and both globes for free, and the docs' framing —
  *"a new data source is usually a `config` surface … rather than a renderer at
  all"* (`plugins/core/layertypes/README.md:~115`) — steered me straight to
  `source.fetch` and away from writing a renderer I'd have got wrong.
- **`source.fetch` is a genuinely well-drawn boundary.** "Given this, give me
  GeoJSON", with the extent, debounce, staleness and reload bookkeeping staying
  core's. Easy to reason about, easy to get right.
- **Styling without a renderer.** The precedence table
  (`plugins/core/layertypes/README.md:~270`) let me colour by health entirely
  from inside `fetch` by writing `properties.style` — no `setStyle`, no mission
  config, no core interaction.
- **The `logic.js` / handler split.** The scaffold *pre-splits it for you* and
  explains why in a comment. Writing a real unit test took two minutes, which is
  the highest ratio of value to effort in the whole system.
- **`validate`'s cross-family checks** caught my stale registry import and would
  have caught a bad `defaultInteractions` id. Better than I expected from a
  manifest linter.
- **The CLI generally.** `create` scaffolding four families, auto-running
  `activate`, and printing accurate next steps — including the honest note that
  the files won't appear in `git status` — is a good authoring experience.
- **The docs' tone.** They repeatedly tell you where the system is weak
  ("you're not done when `validate` passes", the icon fallback, the 200-with-
  failure-body). That honesty is worth a lot, and it is why the gaps above are
  worth naming rather than shrugging at.

---

## 8. Top 3 recommendations, ranked

1. **Give plugins a supported way to invalidate a layer's data.** Add
   `ctx.refreshLayer()` to the interaction context (and the equivalent to
   components / tools), surface it to `source.fetch` as
   `ctx.trigger === 'refresh'`, and document what a refresh preserves
   (selection, open panels, attachments) versus what `refreshByRemake` destroys.
   Today every write-then-show feature — the obvious reason to write a backend
   plugin at all — must reach into `Map_.refreshLayer`, a five-parameter core
   internal, and hope.
2. **Conclude the backend auth section.** One recommended gate per intent
   (public read; user write; admin-only), the fact that `ensureUser()` is inert
   unless `AUTH=local`, and a worked "user-writable route in an `AUTH=off` dev
   instance" example. Right now the honest enumeration of four surprises leaves
   the author to synthesise a policy from core source, which is the one thing a
   security boundary should not require.
3. **Document a runtime plugin→plugin notification channel, and a component's
   contract.** Either bless namespaced `window` CustomEvents (with a naming rule
   tied to the container) or provide a small bus; and specify when `init(vars)`
   runs, whether `destroy()` is called, where a component may attach DOM, and
   which z-index band is its own. These are the two places I had to invent
   something and cannot tell whether I invented it wrongly.
