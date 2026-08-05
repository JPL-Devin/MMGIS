# R6 — Mission events on the map and on the clock

A third-party stress test of the MMGIS plugin system: one feature built as four
plugins in one container, written only from `plugins/README.md` and the family
READMEs, with no core changes.

- Branch: `devin/r6-timeline-1785954581`, off `devin/1785790516-finalize-layertype-plugins`
- Container: `plugins/mission-events/` (gitignored by design, force-added to the branch)
- Core files changed: **none** (`src/`, `API/`, `configure/`, `plugin-cli/` untouched)

---

## 1. What I built, and what actually works

**The feature.** Discrete mission events (drives, drills, anomalies) that each
occupy a span of time: a time-aware layer type for the events, an attachment
drawing each event's duration as a halo that grows with the playhead, a click
interaction that moves the mission clock to the event, and a tool listing the
events inside the current time window.

**What is verified:**

| check | result |
|---|---|
| `npm run plugins -- validate` | green — 62 plugins valid; the single warning (`core/interactions/ChemistryUse` depends on a missing `core/tools/ChemistryTool`) is pre-existing on the base branch and not mine |
| `npm run plugins -- activate` | regenerates all four registries with my plugins in them |
| my `@unit` tests (`PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/mission-events`) | 11 passed |
| `npm run test:unit` | 1084 passed |
| `NODE_ENV=test npx eslint plugins/mission-events` | clean |

**What is NOT verified.** I never configured a mission with a `missionevents`
layer and never opened the app. So: the layer has never been drawn, the halo has
never been rendered, no feature has ever been clicked, the tool panel has never
been opened, and the availability histogram has never been attempted against a
running TimeUI. Everything below the manifest level is "compiles, lints, and its
pure logic is unit-tested" — nothing more. Concretely, the parts I would expect
to break first in a browser are, in order: (a) the histogram, which I can already
tell from core's source will silently do nothing (§3), (b) the tool's
`toGeoJSON()` guess at where a live layer's features are (§5), and (c) the exact
positional call into `TimeControl.setTime` (§3).

Nothing was watered down: all four plugins exist, each does its own job, and they
reach each other only through documented, declarative seams.

---

## 2. Branch and files

Branch: **`devin/r6-timeline-1785954581`**

```
plugins/mission-events/
├── lib/
│   ├── eventTime.js            # eventDurationSec, eventProgress, inWindow,
│   │                           #   windowForEvent, DEFAULT_START_PROP,
│   │                           #   DEFAULT_END_PROP, DURATION_PROP — imports
│   │                           #   nothing from src/essence, so it is the part
│   │                           #   every family shares and the part tests import
│   └── eventsInWindow.js       # pure selection of events overlapping a window
├── layertypes/MissionEvents/
│   ├── plugin.json             # typeId "missionevents", extends "vector",
│   │                           #   capabilities.time.histogram, defaultAttachments,
│   │                           #   defaultInteractions, supportedData, config tab
│   ├── missionEvents.js        # surfaces: config.normalize, source.fetch,
│   │                           #   time.applyTimeParams
│   └── tests/missionEvents.spec.js
├── layerattachments/EventHalo/
│   ├── plugin.json             # attachmentId "event_halo",
│   │                           #   configPath variables.layerAttachments.eventHalo,
│   │                           #   applicableLayerTypes ["missionevents"],
│   │                           #   host.order 100, Configure rows
│   ├── eventHalo.js            # make / syncData / onConfigChange / destroy
│   └── tests/eventHalo.spec.js
├── interactions/EventSeek/
│   ├── plugin.json             # interactionId "event:seek", phase main,
│   │                           #   applicableLayerTypes ["missionevents"],
│   │                           #   configPath variables.interactions.eventSeek + rows
│   ├── EventSeek.js            # thin adapter: decide() then TimeControl.setTime
│   ├── logic.js                # pure decide(feature, layerData, config)
│   └── tests/eventSeek.spec.js
└── tools/EventTimeline/
    ├── plugin.json             # toolbarPriority 1050,
    │                           #   pluginDependencies ["mission-events/layertypes/MissionEvents"]
    ├── EventTimelineTool.js    # make/destroy, TimeControl.subscribe/unsubscribe
    ├── EventTimelineTool.css
    └── tests/eventTimelineTool.spec.js
```

