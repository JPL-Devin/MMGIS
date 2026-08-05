# Round 6 — Subsurface radar sounding, in 3D (globe-first)

Third-party author's report on building one feature out of three plugins: a
**layertype** that renders on the LithoSphere globe, an **attachment** that marks
detected subsurface interfaces along the track, and an **interaction** that
reports depth at the clicked point.

- Branch: `devin/r6-litho-1785954627`, off `devin/1785790516-finalize-layertype-plugins`.
- Container: `plugins/r6-litho/` (gitignored, committed with `git add -f`).
- **Zero core changes.** Nothing outside `plugins/r6-litho/` and this file is touched.
- Time spent: ~40 minutes, over the 20-minute budget, mostly on reading
  `GlobeRenderer.js` and the minified `lithosphere` bundle to find out what the
  globe seam actually is.

---

## 1. What I built, and what actually works vs. what is untested

### The feature

A radar sounding track (a GeoJSON `LineString` per observation, one radargram
image per feature) drawn three ways at once:

- the **ground track** on the 2D map and on both globes — inherited wholesale
  from `vector`;
- the **radargram itself** hanging below the surface on the LithoSphere globe as
  a texture-mapped vertical sheet from each track vertex down to the configured
  depth;
- **interface markers** along the track, coloured by depth;
- a **click** anywhere on the track that converts the trace's two-way travel time
  to a depth in metres and reports it.

### Status, bluntly

| check | result |
|---|---|
| `npm run plugins -- validate` | green — 61 plugins valid, one pre-existing unrelated warning (`core/interactions/ChemistryUse` depends on a missing `core/tools/ChemistryTool`) |
| `npm run plugins -- activate` | regenerates `src/pre/layertypes.js` etc. cleanly; caught my deleted `map.js` first |
| plugin unit tests | **18 new tests, all pass** — `npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/r6-litho/` |
| `npm run test:unit` | 1084 pass (no regressions) |
| `NODE_ENV=test npx eslint plugins/r6-litho` | 0 errors; 3 `import/no-anonymous-default-export` warnings, the identical pattern `plugins/core/layertypes/Vector/globe/lithosphere.js:38` has |
| **browser** | **Never opened.** No mission was configured, no radargram image exists, the globe was never rendered. |

So, precisely:

**Tested and I believe correct**
- the depth physics (`depthFromTwoWayTime`, `depthToImageFraction`), the
  nearest-trace search, and the probe's behaviour with and without a travel-time
  property;
- the interface extraction from a feature's properties, including dropping
  entries with no depth rather than drawing them at 0 m;
- the manifest contract of all three plugins, including that the `maxDepthMeters`
  declared to the attachment equals the one declared to the interaction;
- that every `config` form field sits inside its plugin's `configPath`.

**Written, plausible, unverified**
- that a curtain appears under a track at all. `globe/lithosphere.js` builds a
  config for LithoSphere's native `curtain` layerer whose option names I read out
  of the minified bundle (`imagePath`, `imageColor`, `depth`, `lineGeometry`,
  `options.verticalExaggeration`). I have not watched one draw.
- that `extends: "vector"` gives my type the 2D map renderer and `map.picking`,
  which is the *only* reason a click can reach my interaction at all (see §5.2).

**Known broken / not delivered**
- the attachment's 3D half. Interfaces are 2D markers on the track only; they are
  not drawn at depth inside the curtain, because the attachment contract has no
  way to say that (§3.2).
- teardown and toggling of the curtain on the globe (§3.1) — my `destroy` and
  `setVisibility` are never called.
- clicking the curtain in 3D. The interaction only fires from the 2D map (§3.3).

"Validate passes" here means the manifests and module shapes are right. It does
not mean a radargram has ever been on screen. It has not.

---

## 2. Branch and files

Branch: **`devin/r6-litho-1785954627`**

