# R6 — Cross-layer plugin round: ground truth vs. orbital prediction

Author: third-party plugin author (stress test)
Branch: `devin/r6-crossref-1785954581`, off `devin/1785790516-finalize-layertype-plugins`
Container: `plugins/orbital-crossref/` (gitignored by design, added with `git add -f`)
Core changes: **none**. Nothing under `src/`, `API/`, `configure/` or `plugin-cli/` was touched.

The brief: one feature spanning three families — a layer type for orbital
predictions, an attachment drawing each prediction's offset from the nearest
feature of a *different* (ground-truth) layer, and an interaction that opens the
matching ground-truth feature on click. The settings seam is deliberately
same-layer only. Push until something resists, then write down exactly what and
where.

It resisted in three places. All three are the same underlying gap: **the plugin
system has a rich, well-designed vocabulary for a plugin talking about *its own*
layer, and essentially none for a plugin talking about *another* layer.**

---

## 1. What I built, and what actually works

### The three plugins

**`layertypes/OrbitalPrediction`** (`typeId: orbitalprediction`, `extends: vector`)

A vector-derived type for predicted surface positions from an orbital
propagation service. It declares two surfaces and inherits everything else
(drawing, picking, filtering, both globes) from `vector`:

- `source.fetch` — GETs the configured URL, appending `bbox` from `ctx.view`
  when the layer is dynamic-extent and `datetime=start/end` when
  `ctx.time.requery` is set.
- `config.normalize` — defaults `variables.dynamicExtent` to `true`, because the
  layertypes README (`plugins/core/layertypes/README.md:238-243`) says a
  viewport-driven source should default it rather than assume a mission author
  knows to set it.
- It stamps `_crossrefTruthId` onto each feature from the mission-named property
  in `variables.crossref.truthIdProp`, so the other two plugins have one known
  place to match on.
- It ships the other two plugins via `capabilities.defaultAttachments` and
  `capabilities.defaultInteractions`.

**`layerattachments/TruthOffset`** (`attachmentId: truth_offset`,
`configPath: variables.layerAttachments.truthOffset`)

A sublayer on the predictions layer: a dashed polyline from each prediction to
the ground-truth feature it predicts, coloured on a green→red ramp by the offset
and labelled with the offset in metres. Operations implemented:

| operation | why the core default was wrong |
|---|---|
| `make` | required |
| `syncData` | these are derived polylines in a `layerGroup`, not the host's GeoJSON re-added |
| `onPeerToggle` | a ground-truth layer being toggled changes what there is to compare against — the attachment's entire point |
| `onConfigChange` | retune in place rather than pay for a whole host rebuild |
| `peerFeaturesFor` | the one place core actually asks a plugin about other layers |

**`interactions/TruthOpen`** (`interactionId: truth:open`, `phase: main`,
`order: 100`, `applicableLayerTypes: ["orbitalprediction"]`)

Clicking a prediction resolves its ground-truth feature and calls
`L_.selectFeature(layerName, feature)`, leaving `{layerName, offsetMeters}` on
`ctx.state` for anything downstream in the pipeline.

**`lib/crossref.js`** — the shared, dependency-free module the plugins README
(`plugins/README.md:361`) tells you to write: haversine distance, geometry
position extraction, `matchTruth` (by property, falling back to nearest within a
bound), `pairAll`, and the offset colour ramp. It is the only part all three
families can share and the only part that is unit-testable.

### What actually works — and what I have no right to claim

**Verified, mechanically:**

- `npm run plugins -- validate` — *All 61 plugin(s) valid*, with one warning that
  predates me (`core/interactions/ChemistryUse` depends on a `core/tools/ChemistryTool`
  that does not exist).
- `NODE_ENV=test npx eslint plugins/orbital-crossref` — clean, zero errors, zero
  warnings.
- `npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/orbital-crossref`
  — 17 passing `@unit` tests across the three plugins: manifest contracts
  (including "every `field` sits inside `configPath`", checked for both the
  attachment and the interaction), distance maths, property-matching vs.
  nearest-fallback, the max-distance bound, the offset ramp endpoints, the
  `_crossrefTruthId` stamping, the `dynamicExtent` default, and that `fetch`
  actually parameterizes by `bbox` and `datetime`.
- `npm run test:unit` — 1084 passing, nothing regressed.

**Explicitly NOT verified — this is the honest part:**