What each one does:

- **MissionEvents (layertype).** `extends: "vector"`, so drawing, picking,
  filtering and both globes are inherited and the whole type is one module of
  *surfaces*. `config.normalize` defaults `time.enabled`, `time.startProp` and
  `time.endProp` so a mission author gets a working time-enabled layer without
  filling in three fields. `source.fetch` fetches the GeoJSON and stamps
  `properties.durationSec` on every feature, which is both what the halo sizes
  itself by and what a mission's `style` can name with `prop-durationSec`.
  `time.applyTimeParams` stamps the window onto the layer so core does not reload
  the whole layer on every time move (the events are all fetched once and the
  inherited vector renderer filters them).
- **EventHalo (layerattachment).** One `L.circle` per point event, radius =
  (event duration ÷ the longest event's duration) × `maxRadiusMeters`, scaled by
  how far through its own span the event is at the playhead — so halos grow as
  time plays and do not exist at all before their event starts. It subscribes to
  `TimeControl` in `make` and unsubscribes in `destroy`, per the attachment
  README's own playhead example. `syncData` and `onConfigChange` are overridden
  because the core defaults (re-`addData`, rebuild the host) are wrong for
  derived circles in a `layerGroup`.
- **EventSeek (interaction).** On click, reads the feature's start/end from the
  property names the *layer* configured and calls
  `TimeControl.setTime(start − pad, end + pad, false, undefined, start)`, leaving
  the result in `ctx.state.eventSeek` for anything later in the pipeline.
  `padSec` is admin-editable on the interaction's own card.
- **EventTimeline (tool).** Lists every event overlapping
  `TimeControl.getStartTime()` → `getEndTime()` across all *on* `missionevents`
  layers, sorted by start, re-rendering on `TimeControl.subscribe` and
  unsubscribing in `destroy`.

---

## 3. Where the system resisted

### 3.1 `capabilities.time.histogram` is a declaration with no operation behind it — the headline finding

This is the thing I wanted to express and **could not express at all**.

The capability table says the type "can report when data exists over time, so the
time bar draws its availability sparkline"
(`plugins/core/layertypes/README.md:558`). I declared it:

```jsonc
"capabilities": {
    "time": { "histogram": true }
}
```

`validate` is happy. `LayerTypeRegistry.providesTimeHistogram()`
(`src/essence/Basics/Layers_/registry/LayerTypeRegistry.js:209-211`) returns
`true` for my type. And then nothing happens, because the only consumer of that
capability decides *how* to get the data by pattern-matching the layer's **url**
(`src/essence/Basics/TimeControl_/TimeUI.js:2916-2975`):

```js
Object.keys(L_.layers.data).forEach((name) => {
    const l = L_.layers.data[name]
    if (
        l &&
        LayerTypeRegistry.providesTimeHistogram(l.type) &&
        l.time && l.time.enabled === true &&
        L_.layers.on[name] === true
    ) {
        let layerUrl = l.url
        if (layerUrl.indexOf('stac-collection:') === 0) {
            /* … parse the STAC collection name … */
            sparklineLayers.push({ name, stacCollection, isExternal, externalBaseUrl })
        } else if (!F_.isUrlAbsolute(layerUrl)) {
            layerUrl = L_.missionPath + layerUrl
            if (layerUrl.indexOf('{t}') > -1)
                sparklineLayers.push({ name, path: `/${layerUrl}`.replace(/{t}/g, '_time_') })
        }
    }
})
```

and then queries one fixed core API for both shapes
(`TimeUI.js:3056-3118`, `calls.api('query_tileset_times', …)`), binning the
response with two hardcoded local helpers, `binStacData` and `binFileData`.

My type's url is an ordinary absolute GeoJSON endpoint. It is not
`stac-collection:`, it contains no `{t}`, and (being absolute) it fails the
second branch's `!F_.isUrlAbsolute` guard too. It is therefore dropped from
`sparklineLayers` without a log line. I declared a capability, validation passed,
core read the capability, and the feature is unreachable.

**There is no operation I can implement to fix this.** The `time` surface's
vocabulary is exactly `format` and `applyTimeParams`
(`plugins/core/layertypes/README.md:327-338`), and the module validator *rejects
unknown operation names* — so inventing `time.availability` would be a hard
validation error, not a silent no-op. The only way to get bars on the timeline
would be to make my layer's url lie about its shape (name it
`stac-collection:…`, or contain a `{t}` and live under the mission path) and to
have a backend answer `query_tileset_times` for it — i.e. impersonate a
different type's transport. That is squarely "something I suspect is wrong", so I
did not do it. I left `histogram: true` declared, because it is the honest
statement of what my type *knows*, and the gap is core's.