```
plugins/r6-litho/
├── layertypes/Radargram/
│   ├── plugin.json                       typeId "radargram", extends "vector",
│   │                                     capabilities.renderers.globe.engines ["lithosphere"],
│   │                                     defaultAttachments + defaultInteractions with settings,
│   │                                     supportedData, a "Radargram" config tab
│   ├── globe/lithosphere.js              make (one LithoSphere 'curtain' per track feature),
│   │                                     destroy + setVisibility (dead code — §3.1),
│   │                                     exported toCurtainConfig
│   ├── config.js                         normalize: defaults layer3dType 'vector' and
│   │                                     variables.radargram.*
│   ├── lib/radargram.js                  the shared fact table: C_M_PER_NS, DEFAULTS,
│   │                                     settingsOf, depthFromTwoWayTime,
│   │                                     depthToImageFraction, nearestTrace, probe.
│   │                                     Imports nothing — that is what makes it testable
│   │                                     and what the interaction reaches for (§3.5)
│   └── tests/radargram.spec.js           8 @unit tests
├── layerattachments/SubsurfaceInterfaces/
│   ├── plugin.json                       attachmentId "subsurface_interfaces",
│   │                                     configPath variables.layerAttachments.subsurfaceInterfaces,
│   │                                     applicableLayerTypes ["radargram"], host.order 60,
│   │                                     renderers.globe false (deliberate — §3.2),
│   │                                     4-field form on the "Attachment - Markers" tab
│   ├── subsurfaceInterfaces.js           make + syncData; exported depthColor, interfacesOf
│   └── tests/subsurfaceInterfaces.spec.js  5 @unit tests
└── interactions/RadarDepthProbe/
    ├── plugin.json                       interactionId "radar:depth:probe", phase main,
    │                                     order 100, applicableLayerTypes ["radargram"],
    │                                     configPath variables.interactions.radarDepthProbe
    │                                     + a 3-field form
    ├── RadarDepthProbe.js                the adapter: CursorInfo readout,
    │                                     ctx.state.radarDepthProbe for later interactions
    ├── logic.js                          decide(feature, lnglat, config) — pure
    └── tests/radarDepthProbe.spec.js     4 @unit tests
```

Plus this file, `R6-REPORT-litho.md`, at the repo root.

---

## 3. Where the system resisted

### 3.1 On LithoSphere, core never dispatches lifecycle operations back to the plugin

**This is the finding I would act on first.**

The layertypes contract says a globe module's operations are dispatched by core
exactly like a map module's, listing signatures for `destroy`, `setStyle`,
`setVisibility`, `setOpacity` and `timeChange`
(`plugins/core/layertypes/README.md:436-443`). On the **Cesium** engine that is
true. On **LithoSphere** three of them are short-circuited before the registry is
ever consulted:

```js
// src/essence/Basics/Globe_/GlobeRenderer.js:1101
removeLayer(name) {
    if (this.rendererType === 'lithosphere') {
        return this.renderer.removeLayer(name)          // ← registry never consulted
    } else {
        const layerInfo = this._layers[name]
        if (layerInfo) {
            const globeModule = this._globeModuleFor(layerInfo.type)
            if (LayerInterface.hasOp(globeModule, 'destroy')) { … }   // ← Cesium only
```

```js
// src/essence/Basics/Globe_/GlobeRenderer.js:1189
toggleLayer(name, visible) {
    if (this.rendererType === 'lithosphere') {
        return this.renderer.toggleLayer(name, visible) // ← same shape
    }
    …
    if (LayerInterface.hasOp(globeModule, 'setVisibility')) { … }     // ← Cesium only
```

```js
// src/essence/Basics/Globe_/GlobeRenderer.js:1361
setLayerOpacity(name, opacity) {
    if (this.rendererType === 'lithosphere') {
        return this.renderer.setLayerOpacity(name, opacity)
    } else {
        … LayerInterface.hasOp(globeModule, 'setOpacity') …
```

`hasLayer` (`:1220`) is the same.

The README's justification is at
`plugins/core/layertypes/README.md:146-149`:

> That's why map plugins rarely implement `setOpacity`/`setVisibility` (Leaflet is
> uniform), **LithoSphere globe modules usually implement only `make` (it manages
> layers natively by name)**, and Cesium modules implement more […]

That holds **only if the engine layer you created is named `layerObj.name`.** Mine
cannot be. A LithoSphere curtain is textured with exactly one image
(`generateCurtain` builds a single `_material` from `imagePath` and shares it
across every geometry in the layer), while one MMGIS layer holds many tracks with
one radargram each. So `make` necessarily creates several engine layers:

```js
// plugins/r6-litho/layertypes/Radargram/globe/lithosphere.js
.map((f, i) => ({
    name: `${layerObj.name}__radargram_${i}`,
    …
}))
```

Those names are invisible to `renderer.removeLayer(layerObj.name)`. I wrote the
correct contract implementation anyway:

```js
/**
 * NOTE: as of this branch GlobeRenderer.removeLayer() short-circuits to
 * `this.renderer.removeLayer(name)` for the lithosphere engine before the
 * registry is consulted, so this never runs. Kept because it is the correct
 * implementation of the contract as documented.
 */
function destroy(layerName, gctx) {
    const record = gctx.layers?.[layerName]
    if (record?.curtainNames == null) return
    record.curtainNames.forEach((n) => gctx.removeLayer(n))
    delete gctx.layers[layerName]
}
```

and it is, as far as I can tell, **dead code**. The consequence at runtime: remove
a radargram layer and the curtains stay on the globe forever; toggle it off and
they stay visible. `validate` is entirely happy — the module validator checks that
my operation *names* are in the vocabulary
(`plugins/core/layertypes/README.md:580-585`), not that anything calls them.

So the contract's headline claim — "Both surfaces speak the **same operation
vocabulary**, so the interface reads identically on map and globe"
(`plugins/core/layertypes/README.md:119-121`) — is true on Cesium and **partly
fictional on LithoSphere**. It is fine for every core type only because every core
type happens to name its engine layer after the MMGIS layer.

The minimal core fix (which I did **not** make, per the rules) is to give the
lithosphere branch the same registry-first shape the Cesium branch already has:

```js
removeLayer(name) {
    const layerInfo = this._layers[name]
    const globeModule = layerInfo ? this._globeModuleFor(layerInfo.type) : null
    if (LayerInterface.hasOp(globeModule, 'destroy')) { …dispatch…; return }
    if (this.rendererType === 'lithosphere') return this.renderer.removeLayer(name)
    …
}
```

Same for `toggleLayer` and `setLayerOpacity`. Nothing in core would change
behaviour, because no core LithoSphere module declares those ops today.

### 3.2 An attachment cannot draw on the globe through the contract

The feature calls for interface markers *at their depth inside the curtain* —
that is the whole point of doing this in 3D. The attachment operation vocabulary
(`plugins/core/layerattachments/README.md:109-124`) has no operation that can
express it:

- `make` returns `{ on, type, geojson, layer }` where `layer` is documented as
  "**the Leaflet layer** core adds, removes, orders and opacities for you"
  (`:157`);
- the only globe-facing entries are `globeStyle(ctx)` — "merged into the host's
  globe style" (`:121`) — and the capability `globe.suppressesHost` (`:246`);
- there is **no attachment `gctx`**. `addEngineLayer`, `renderer`, `raw`, the
  whole neutral surface that layer types get, does not exist for this family.

And yet the manifest has `capabilities.renderers.globe` — "which globe engines it
draws through" (`:241`) — and the family README's opening example declares
`"globe": { "engines": ["lithosphere"] }`
(`plugins/core/layerattachments/README.md:44-58`). **What does declaring that
actually do?** I could not find an operation it enables.

Core's own globe-drawing attachment does not use the contract either. It reaches
straight through the singleton:

```js
// plugins/core/layerattachments/PathGradient/pathGradient.js:579
function addGlobeGradient(attachment) {
    if (!attachment || !attachment.cesiumGradientOptions) return
    if (!L_.Globe_ || !L_.Globe_.litho) return
    attachment._gradientWantsOn = true
    const gen = (attachment._gradientGen = (attachment._gradientGen || 0) + 1)
    L_.Globe_.litho
        .addLayer('gradient_polyline', attachment.cesiumGradientOptions)
        .then((id) => { … })
```

…and consequently owns its own add/remove/toggle/opacity bookkeeping, including a
generation counter to handle a build that finishes after the user toggled it off
(`pathGradient.js:585-612`). That is ~40 lines of lifecycle that a layer type gets
for free from `gctx`.