I never saw any of it in a browser. No mission was configured with an
`orbitalprediction` layer alongside a ground-truth vector layer, so:

- no pairing line has ever been drawn;
- `onPeerToggle` has never fired;
- `peerFeaturesFor` has never been called by core (I do not actually know from
  reading the docs what core does with the value — see §6);
- `L_.selectFeature(...)` has never been invoked with a feature from a layer
  other than the clicked one, and I do not know whether core is happy being
  handed a `{...f, _layerName}` copy rather than the identical object instance
  the layer holds. **This is the single most likely thing to be broken.** Core's
  selection code may well match by reference or by an internal index rather than
  by value.

"Validate passes" and "17 unit tests pass" together mean *the manifests are
well-formed and the maths is right*. The rendering half and the selection half
are unproven. `plugins/core/interactions/README.md:180` says it best: "A green
manifest and a green runner test do not mean the interaction works — click a
feature." I did not click a feature.

---

## 2. Branch and files

Branch: **`devin/r6-crossref-1785954581`** (pushed; no PR opened).

```
plugins/orbital-crossref/
├── lib/
│   └── crossref.js                                   # shared, no src/essence imports
├── layertypes/OrbitalPrediction/
│   ├── plugin.json
│   ├── orbitalPrediction.js
│   └── tests/orbitalPrediction.spec.js               # 6 @unit tests
├── layerattachments/TruthOffset/
│   ├── plugin.json
│   ├── truthOffset.js
│   └── tests/truthOffset.spec.js                     # 6 @unit tests
└── interactions/TruthOpen/
    ├── plugin.json
    ├── TruthOpen.js                                  # thin adapter, imports L_
    ├── logic.js                                      # pure decisions, testable
    └── tests/truthOpen.spec.js                       # 5 @unit tests
```

Plus this report at the repo root: `R6-REPORT-crossref.md`.

---

## 3. Where the system resisted

### 3a. There is no way for a plugin to *read* another layer. The only path is out through the singleton, and it reads the render, not the data.

This is the headline finding.

Every context the system hands a plugin is scoped to one layer:

- attachment `make(ctx)` gets `{ geojson, layerObj, leafletLayerObject, hostLayer, config, siblings }`
  (`plugins/core/layerattachments/README.md:134`);
- attachment per-instance ops add `{ hostName, attachmentName, … }`;
- interaction `use(ctx)` gets `{ feature, layer, layerName, layerData, layerVar,
  layerTypeChain, event, eventType, additional, config, state, stop, Map_ }`
  (`plugins/core/interactions/README.md:45-59`);
- layer-type operations are `(layerObj, ctx)` where `ctx` is the surface's own
  context (`plugins/core/layertypes/README.md:344`).

Not one of them mentions another layer. So both my attachment and my interaction
contain this, independently:

```js
// plugins/orbital-crossref/layerattachments/TruthOffset/truthOffset.js
function truthFeatures(names) {
    const out = []
    for (const rawName of names) {
        const name = L_.asLayerUUID ? L_.asLayerUUID(rawName) : rawName
        const live = L_.layers?.layer?.[name]
        if (!live) continue
        const collections = Array.isArray(live) ? live : [live]
        for (const c of collections) {
            const gj = typeof c?.toGeoJSON === 'function' ? c.toGeoJSON() : null
            for (const f of gj?.features || []) out.push({ ...f, _layerName: name })
        }
    }
    return out
}
```

Three separate things are wrong with being forced to write this, and I would not
be happy maintaining any of them:

1. **It reads the render, not the data.** `L_.layers.layer[name]` is a *live
   Leaflet layer*; `toGeoJSON()` reconstitutes GeoJSON from what is currently
   drawn. A layer that is toggled off, not yet made, still loading, or filtered
   contributes nothing — and I cannot distinguish "the truth layer has no
   matching feature" from "the truth layer isn't built yet". A `vectortile` or
   `query` truth layer may have no usable `toGeoJSON` at all, so my attachment
   silently supports fewer truth-layer types than its own `applicableLayerTypes`
   suggests, and nothing anywhere says so.
2. **It is defensive guesswork.** `Array.isArray(live) ? live : [live]`,
   `L_.asLayerUUID ? … : rawName`, `typeof c?.toGeoJSON === 'function'` — I wrote
   every one of those guards because I could not find a documented shape for
   `L_.layers.layer[name]`. A third-party author with no repo access could not
   write this function at all.