Note also the double bind for the *feature* case even if the plumbing existed:
`query_tileset_times` is a server-side query over tilesets. A vector event layer
already holds every event's timestamp in the browser — the availability
histogram for it is a pure client-side bin of data core already has — and there
is no way to hand core an array of counts.

### 3.2 The current window was expressible; the histogram was not

To be precise about the two halves of the question:

- **The current window: yes, cleanly, from every family and without reading core
  source.** `plugins/README.md:971-994` is a good table:
  `TimeControl.enabled`, `getStartTime()`, `getEndTime()`, `getTime()`,
  `subscribe(id, fn)`/`unsubscribe(id)`, and the note that a tool *must*
  unsubscribe in `destroy`. My tool and my attachment both needed only that. The
  advice to read a feature's own timestamps off `layerObj.time.startProp/endProp`
  rather than a central store (`plugins/README.md:986-990`) is exactly the fact I
  needed for three of the four plugins, and it is stated once, in the right place.
- **The histogram: no.** See 3.1. I only learned the mechanism by reading
  `TimeUI.js`, which is precisely what the exercise asked me to avoid having to do.

### 3.3 `TimeControl.setTime`'s positional tail

Documented as
`setTime(startTime, endTime, isRelative, timeOffset, currentTime, customTimes)`
(`plugins/README.md:983`). Moving the playhead to the event while leaving the
offset alone means passing a hole:

```js
TimeControl.setTime(
    window_.startTime,
    window_.endTime,
    false,
    undefined,   // timeOffset — nothing to say, but currentTime is behind it
    window_.currentTime
)
```

`undefined` for a parameter documented as `'HH:MM:SS'` or seconds is a guess. The
docs do not say what an omitted `timeOffset` means (keep the current one? reset
to zero?), and nothing says whether `currentTime` must lie inside
`[startTime, endTime]` or what happens if it doesn't. An options-object overload,
or one line in the table saying "omit `timeOffset` to keep the current offset",
would remove the guess. This is minor next to 3.1 but it is the second place I
could not tell whether I had written the right thing.

### 3.4 Two mechanisms I expected to exist and had to work around