I could have copied it. I chose not to: it means writing the plugin against
`L_.Globe_.litho`, which the layertypes README explicitly warns against for the
sibling family — "reach it with `import L_ from '@basics/Layers_/Layers_'` […]
rather than `window.L_`" and, more to the point, "Use neutral
`MapRenderer`/`GlobeRenderer` primitives first"
(`plugins/core/layertypes/README.md:425-429`). So I declared

```jsonc
"capabilities": { "renderers": { "map": { "engines": ["leaflet"] }, "globe": false } }
```

and documented the gap in the module header. **The 3D half of the attachment is
the one part of the requested feature I did not deliver**, and it is a contract
gap, not a time problem.

### 3.3 A click on the globe never reaches an interaction

`ctx.layer` is "**the Leaflet layer** the feature is drawn as"
(`plugins/core/interactions/README.md:48`) and `ctx.event` is "the originating
**Leaflet** event (`event.latlng`, `event.originalEvent`)" (`:53`). The
interaction family is therefore 2D-only by construction. My depth probe's natural
gesture — click the radargram hanging in 3D, at the depth you clicked — cannot be
written at all. What I shipped reads `ctx.event.latlng` from a click on the ground
track on the map, finds the nearest trace, and reports the depth:

```js
// plugins/r6-litho/interactions/RadarDepthProbe/RadarDepthProbe.js
// `ctx.event.latlng` is the map click. A click on the globe curtain
// does not arrive here at all — see the report.
const result = decide(ctx.feature, ctx.event?.latlng, ctx.config)
```

Worth noting that this is dead at the engine level too, so it is not something a
plugin could route around even with a raw handle. LithoSphere's picker *does*
raycast curtain meshes — it pushes `layers.curtain[i].curtain.children` into the
intersect list — tags each mesh `layerType = 'curtain'`, and then explicitly does
nothing with the hit:

```js
// node_modules/lithosphere/public/dist/lithosphere.js (minified, ~offset 1128032)
case "Mesh":
    if ("curtain" === r.layerType) ;          // ← empty branch
    else if ("model" === r.layerType) ;
    else if (r.contains) { … }
```

The `alongTrack` fraction and `imageFraction` my probe computes are exactly the
two numbers a 3D pick would need (which column of the image, which row), so the
maths is ready for the day the seam exists. It just has no caller.

### 3.4 `window.THREE`: the documented answer was to the wrong question

The prompt asked whether `window.THREE` is enough. The honest answer is that I
never needed it, and finding that out took most of my time.

The docs push you towards it hard
(`plugins/core/layertypes/README.md:388-396`):

> On LithoSphere, `renderer` is the live globe: `renderer.layers` […],
> `renderer.scene`/`scenesLOD`/`sceneFront`/`sceneBack` […],
> `renderer.projection` (lat/lng ↔ world coordinates, including `radiusScale`)
> […]. The THREE it draws with is **not** exposed on `raw`, but MMGIS vendors
> THREE and puts it on the window […] so a LithoSphere module builds geometry
> with `window.THREE` — read per call, not at import time […]. MMGIS has none;
> that global is the only copy.

That is a complete and accurate description of the escape hatch, and it *would*
have been enough: `projection.lonLatToVector3(lng, lat, alt)` plus a
`BufferGeometry` with UVs is exactly how you hang a textured sheet below a track.

But LithoSphere **already has a `curtain` layerer that does precisely this**, and
it is reachable through the *neutral* surface:

```js
handles.push(await gctx.addEngineLayer('curtain', config))
```

`getCurtainVertices` walks the line, calls
`projection.lonLatToVector3(lng, lat, z ± depth * verticalExaggeration + verticalOffset)`
for the top and bottom of each segment, and UV-maps the image along the
cumulative ground distance — a radargram, natively. My globe module imports no
THREE at all.

Two things about this are worth recording:

- **It is undocumented in the plugin docs.** `curtain` appears in the whole
  repository only inside `GlobeRenderer.js` — the doc comment at `:523` and `:531`
  ("Layer type: 'tile', 'vector', 'clamped', 'curtain', 'model'") and the Cesium
  warning at `:653`. It is described there as "an attachment render-variant whose
  migration is scoped with the layer-attachment plugins" (`:649`), i.e. as an
  internal detail, not as something a third-party layertype may pass to
  `addEngineLayer`. Neither `plugins/README.md` nor
  `plugins/core/layertypes/README.md` mentions it.