3. **There is no invalidation.** Nothing tells me the peer layer's data changed.
   `onPeerToggle` tells me a layer was *toggled*, which is not the same thing,
   and I have to filter it to my own layers myself:

```js
function onPeerToggle(attachment, ctx) {
    const names = attachment._opts?.layers || []
    const toggled = L_.asLayerUUID ? L_.asLayerUUID(ctx.layerName) : ctx.layerName
    if (!names.some((n) => (L_.asLayerUUID ? L_.asLayerUUID(n) : n) === toggled)) return
    syncData(attachment, { geojson: attachment.geojson })
}
```

Core knows which layers this attachment cares about — `peerFeaturesFor` returns
`layerNames`! — but it still hands me every toggle of every layer and lets me
sort it out.

To be fair to the system: core's own `Pairings`
(`plugins/core/layerattachments/Pairings/plugin.json`) does the same thing, with
the same `textarray` of layer names. So this is the *sanctioned* path, not a
hack I invented. That is precisely why it's worth reporting: the sanctioned path
is "reach into the singleton and hope", and it has been normalized because the
one attachment in core that needed it got away with it.

`peerFeaturesFor` (`plugins/core/layerattachments/README.md:119`) is the only
cross-layer hook in the whole contract, and it points the wrong way: it is core
*asking me* for relations. There is no matching input — no `ctx.peerFeatures(name)`,
no `onPeerData`, no way to declare "I depend on layer X's data" and be called
when it changes.

### 3b. A per-*layer* fact that two families need has to be typed twice, by hand, into two forms that must agree.

The plugins README is emphatic and correct about the type-level case
(`plugins/README.md:377-390`):

> The settings problem the last two rows solve is worth spelling out, because
> the obvious workaround is wrong. […] Do **not** have your layer type write
> into the attachment's `configPath`; declare what the attachment should be
> instead.

And it works beautifully for type-level constants. My type declares:

```json
"capabilities": {
    "defaultAttachments": {
        "truth_offset": { "matchProp": "_crossrefTruthId", "worstMeters": 1000 }
    },
    "defaultInteractions": {
        "click": { "truth:open": { "matchProp": "_crossrefTruthId" } }
    }
}
```

…and the property name lives in exactly one place. That is the good seam and I
was glad to have it.

But **which ground-truth layers to compare against is not a property of the
type — it is a property of the individual layer**, and differs per mission and
per layer. `defaultAttachments` cannot express it: it is baked into the type's
manifest, which a mission admin does not edit. The only place a per-layer fact
can live is a `configPath` subtree. And each plugin owns its own subtree, and
`plugins/README.md:373` says a plugin "should not write another's".

So the identical setting exists twice, in two manifests:

```json
// layerattachments/TruthOffset/plugin.json
{ "field": "variables.layerAttachments.truthOffset.truthLayers",
  "name": "Ground-truth Layers", "type": "textarray", "width": 7 }
```

```json
// interactions/TruthOpen/plugin.json
{ "field": "variables.interactions.truthOpen.truthLayers",
  "name": "Ground-truth Layers", "type": "textarray", "width": 6 }
```

An admin must type the same layer names into two different tabs of the same
layer modal and keep them in sync forever. If they drift, **the line you see and
the feature that opens are for different layers** — a wrong answer presented
confidently, which for a ground-truth-comparison feature is about the worst
possible failure mode. I wrote the contradiction into the manifest's own
description text, because there was nowhere better to warn anyone:

> "This duplicates the TruthOffset attachment's identical setting: a plugin may
> not read another plugin's config subtree, and there is no shared place for a
> per-layer fact two families need."

I considered three workarounds and rejected all of them:

- have the interaction read `layerData.variables.layerAttachments.truthOffset.truthLayers`
  — explicitly forbidden ("Never read another interaction's settings out of
  `ctx`", `plugins/core/interactions/README.md:63`; "a plugin owns its subtree
  and should not write another's", `plugins/README.md:373`), and it would break
  the moment someone uses the attachment without the interaction;
- have the layer type's `config.normalize` copy one subtree into the other —
  this is exactly the "obvious workaround" the README calls wrong, and it would
  fight the admin's edits;
- collapse the attachment and the interaction into one plugin — impossible, they
  are different families, and the brief (correctly) forbids watering the feature
  down.

**So the honest answer to "how far can a plugin get talking about another
layer?" is: it can get all the way, but only by duplicating the admin-facing
configuration once per family, with no mechanism to keep the copies consistent.**

### 3c. A layer reference is free text.

`plugins/README.md`'s component table has no layer-picker component. The
sanctioned way to name another layer is `"type": "textarray"` — exactly what
Pairings does (`plugins/core/layerattachments/Pairings/plugin.json`, the
`variables.layerAttachments.pairings.layers` row: *"An comma-separated array of
names or UUIDs of other layers."*).

Consequences: a typo is invisible; a renamed layer silently stops matching; there
is no autocomplete of the mission's actual layers; and nothing validates the
reference at save time or at load time. For a feature whose *entire purpose* is
cross-layer, the reference mechanism is the least robust part of the config
system.

---

## 4. The seams between the families

A fact my layer type knows that the other plugins needed — and how it got there:

| fact | value | how it travels | docs or invention? |
|---|---|---|---|
| the match key property | `_crossrefTruthId` | type's `capabilities.defaultAttachments.truth_offset.matchProp` and `capabilities.defaultInteractions.click["truth:open"].matchProp`; core resolves each into that plugin's own `configPath` before handing it over as `ctx.config` | **Documented** — `plugins/README.md:377-397`, and it is the best-designed thing in the round |
| the colour-ramp ceiling | `worstMeters: 1000` | same mechanism, `defaultAttachments` only | Documented |
| the computed offset | `_crossrefOffsetMeters`, an integer in **metres** | the attachment writes it back onto the *host's own feature properties* in `drawnPairs`; the interaction reads `feature.properties[OFFSET_PROP]` and prefers it over recomputing | **Half-invented.** `plugins/README.md:371` blesses "leave something on the layer" and names two mechanisms (`L_.layers.attachments[host][sublayerKey]`, and `ctx.state` down the interaction pipeline) — but neither fits: the interaction cannot reach `L_.layers.attachments` for a *value* without knowing my `sublayerKey`, and `ctx.state` only carries within one pipeline run. Writing onto `feature.properties` is my invention |
| which ground-truth layers | per-layer, per-mission | **it does not travel.** Typed twice by an admin (§3b) | Not possible |
| the truth layer of a given pair | `_layerName`, injected onto each copied truth feature | invented, purely internal to my container | Invention |

The `_crossrefOffsetMeters` choice deserves a note, because it is the seam I am
least comfortable with. It works, and it has a real benefit — the number the
tooltip shows and the number the click reports are guaranteed identical, and the
host's own `style` can colour by it with `prop-_crossrefOffsetMeters` — but:

- the property name, the unit (metres), and the rounding are a convention that
  exists only in `lib/crossref.js` as two exported constants;
- nothing validates it, and nothing stops a *different* plugin from writing the
  same key;
- the layertypes README warns "Never reach for a `_`-prefixed field of core's;
  those are caches, and they move" (`plugins/README.md:992`) — I am creating a
  `_`-prefixed field of my own, which reads like exactly the pattern that
  warning exists to discourage, and I found no guidance on the right way for a
  plugin to namespace data it puts on a feature;
- it means my attachment **mutates the host layer's feature objects**, which
  nothing in the attachment contract says I may do. It's the only way to get a
  computed number to a sibling plugin, but I would not be confident it survives
  a core refactor of feature handling.

---

## 5. Things that fail silently — green validation, nothing happens

1. **Empty or typo'd `truthLayers`.** The attachment is built (a `configPath`
   subtree that exists counts as enabled), `make` runs, `truthFeatures` returns
   `[]`, `drawnPairs` returns no lines, and an empty `layerGroup` is added to the
   map. Validate is green, the sublayer appears in the LayersTool, and nothing is
   drawn. There is no warning path for an attachment — I could `console.warn`,
   but nothing surfaces it to the admin who made the mistake. I did add a
   `console.warn` in the interaction, which is at least something:
   `"truth:open: no truthLayers configured on the interaction; nothing to open."`
2. **The truth layer is off, or not yet built.** Identical symptom to (1), for a
   completely different reason. Both are "nothing drawn". No way to tell them
   apart from the UI.
3. **A truth layer type without a working `toGeoJSON`.** Same silent nothing.
4. **`onPeerToggle` name mismatch.** If the admin typed a display name in one
   place and core hands me a UUID (or vice versa) in a way `asLayerUUID` doesn't
   reconcile, the filter never matches and the redraw simply never happens — the
   lines just go stale, which is worse than not drawing at all because they look
   correct.
5. **The two `truthLayers` lists drifting apart** (§3b). Lines drawn to layer A,
   clicks opening features in layer B. Nothing detects it.
6. **Unresolvable `pluginDependencies`** — documented at `plugins/README.md:942`
   and it is the scariest one in the system: *"A frontend plugin whose dependency
   is missing or disabled is left out of the generated registry — `list` still
   shows it enabled and `validate` still reports the manifest valid"*. Both my
   attachment and my interaction declare
   `"pluginDependencies": ["orbital-crossref/layertypes/OrbitalPrediction"]`, so
   if this container is ever installed under a different directory name, two of
   my three plugins vanish while every diagnostic says they are fine. The docs
   warn about it, which is good; that it is possible at all is not.
7. **A `config.tab` typo** — `plugins/core/layerattachments/README.md:271-276`
   says Configure "quietly gives it a tab of its own holding your rows alone,
   which an admin has no reason to open". `validate` warns, which is the right
   fix, and is a good model for what recommendation #3 below asks for.

---

## 6. Docs: confusing, missing or contradictory

| where | issue |
|---|---|
| `plugins/core/layerattachments/README.md:119` | `peerFeaturesFor` gets one table row — signature `(attachment, ctx) → {origin, layerNames, peers} \| false`, "core needs a feature's related features in other layers", default "none (no relations)". That is the *only* cross-layer hook in the entire contract and there is no example, no statement of **who calls it**, **when**, or **what core does with the result**. Does something in the UI show peers? Does the Viewer use it? Is `peers` expected to be feature objects from the other layer's live data, or copies? I implemented it blind and cannot tell you whether my implementation is correct — only that it returns the documented shape. |
| `plugins/core/layerattachments/README.md:349-353` | The worked example instructs: *"Importing an MMGIS singleton — `F_` included — pulls jQuery and makes the module un-importable in a unit test, so this one stays dependency-free."* For a cross-layer attachment this is **impossible**: peer access requires `L_`, so the module can never be imported in Node. The scaffolded test (`create layerattachment`) does `import TruthOffset from '../truthOffset.js'` and asserts `typeof TruthOffset.make === 'function'` — I had to delete that assertion and rewrite the test to cover `lib/crossref.js` instead. The interactions README solves this properly for interactions (`plugins/core/interactions/README.md:175-179`: keep logic in a pure module, `logic.js`, and the scaffold *generates* one). The attachment scaffold generates no equivalent, and the attachment README never acknowledges that some attachments simply cannot follow its advice. **Recommendation: give `create layerattachment` a `logic.js` too, and say in the README that a cross-layer attachment must use it.** |
| `plugins/core/layerattachments/README.md:296-302` (the checklist) vs `plugins/README.md:347` | The checklist says to run `activate` after validate; `plugins/README.md:347` says `create` runs `activate` for you and "this bites on the *second* change". Both true, but the checklist reads as if `activate` is a step you might skip. It is not obvious that changing `attachmentId`, `configPath`, `capabilities` or `config` in the manifest *all* require a re-`activate` — I re-ran it defensively. |
| `plugins/core/layertypes/README.md:26` | `globe/layerConfig.js` is introduced as "engine-neutral globe layer config, shared by the engine modules — a helper, not a surface" and then never mentioned again. No shape, no example. |
| `plugins/README.md:992` | *"Never reach for a `_`-prefixed field of core's; those are caches, and they move."* Sound advice, but there is no counterpart telling a plugin author how to namespace *their own* data on a feature or a layer. I invented `_crossrefOffsetMeters` / `_crossrefTruthId` and cannot tell whether that is idiomatic or exactly what the warning is trying to prevent. |
| `plugins/README.md:396` | *"There is deliberately no registry lookup by `attachmentId`/`interactionId` for plugins, and no way to *call* another plugin's operations […] Two plugins that must run in a fixed order are one plugin."* This is a clear, defensible design stance for plugin→plugin *calls*. But it is stated in a way that reads as covering all cross-plugin communication, and it leaves the cross-*layer* case (a fundamentally different problem) undiscussed anywhere in the docs. A short "Talking about another layer" section — even if the answer is "use `L_`, here is the supported way" — would have saved most of my time this round. |
| `plugins/core/interactions/README.md:180` | *"A green manifest and a green runner test do not mean the interaction works — click a feature."* Not a problem — this is the single most valuable sentence in the docs and it should be repeated verbatim in the layertypes and layerattachments READMEs. |

---

## 7. What I liked, and what was easier than expected

- **`--extends vector` is excellent.** `npm run plugins -- create layertype OrbitalPrediction --container orbital-crossref --extends vector` produced a working, correctly-shaped type, and a real data source was ~40 lines. Per-*operation* inheritance (declaring `config.normalize` keeps the parent's `config.expand`) is the right granularity and it is well explained (`plugins/core/layertypes/README.md:86-95`). The CLI validating the parent as you type it is a nice touch.
- **`defaultAttachments` / `defaultInteractions` genuinely solve the type-level version of my problem.** The property name `_crossrefTruthId` is written exactly once, in the manifest of the plugin that knows it, and both other plugins receive it through their own `configPath` as if an admin had typed it. "Its own settings sit on top field by field" is the correct merge semantics. This is the part of the design I would point at as exemplary.
- **The scaffolds explain *why*, inline, and are worth reading.** The generated `logic.js` for interactions, with its comment about why the split exists, taught me the testing constraint before I hit it.
- **`validate` cross-checks ids between families.** An attachment declared as a default by a type it refuses as a host is an error, not a mystery. That is exactly the class of check §5 is asking for more of.
- **`ctx.config` resolution.** Never reading the host's config directly, and having core resolve `configPath` for me — including "a subtree that exists counts as enabled" — meant zero config plumbing in three plugins.
- **Easier than expected:** getting the *whole feature* to green validate + green lint + 17 green unit tests with **zero core changes**. Given the brief predicted this would be the hardest round, I expected to need a core patch. I did not. The system bent; it did not break. What it cost was duplicated admin config and singleton-reaching code — a maintainability price, not a capability wall.

---

## 8. Top 3 recommendations, ranked

### 1. Give plugins a read seam for peer-layer data.

Concretely: put a resolver on the contexts every family already receives —

```js
ctx.peerFeatures(layerNameOrUuid) → { features, ready: boolean, layerName }
```

returning the layer's **source** GeoJSON (not `toGeoJSON()` of the render), with
an explicit `ready` so a plugin can distinguish "no match" from "not loaded".
Pair it with an input hook mirroring the existing `onPeerToggle`:

```js
onPeerData(attachment, { layerName, geojson })
```

and let a plugin declare which layers it watches (from its own config) so core
can filter, instead of every plugin re-implementing the name/UUID comparison.
Today, `L_.layers.layer[name].toGeoJSON()` is copy-pasted between core's
`Pairings` and both of my plugins; that is three implementations of the same
undocumented lookup, and it will be five by the next round.

### 2. Let a per-layer fact be shared between the plugins of one feature — and add a layer-picker component.

Two parts, same problem:

- **Sharing.** `defaultAttachments`/`defaultInteractions` handle *type-level*
  constants perfectly and *per-layer* facts not at all. Options: a
  `sharedConfigPath` a manifest can opt into (`variables.crossref.truthLayers`,
  owned by the type, readable by any plugin the type declares); or letting a
  type's `defaultAttachments` value reference a layer-config field
  (`"truthLayers": "$layer:variables.crossref.truthLayers"`). Either removes the
  duplicated form and the silent drift in §5.5.
- **The picker.** Add a `"type": "layerpicker"` config component, populated from
  the mission's actual layers, storing UUIDs. Free-text layer names
  (`textarray`) are the weakest link in every cross-layer feature, core's
  `Pairings` included.

### 3. Make "configured, but produced nothing" loud.

`validate` already does this class of check well for ids between families and
for a lone `config.tab`. Extend it, and add the runtime half:

- `validate` (or a mission-config check in Configure): warn when a plugin's
  config names a layer that does not exist in the mission;
- runtime: a standard, surfaced way for an attachment to report "I was built and
  I drew nothing, for this reason" — the LayersTool already lists sublayers, so
  an empty one could say why.

Right now the failure mode for the entire feature I just built is *an empty
layer group and a green everything*, and there is no supported way for the
plugin to say otherwise.