- **A tool cannot ask "which layers are of type X".** There is no registry lookup
  by `typeId` available to a plugin, and `plugins/README.md:400` explicitly says
  so for attachment/interaction ids ("There is deliberately no registry lookup by
  `attachmentId`/`interactionId` for plugins"). So the tool filters
  `L_.layers.data[name].type === 'missionevents'` with the typeId as a string
  literal — the same string that lives in the type's manifest, now duplicated in
  a sibling's source with nothing keeping them in sync. A rename of my `typeId`
  breaks the tool silently. `pluginDependencies` records the relationship but
  does not supply the value.
- **An attachment that follows the playhead cannot be unit tested.** See §6.1 —
  the two pieces of documented advice contradict each other, and the scaffolded
  test is the casualty.

---

## 4. The seams between the families

Four facts had to cross plugin boundaries. Three of them the system handled well,
and one I had to invent.

| the fact | who knows it | how it reaches the others | docs told me? |
|---|---|---|---|
| the property names holding each event's start and end | core's own `layerObj.time.startProp` / `endProp`; my type *defaults* them in `config.normalize` | everyone reads them off the layer config they are already handed (`ctx.layerObj` for the attachment, `ctx.layerData` for the interaction, `L_.layers.data[name]` for the tool) | **yes** — `plugins/README.md:986-990` says feature timestamps live in the properties the layer's config names, and never to touch `_`-prefixed core fields |
| `durationSec` — the per-feature duration, in **seconds** | invented by my `source.fetch`; the attachment needs it to size a halo | declared, not written: `capabilities.defaultAttachments.event_halo.durationProp: "durationSec"` in the *type's* manifest; core hands it to the attachment under the attachment's own `configPath` as `ctx.config.durationProp` | **yes**, and emphatically — `plugins/README.md:373-398` and `layertypes/README.md:500-533` spell out that the type must declare what the sibling should be and must never write into the sibling's subtree |
| `maxRadiusMeters` — the size the longest halo reaches, in **metres** | the attachment's own default (400), overridable by the type and then by the layer | same `defaultAttachments` object; the layer's own settings sit on top field by field | yes, same section (including the "empty form field does not override, but `false`/`0` do" rule) |
| `padSec` — seconds of context the clock keeps around a sought event | the interaction's own default (300), declared by the type | `capabilities.defaultInteractions.click: { "event:seek": { "padSec": 300 } }` | **yes** — `layertypes/README.md:476-496` |
| **the typeId `"missionevents"` itself** | the type's manifest | **hardcoded as a string literal in the tool's source** — there is no lookup | **no, I invented this.** Nothing documents how a tool finds layers of a plugin type |

So the property-name problem the docs make such a point about — the same fact
typed into three different subtrees by an admin — genuinely does not arise. I
never read another plugin's config, never wrote into one, and an admin who
configures nothing at all still gets a working feature. That is the best part of
the system.

The unit conventions (seconds, metres) are carried in the *setting names*
(`durationSec`, `maxRadiusMeters`, `padSec`) and in `lib/eventTime.js`'s JSDoc,
because there is nowhere in a manifest to declare a unit. That is a reasonable
place for it, but it does mean the type→attachment contract is enforced only by
naming discipline: if the attachment read `durationProp` as milliseconds nothing
would complain.

---

## 5. What failed silently

1. **The availability histogram.** `capabilities.time.histogram: true`, green
   validate, green activate, the capability *is* read by core — and the layer is
   dropped from the sparkline set with no log, no warning, and nothing in
   `validate` that could have told me. This is the exact failure mode
   `plugins/core/layertypes/README.md:542-544` warns about for capabilities
   ("they are the one part of this contract that fails *quietly* if you get it
   wrong, so validation checks them") — except here the manifest is *correct* and
   the quiet failure is in core's consumer, which validation cannot see.
2. **The tool's access to another layer's features.** `EventTimelineTool.js`
   does `L_.layers.layer[name]?.toGeoJSON ? … : L_.layers.data[name]?._geojson`.
   Both halves are guesses: nothing in the plugin docs says how a *tool* reads a
   vector layer's current features, and `_geojson` is a `_`-prefixed core field
   that `plugins/README.md:989-990` explicitly tells plugins not to touch — I
   used it only as a fallback and I expect it to be wrong. If both are empty the
   tool renders "No events in this window", which is indistinguishable from the
   correct answer. That is the silent failure I am least happy about, and it is
   only unverified rather than known-broken because I never opened the app.
3. **A `defaultAttachments` entry whose host refuses it** would also be silent —
   but `validate` does catch this one, and said so when I first had
   `applicableLayerTypes: ["vector","query"]` on the attachment while the type
   declared it. Credit where due: that is the cross-family check working.
4. **`config.normalize` defaulting `time.enabled`** may or may not be visible to
   the Configure page's own time UI — I set it in the type's parse-time surface,
   but an admin looking at the layer modal may see the box unticked while the
   runtime layer is time-enabled. Untested; flagging it as a plausible silent
   divergence rather than a confirmed one.

---

## 6. Docs: confusing, missing or contradictory

### 6.1 The attachment README contradicts itself about importing TimeControl

`plugins/core/layerattachments/README.md:201-224` — "Time" — tells an attachment
that must follow the playhead to do this:

```js
import TimeControl from '@basics/TimeControl_/TimeControl'

function make(ctx) { … TimeControl.subscribe(fid, …) … }
```

The worked example in the *same file*, at `:348-352`, says the opposite:

> Read the Leaflet global per call, not at import time, so the module can be
> imported outside the browser (`npm run test:plugins:unit` does exactly that).
> Importing an MMGIS singleton — `F_` included — pulls jQuery and makes the
> module un-importable in a unit test, so this one stays dependency-free.

Both cannot hold for a playhead-following attachment, which is the exact plugin
the first passage is written for. I followed the first, and the **scaffolded**
test — which `create layerattachment` writes with `import EventHalo from
'../eventHalo.js'` — immediately failed:

```
TypeError: Cannot read properties of undefined (reading 'createElement')
   at src/essence/Basics/TimeControl_/TimeControl.js:4   (import $ from 'jquery')
   at plugins/mission-events/layerattachments/EventHalo/eventHalo.js:8
   at plugins/mission-events/layerattachments/EventHalo/tests/eventHalo.spec.js:12
```

— and it fails *despite* the scaffold's own
`import '../../../../../tests/helpers/browser-globals.js'`, which is advertised
as "Stubs window/document so the module can be imported in Node". So the
generated test for the documented pattern does not run out of the box. I had to
delete the module import from the spec and test the geometry through
`lib/eventTime.js` instead. Either `browser-globals.js` should stub enough for
jQuery, or the Time section should carry the warning that an attachment which
imports `TimeControl` cannot be imported in a unit test and should keep its
arithmetic in a separate module.

### 6.2 The histogram capability is documented as a capability with no contract

`plugins/core/layertypes/README.md:558`:

> `time.histogram` — it can report when data exists over time, so the time bar
> draws its availability sparkline

"Can report" implies a reporting mechanism. There is none (§3.1). Neither this
file, nor the `time` surface table at `:325-338`, nor `plugins/README.md`'s Time
section at `:971-994`, says what core will do with the declaration or what shape
of url/backend it silently requires. Every other capability in that table names
the core behaviour it switches on and is honest about it; this one names a
behaviour a third-party type cannot reach.

### 6.3 `time.applyTimeParams`'s `ctx` is undocumented

`plugins/core/layertypes/README.md:330` gives the signature
`applyTimeParams(layerObj, ctx) → void` and describes when it runs, but the `ctx`
table at `:357-362` documents `startTime`/`endTime` only for the **map surface's**
`timeChange`. I assumed `applyTimeParams` gets the same two fields (that is what
the Tile example implies) and wrote `ctx?.startTime` / `ctx?.endTime`
defensively. It might be `{ start, end }`, as `source.fetch`'s `ctx.time` is
(`:234`) — the codebase uses both spellings for the same pair, which is itself
worth a line of documentation.

### 6.4 Smaller ones

- `plugins/core/layertypes/README.md:632` — the "Checklist for a new type" lists
  `supportedData` as required alongside `typeId`/`capabilities.renderers`/`modules`,
  but the required-fields list in `plugins/README.md:221` does not mention it and
  `validate` does not require it. Harmless, but two lists disagree.
- `plugins/README.md:1113-1116` explains that `test:unit` does not cover a
  plugin's own `tests/`, and gives the by-path invocation — good — but the
  scaffolded spec's own header says "Run with `npm run test:plugins:unit`", and
  `npm run test:plugins:unit` runs **every** plugin's unit tests, which on this
  branch means core's too. For iterating on one plugin the by-path form is the
  one you want; the scaffold points at the slow one.
- `plugins/core/layertypes/README.md:639` ends mid-sentence ("then `npm run
  plugins -- activate` to" — the file stops there).
- `layerattachments/README.md:119` documents `peerFeaturesFor` returning
  `{origin, layerNames, peers}` without saying what those three are; I did not
  need it, but it is the one operation in the table I could not have implemented
  from the docs.

---

## 7. What I liked, and what was easier than expected

- **`create layertype --extends vector` is excellent.** A new, time-aware,
  clickable, filterable, both-globes layer type came out at ~40 lines of my own
  code, because inheritance is per *operation* and I only had to write the three
  surfaces that differ. The scaffold's comment block listing the other surfaces
  and what each core default is meant I never had to go looking.
- **`defaultAttachments` / `defaultInteractions` carrying settings, not just
  ids.** This is the best design decision in the system. It solved the exact
  problem I would otherwise have solved wrongly (having the type write into the
  attachment's `configPath`), the docs pre-empt the wrong answer explicitly, and
  the result is that an admin who configures *nothing* still gets a working
  feature with all three plugins wired together.
- **`validate` checks across families.** It caught that my attachment's
  `applicableLayerTypes` excluded the very type declaring it in
  `defaultAttachments` — a mistake that would otherwise have been a silent
  no-show. The generated-registry-staleness check is the same kind of good.
- **The scaffolds are real files, and they write real tests.** Reading
  `plugin-cli/scaffolds/<type>/` really is reading what you get, and the
  generated `logic.js`/`spec.js` split for interactions taught me the testability
  pattern without my having to discover it by hitting the jQuery wall (which I
  then hit anyway, in the attachment — §6.1).
- **The CLI is fast and honest.** `create` → edit → `activate` → `validate` is a
  tight loop, "You're not done when `validate` passes"
  (`plugins/README.md:335-347`) is exactly the right thing to say, and the
  per-family "register / then make something use it" table is the single most
  useful paragraph in the docs.

---

## 8. Top 3 recommendations, ranked

1. **Give the `time` surface a real availability operation, or drop the
   capability.** Add something like
   `time.availability(layerObj, ctx) → [{ t, total }]` (with `ctx` carrying the
   timeline's start/end and bin count) and have `TimeUI._makeHistogram` call it
   for any type whose registry entry provides it, keeping today's
   `stac-collection:` / `{t}` url paths as core Tile's own implementation of that
   operation. A vector type can then bin its own already-loaded features in three
   lines. If that is not going to happen, remove `time.histogram` from the
   capability table in `plugins/core/layertypes/README.md:558`, because as it
   stands it is a promise a third-party type cannot collect on, and it fails
   silently when it does not.
2. **Fix the attachment/TimeControl testability contradiction.** Either make
   `tests/helpers/browser-globals.js` stub enough of the DOM for jQuery (so the
   documented playhead pattern's scaffolded test runs), or amend
   `plugins/core/layerattachments/README.md:201-224` to state that importing
   `TimeControl` makes the module un-importable in a Node unit test and to put
   the arithmetic in a `lib/` module — and have `create layerattachment` scaffold
   that split the way `create interaction` already scaffolds `logic.js`. Right
   now the two halves of one README lead to a generated test that throws.
3. **Give plugins a supported way to reach layers by type and to read a layer's
   current features.** Something as small as
   `L_.layersOfType(typeId)` and `L_.featuresOf(layerName)` documented in the
   plugin README's Discovery section would remove the two worst pieces of my
   tool: a hardcoded `'missionevents'` string literal that nothing keeps in sync
   with the manifest, and a `toGeoJSON()`/`_geojson` guess that touches a
   `_`-prefixed core field the same README tells plugins to stay away from. This
   is the one seam in a four-plugin feature that the declarative machinery does
   not cover, and it is the seam most likely to break on a rename.