- **I had to read the minified bundle for the option names.** The published
  `lithosphere@1.6.0` package ships only `public/dist/lithosphere.js`; its own
  `package.json` points `types` at `./public/dist/lithosphere.d.ts`, **which is not
  in the tarball**. So there is no type information anywhere, and I recovered
  `{ name, on, geojson | lineGeometry, imagePath | imageColor, depth, opacity,
  order, swapLL, options: { verticalExaggeration, verticalOffset } }` by grepping
  the bundle for `generateCurtain`.

And the corroborating data point for how untrodden this is:
`grep -rn "window.THREE" plugins/` returns **nothing**. No core layer type or
attachment uses the documented escape hatch. Anyone who follows that advice is the
first to.

### 3.5 Three plugins that must agree on one formula have no way to share code

The curtain's depth axis, the interface markers' colour ramp and the probe's
readout are the same physics. There is no seam for that:

- the webpack aliases are `@basics`, `@essence`, `@design`, `@pre`, `@external`
  (`plugins/README.md:1053-1059`) — nothing for "another plugin";
- `pluginDependencies` gates *registry inclusion*, not module resolution
  (`plugins/README.md:942-957`) — declaring it does not make anything importable;
- the CLI tells you a container "is meant to be its own repository" on every
  `create`.

So I did this, and I am not confident it is right:

```js
// plugins/r6-litho/interactions/RadarDepthProbe/logic.js
import { probe } from '../../layertypes/Radargram/lib/radargram'
```

It works (webpack resolves it, the unit test imports it), and within one container
it is arguably fine. Across containers it would be unshippable, and it quietly
couples my interaction's build to a directory layout the CLI is free to change.
The alternative — duplicating `depthFromTwoWayTime` in three places — is worse.
There is no third option today.

---

## 4. The seams between the families

**The fact:** which feature property holds the interface list (`interfaces`),
which key inside each entry holds a depth (`depth_m`), which property holds
two-way travel time (`twt_ns`), the assumed dielectric (`3.15`, water ice), and —
the important one — **what depth the bottom row of the radargram image
represents** (`3000` m). That last number is what makes a pixel row mean a metre;
without it the attachment's colour ramp and the probe's readout are in different
units from the picture the user is looking at.

**How it got there:** by declaration, exactly as the docs prescribe
(`plugins/core/layertypes/README.md:476-533`). My layer type's manifest:

```jsonc
"capabilities": {
    "defaultAttachments": {
        "subsurface_interfaces": {
            "enabled": true,
            "interfacesProp": "interfaces",
            "depthProp": "depth_m",
            "maxDepthMeters": 3000
        }
    },
    "defaultInteractions": {
        "click": {
            "radar:depth:probe": {
                "maxDepthMeters": 3000,
                "twoWayTimeProp": "twt_ns",
                "dielectric": 3.15
            }
        }
    }
}
```

**Did the docs tell me, or did I invent it?** The docs told me, unambiguously and
with the rationale spelled out:

> The property holding a magnitude is a fact your type knows and the attachment
> does not, and before this the only way to pass it along was for your type's
> config rows to write into the attachment's subtree — a string-literal
> `configPath` that broke whenever either plugin was renamed. Now it is declared
> once, and core hands it to the attachment as if an admin had filled the form
> in. (`plugins/core/layertypes/README.md:519-524`)

> **declare what a sibling should be — never write into its subtree.** (`:496`)

Neither sibling learns who configured it. The attachment reads `ctx.config` and
defaults its own values (`optionsOf(config)`); the interaction reads `ctx.config`
and defaults its own (`const { twoWayTimeProp = 'twt_ns', … } = config || {}`).
Both work identically whether the type declared the settings or an admin typed
them. This is the best-designed part of the system and it took no thought to use.

**Where it is still fragile, and what I did about it.** `maxDepthMeters` is now
declared in *three* places: twice in the layer type's manifest (once per sibling)
and once as the layer's own `variables.radargram.maxDepthMeters`, which is what
the curtain actually hangs to. Nothing in core relates them — a mission author who
raises the curtain depth in the Radargram tab silently desynchronises the marker
colour ramp and the probe's `imageFraction`. `validate` cannot catch it; it checks
that the *ids* resolve, not that a shared quantity agrees. So I wrote the only
check available to me, a unit test on my own manifest:

```js
test('the siblings it ships are declared, with their settings @unit', () => {
    const attachment = manifest.capabilities.defaultAttachments.subsurface_interfaces
    expect(attachment.depthProp).toBe('depth_m')
    expect(attachment.maxDepthMeters).toBe(
        manifest.capabilities.defaultInteractions.click['radar:depth:probe'].maxDepthMeters
    )
})
```

Declaring settings *for* a sibling is expressive. Declaring the *same* setting to
two siblings, and to the layer itself, is a copy-paste invariant with no owner.

The one seam I *wanted* and did not get: a way for the layer type to tell the
attachment "and here is the curtain you are decorating" — the engine handle, or
even just the sub-layer names. `gctx.layers[layerObj.name].curtainNames` exists,
but it lives in `GlobeRenderer`'s registry, which an attachment has no context to
reach (§3.2).

---

## 5. Things that failed silently — green validation, nothing happens

1. **My `destroy` and `setVisibility` on the globe module** (§3.1). Declared in
   `export default {}`, statically validated as legal operation names, dispatched
   by nobody. There is no warning, no log, no `validate` diagnostic. The only way
   to find out is to read `GlobeRenderer.js:1101` and `:1189`.

2. **`capabilities.renderers` declaring only `globe`.** My manifest says:

   ```jsonc
   "capabilities": { "renderers": { "globe": { "engines": ["lithosphere"] } } }
   ```

   No `map` key at all, and no `map.picking`/`map.styling` group. Whether this
   type draws on the 2D map, and whether its features are clickable, rests
   entirely on `extends: "vector"` merging those in — "`capabilities()` merges the
   same way, one level into each group, so overriding `map.styling` doesn't drop
   an inherited `map.stacking`" (`plugins/core/layertypes/README.md:90-93`).
   `validate` printed nothing either way. If picking did **not** inherit, my
   interaction would simply never fire, with no diagnostic anywhere in the system —
   the exact failure mode the capabilities section warns about ("they are the one
   part of this contract that fails *quietly* if you get it wrong", `:541-544`),
   except that inheritance puts it outside what the validator checks. I could not
   confirm it without a browser.

3. **Cesium falls back to the parent, silently.** A `radargram` layer on the
   Cesium globe resolves `_globeModuleFor('radargram')` to Vector's Cesium module
   via `extends`, so it draws a plain 3D line — no curtain, no warning, no hint
   that the layer's defining feature is missing. And `addLayerFor` documents this
   as intended: "A type with no globe module for the active engine simply isn't
   drawn on the globe (nothing to do, **no warning**)"
   (`GlobeRenderer.js:474-476`).

4. **`addEngineLayer('curtain', …)` on Cesium is a `console.warn` and nothing
   else** (`GlobeRenderer.js:653-656`). The call is "neutral" in shape only; it
   compiles, resolves, returns, and produces no geometry. A plugin author who
   writes one globe module and assumes the neutral primitive is engine-agnostic
   gets a silently empty globe on half the deployments.

5. **The attachment's `renderers.globe` capability** (§3.2). Setting it to
   `{ engines: ['lithosphere'] }` validates fine and, as far as I can tell,
   enables nothing — there is no globe operation for it to gate. A declaration
   that is read by nobody is the same failure shape the layertypes README
   deliberately removed (`capabilities.filtering`/`identify`, "which nothing
   read — are gone", `plugins/core/layertypes/README.md:562-567`).

6. **A near-miss that was *not* silent, and deserves credit.** When I deleted the
   scaffolded `map.js`, `validate` said:

   ```
   ⚠ src/pre/layertypes.js: imports plugins/r6-litho/layertypes/Radargram/map which no longer exists
     Run npm run plugins -- activate to regenerate src/pre/.
   ```

   That is exactly the class of stale-registry bug that would otherwise have been
   a blank screen. More of this, please.

---

## 6. Docs: confusing, missing or contradictory

| where | problem |
|---|---|
| `plugins/core/layertypes/README.md:146-149` | "LithoSphere globe modules usually implement only `make` (it manages layers natively by name)" reads as *advice about what is usually necessary*. It is in fact a **hard constraint**: on LithoSphere the other lifecycle ops are not dispatched at all (§3.1). It should say so, and say that engine layers must be named `layerObj.name` for native management to find them. |
| `plugins/core/layertypes/README.md:436-443` | The globe operation signature table lists `destroy`, `setStyle`, `setVisibility`, `setOpacity`, `timeChange` with no engine qualifier. Read together with `:119-121` ("the same operation vocabulary […] identical on map and globe") this actively promises something LithoSphere does not do. |
| `plugins/core/layertypes/README.md:388-396` | Sends a LithoSphere author to `window.THREE` and the scene graphs without mentioning that the engine has ready-made `curtain` and `gradient` layerers reachable via the neutral `gctx.addEngineLayer`. The list of engine-only types exists only in a doc comment at `GlobeRenderer.js:531`. This cost me the most time of anything in the round. |
| `plugins/core/layertypes/README.md:380` | "`raw` is a formality and the work happens through `renderer` and `window.THREE`" — for a type that can use an existing layerer, the work happens through `addEngineLayer` and neither of those. |
| `plugins/core/layerattachments/README.md:44-58` vs `:109-124` | The manifest example declares `renderers.globe: { engines: ['lithosphere'] }` and the capability table (`:241`) says it controls "which globe engines it draws through", but the operation table has **no globe operation**. What an attachment author is supposed to *write* is unstated; the honest answer (per `PathGradient`) is "call `L_.Globe_.litho` yourself and own the lifecycle", which contradicts the neutral-primitives-first rule the sibling README gives at `layertypes/README.md:425-429`. |
| `plugins/core/layerattachments/README.md:246` | `globe.suppressesHost` is described as "on the globe this attachment *is* the host's geometry" — which implies the attachment draws on the globe — while nothing in the operations table lets it. |
| `plugins/core/interactions/README.md:48,53` | `ctx.layer` and `ctx.event` are Leaflet-only. Worth stating explicitly that interactions are a 2D-only family, since layer types are now emphatically bi-surface and a reader naturally assumes the pipeline follows. |
| `plugins/README.md:1053-1061` | The alias table has no entry for another plugin, and nothing anywhere says how two plugins of one feature should share pure code. `pluginDependencies` (`:942-957`) is easy to mistake for that mechanism — it explicitly is not (§3.5). |
| `plugin-cli` scaffolds | `create layertype <Name>` always writes `map.js` plus `"renderers": { "map": { "engines": ["leaflet"] } }` and `"globe": false`. There is a `--extends` flag but no `--globe <engine>`, so a globe-first author's first action is deleting the scaffold and hand-writing `globe/<engine>.js`. The "Next steps" text does point at it, which softened the landing. |
| `plugins/core/layertypes/README.md:632-640` (checklist) | Step 7 says run `validate` then `activate`. In practice the order that avoids a stale-registry warning is `activate` **then** `validate`, since `validate` is what reports the staleness `activate` fixes. |
| positive | `plugins/README.md:1103-1122` (Testing Plugins) is exactly right and saved me real time — that `test:unit` covers only `tests/unit`, that `@unit` is the selecting tag, and that `PLAYWRIGHT_TEST_UNIT_ONLY=true` is what avoids the Postgres global setup. Same for the `NODE_ENV=test npx eslint` note at `:1077-1081`, which describes a failure that "looks unrelated to your code" — it would have. |

---

## 7. What I liked, and what was easier than expected

- **`extends: "vector"` is the single best feature here.** It carried the entire
  2D half of my feature — styling, picking, filtering, feature selection, the
  Cesium globe, dynamic extent — so a genuinely novel 3D renderer came out as one
  globe module, a 15-line `config` surface, and a manifest. I wrote no `map.js` at
  all. The per-operation (not per-surface) merge meant I could replace
  `globe.lithosphere` and keep everything else without thinking about it.

- **`defaultAttachments` / `defaultInteractions` with settings** did exactly what
  §4 describes: three plugins wired into one coherent feature with no plugin
  reading another's config subtree, no string-literal `configPath` in my code, and
  no Configure-page work. The rule "declare what a sibling should be — never write
  into its subtree" is the kind of guidance that makes the right thing the easy
  thing.

- **`gctx.addEngineLayer` over-delivered.** I expected to write a `BufferGeometry`
  by hand and got a one-line call instead. `gctx` being a plain object with
  obvious fields made the globe module easy to reason about even without running
  it.

- **`validate`'s cross-family checks.** Catching an `attachmentId` nobody
  provides, a `defaultAttachment` that refuses your type as a host, and a stale
  generated registry — these are precisely the errors that would otherwise present
  as "nothing happened". It is the reason I trust the manifest half of this work
  despite never opening a browser.

- **The scaffolds' `logic.js` / handler split** put the testable-pure-module
  pattern in front of me before I could get it wrong, with the reason written in
  the file. All three of my plugins ended up structured that way and all 18 tests
  are pure-Node fast.

- **Configure forms from the manifest.** Declaring `config.rows` with fields under
  `configPath` and getting an admin UI with no UI code is a genuinely large amount
  of leverage for a third-party author.

---

## 8. Top 3 recommendations, ranked

### 1. Make the LithoSphere branch of `GlobeRenderer` dispatch through the registry, like the Cesium branch already does

`removeLayer` (`:1101`), `toggleLayer` (`:1189`), `setLayerOpacity` (`:1361`) and
`hasLayer` (`:1220`) should try
`_globeModuleFor(this._layers[name]?.type)` **before** falling back to
`this.renderer.*`. Behaviour for every core type is unchanged (none of them
declare those ops on LithoSphere), and it removes the worst trap in the system:
a plugin whose declared, validated lifecycle operations are never called, leaking
engine geometry with no diagnostic. If that is too invasive, then at minimum make
`validate` **error** when a LithoSphere globe module declares `destroy`,
`setVisibility` or `setOpacity` — a loud "this will never run" beats a silent
leak. Highest value per line changed of anything in this report.

### 2. Give layer attachments a globe surface, and until then document the singleton path as the sanctioned one

Either an attachment-scoped `gctx` (`addEngineLayer`, `renderer`, `raw`) handed to
new `makeGlobe`/`destroyGlobe`/`setGlobeVisibility` operations, or — cheaper —
formally document that a globe attachment calls `L_.Globe_.litho` itself and owns
its own add/remove/toggle/opacity, with `PathGradient`'s generation-counter
pattern (`pathGradient.js:579-612`) as the reference. What must not stay is the
present state: a `capabilities.renderers.globe` that declares an intent the
vocabulary cannot express, and one core plugin quietly doing it a way the docs
tell everyone else not to. This is what stopped a third of my feature from
existing.

### 3. Document the engine render-variants and add a globe-first scaffold

Put `curtain`, `clamped` and `gradient_polyline` — what they draw, what config
they take, which engines implement them — into
`plugins/core/layertypes/README.md`, **ahead of** the `window.THREE` escape hatch,
with a line saying which of them Cesium lacks so the fork is a decision rather
than a surprise. Add `npm run plugins -- create layertype <Name> --globe lithosphere`
alongside `--extends`, writing `globe/<engine>.js` and the matching
`capabilities.renderers` instead of `map.js`. I nearly hand-rolled a textured
mesh for something the engine has had since 1.6.0, and the next author will too.

*Runner-up, because it is a bigger job than the three above but is the real
ceiling on this feature:* an interaction `ctx` that can carry a globe pick
(engine, world position, the layer and feature it resolved to, and for a
curtain-like layer the fraction down the sheet). LithoSphere already raycasts the
curtain meshes and tags them `layerType: 'curtain'` before discarding the hit in
an empty `if` branch — the information exists and is thrown away at both levels.
Until it survives, "3D layer types with 2D-only interactions" is a permanent seam,
and the depth probe can only ever report the depth under a point you clicked on a
flat map.
