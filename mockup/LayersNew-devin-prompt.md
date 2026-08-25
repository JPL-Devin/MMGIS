# Devin prompt — build `LayersNew`, a React LayersTool with type-owned settings

This file is a **ready-to-paste prompt** for a future Devin session, plus the audit
that backs it. It follows the mockups in this directory: `02-settings-vector.png`
(tabs + full-height settings), `06-drawer.png` (slide-over), `11-compositor.png`
(raster thumbnails), `01-layer-list.png` (enhanced, non-primary search).

Read it in this order:

- [§1 The prompt](#1-the-prompt) — paste this into a new session.
- [§2 Repo facts the implementer must not re-derive](#2-repo-facts)
- [§3 The `settings` registry surface (contract)](#3-the-settings-surface)
- [§4 Architecture and file layout](#4-architecture)
- [§5 Feature parity matrix](#5-feature-parity-matrix) — every behavior of the old tool, with an owner.
- [§6 Phases](#6-phases)
- [§7 Acceptance criteria](#7-acceptance-criteria)
- [§8 Tests](#8-tests)
- [§9 Explicitly deferred](#9-explicitly-deferred)

---

## 1. The prompt

> Build a new core tool `LayersNew` in MMGIS: a React reimplementation of the
> LayersTool where **layer types own their settings UI** and the tool discovers
> and renders it. Do not modify, rename or delete the existing
> `plugins/core/tools/Layers/` — the two tools ship side by side, and the old one
> stays the default until a separate cutover task.
>
> The interaction model is fixed (it came out of `/mockup`):
>
> - Layer list is the home view: rows with visibility checkbox, type color/drag
>   handle, name, badges, and row actions; groups nest and expand/collapse.
> - Opening a layer's settings **replaces the whole tool panel** with a
>   full-height settings view; a back arrow at the top-left of the settings
>   header returns to the list, and the panel title becomes the layer name.
> - Inside settings, sections are grouped into **tabs** (design-system `Tabs`).
> - On mobile / narrow layouts (and when the tool is opened from a row action
>   while the panel is unavailable), the same settings view renders as a
>   **slide-over drawer** over the list rather than a page swap. One component
>   tree, two presentations.
> - Raster layers (`tile`, `image`, `data`, `velocity`) show a **thumbnail** in
>   their list row when one can be derived; graceful text/color fallback
>   otherwise.
> - The search bar is **enhanced but not primary**: it sits above the list
>   (never a modal palette), searches names, descriptions and `#tags` with tag
>   autocomplete, highlights matches, and auto-expands matching groups.
>
> Hard requirements:
>
> 1. **React + existing design system.** Compose `src/design-system/components/*`
>    (`Button`, `IconButton`, `IconTextButton`, `Checkbox`, `Switch`, `Toggle`,
>    `Collapsible`, `Dropdown`, `Select`, `Slider`, `RangeSlider`,
>    `InputWithUnit`, `Modal`, `ProgressButton`, `RadioGroup`, `ColorRampPicker`,
>    `Tabs`, `Tooltip`, `Toast`). New **generic** components go in
>    `src/design-system/`; new **MMGIS-specific** ones in
>    `src/essence/Basics/UserInterface_/`. Do not hand-roll a control that
>    already exists, and do not restyle a design-system component from
>    `LayersNew`'s CSS.
> 2. **Type-owned settings.** Add one new layer-type plugin surface, `settings`,
>    dispatched through `LayerTypeRegistry` exactly like `map`/`config`/`filter`/
>    `legend`. A type declares `"modules": { "settings": "./settings" }`, and the
>    module's `sections(layer, ctx)` returns React components. `LayersNew`
>    renders whatever it gets and hardcodes **no** `layerObj.type` string
>    anywhere. See §3 for the exact contract; implement it as specified.
> 3. **Universal behavior stays in core.** Visibility, opacity, reset, locate,
>    export, time, info, reload, attachments, filtering entry point, search,
>    type filters, ordering, grouping, lifecycle and cleanup are `LayersNew`'s,
>    not any type's. Types get the type-specific tail (COG/expression, colormaps,
>    rescale, image ranges, velocity, video transport, data shaders, dynamic
>    style controls) — see the split in §5.
> 4. **Nothing from the old tool disappears silently.** §5 is a complete
>    inventory of the old tool's behavior. Every row must end up implemented,
>    or listed in the PR description as deferred with a reason and a follow-up
>    note. A missing row is a bug, not a scope decision.
> 5. **No behavior changes to shared services to make your life easier.** Read
>    from and command through the existing singletons (`L_`, `Map_`, `Globe_`,
>    `F_`, `ToolController_`, `Filtering`, `TimeUI`, `LegendTool`,
>    `LayerAttachmentRegistry`, `DataShaders`, `LayerInterface`). If a shared
>    module genuinely needs a small additive hook (e.g. a new subscription), add
>    it additively and say so in the PR.
>
> Work in phases (§6), open the PR after phase 5 is green, and keep the PR
> description carrying the parity table with a status per row.

---

## 2. Repo facts

Verified in the current `development` checkout — do not re-derive these.

**The old tool.** `plugins/core/tools/Layers/LayersTool.js`, ~3,875 lines, jQuery
string-concatenated markup + SortableJS + a React island for dynamic-style ramps
(`components/DynamicStyleRamp.jsx` mounted with `createRoot`). Siblings:
`LayersTool.css`, `LayerInfoModal/`, `tests/layers.spec.js`, `plugin.json`.

**How a tool is registered.**

- `plugin.json` at `plugins/core/tools/<Name>/` with `name`, `paths`
  (`{ "<Export>Tool": "./<Export>Tool" }`), `defaultIcon`, `expandable`,
  `hasVars`, `config` (Configure-page form for its `variables`), optional
  `separatedTool: true | "custom"`.
- `API/updateTools.js → updateTools()` regenerates `src/pre/tools.js`
  (`toolConfigs` + statically imported `toolModules`). Run
  `npm run plugins -- activate`; scaffold with
  `npm run plugins -- create tool LayersNew --force` (`--force` is required for
  core-tier scaffolding) and then edit the generated manifest.
- `ToolController_.init(tools)` calls each module's `initialize()`, then
  `make()`/`destroy()` on activation. A tool appears in the toolbar only if the
  **mission config** lists it: `blueprints/Missions/Reference-Mission/config.reference-mission.json`
  → `"tools": [ … { "name": "LayersNew", "icon": "layers-triple", "js": "LayersNewTool", "variables": { … } } ]`.
  Add it there (and to the Mars/Lunar reference configs) so both tools are
  reachable during development. `L_.getToolVars('layersnew')` matches on
  lowercased manifest `name`.
- Tool module shape: `{ width, height, vars, initialize(), make(t, fromInit),
  destroy(), getUrlString(), finalize() }`. `width: 'full'` + numeric `height`
  is the mobile mode the old tool sets from the map rect.

**React tool precedents** — follow `SightlineTool` most closely (zustand store +
one `createRoot` into `#toolPanel`, unmounted in `destroy`):

- `plugins/core/tools/Sightline/SightlineTool.js:216` — `createRoot(toolPanel)`, store via `useSightlineStore`.
- `plugins/core/tools/Curtain/CurtainTool.js:277` — root cached on the container, unmounted in `destroy`.
- `zustand@^4.5.7` is already a dependency; `src/essence/Basics/UserInterface_/store/uiStore.js` is the existing UI store (`activeToolName`, `toolsList`, `separatedToolsList`).

**Layer-type registry.** `src/essence/Basics/Layers_/registry/LayerTypeRegistry.js`
resolves `layerObj.type` → surface modules with **zero hardcoded type ids**,
supports one level of `extends`, merges `capabilities`, and flattens a
single-`module` plugin shape. Surfaces today: `map`, `globe.{cesium,lithosphere}`,
`config`, `filter`, `time`, `source`, `legend`, `attachment`.
`src/essence/Basics/Layers_/interface/LayerInterface.js` dispatches ops
(`hasOp`, `run`, `runSync`, before/main/after phases).
`API/pluginValidation.js:107` `SURFACES` declares each surface's op vocabulary
and whether `make` is required; `flattenLayerModules` + `generateLayerRegistry`
in `API/updateTools.js` emit imports for any declared module key
(extension-less, so `settings.jsx` resolves).
Layer types live in `plugins/core/layertypes/{Tile,Vector,VectorTile,Query,Data,Model,Velocity,Image,Video,Header,ThreeDTiles}`.

**Services the old tool leans on.**

| Module | Used for |
| --- | --- |
| `L_` (`src/essence/Basics/Layers_/Layers_.js`) | source of truth: `layers.data`, `layers.layer`, `layers.on`, `layers.dataFlat`, `_layersOrdered`, `layers.attachments`; `toggleLayer`, `toggleLayerHelper`, `setLayerOpacity`/`getLayerOpacity`, `setSublayerOpacity`, `toggleSublayer`, `setAttachmentVisibility`, `reorderLayers`, `setGlobalLoading`/`setGlobalLoaded`, `subscribeOnLayerToggle`/`unsubscribeOnLayerToggle`, `getToolVars`, `asLayerUUID`, `expandLayersToArray`, `convertGeoJSONLngLatsToPrimaryCoordinates`, `getDynamicProps` |
| `Map_` | `map.fitBounds`, `refreshLayer`, `orderedBringToFront`, `makeLayer` |
| `Filtering` (`Layers_/Filtering/Filtering.js`) | `initialize()`, `make(container, layerName)`, `destroy()`, `filters`, `isFilterable`, `getAggregations`, `applyFilter` — **DOM-container based, jQuery inside** |
| `TimeUI` | `updateTimes(start, end, current)` |
| `LegendTool` | legend refresh; `Layers_/legend/LayerLegend.js` → `deriveLegend(layerObj)`, `derivesLegend(layerObj)` |
| `LayerAttachmentRegistry` | `describe`, `idForSublayerKey`, per-attachment `dropdownFunc` |
| `DataShaders` | `getHTML()`, `attachEvents()`; calls back into `ToolController_.getTool('LayersTool').populateCogScale(name)` (`services/DataShaders.js:660`) |
| `layerDynamicStyle` (`Layers_/render/layerDynamicStyle.js`) | `overrideDynamicStyle`, `overrideDynamicStyleRuleOf`, `RESTYLED_EVENT`, compiled domains |
| `LayerInfoModal` | `LayerInfo.open(layerName)` |
| `Help`, `CursorInfo`, `Toast`, `tippy`, `markjs`, `calls`, `tokml`, `shp-write` | help text, warnings, toasts, tooltips, match highlighting, `geodatasets_get`, KML/SHP export |

**External callers that reach into the tool by name** (all must keep working for
`LayersTool`, and `LayersNew` must behave correctly under the same events):

- `Layers_/hierarchy/tree.js:99` and `:258` — after `modifyLayer`/`updateLayersHelper`, if the active tool is `LayersTool` it calls `destroy(); make()`, and clears `orderingHistory`.
- `mmgisAPI.js:453` — `toggleLayer` pokes `#layerstart<safe> .checkbox` DOM directly when `LayersTool` is active.
- `services/DataShaders.js:660` — calls `populateCogScale(name)` on the active tool if present.

→ **Design consequence:** these are keyed on `activeToolName === 'LayersTool'`, so
they no-op for `LayersNew`. `LayersNew` must not depend on them: it re-renders from
store subscriptions instead of `destroy()/make()`, keeps checkbox state from
`L_.layers.on` via `subscribeOnLayerToggle`, and exposes `populateCogScale` as a
compatibility method plus its own reactive path. Extend those three call sites to
`ToolController_.activeToolName.startsWith('Layers')`-style checks **only**
additively (guarded, no behavior change for the old tool), and note it in the PR.

**Constants worth copying verbatim** (`LayersTool.js:68-80`):
`DEFAULT_LAYER_TYPE_COLOR = 'var(--color-a4)'`, `quasiLayers = ['model','query']`,
`DEPTH_SIZE = 13`, `INDENT_COLOR = 'var(--color-a)'`,
`IMAGE_DEFAULT_COLOR_RAMP = 'binary'`, `TILE_DEFAULT_COLOR_RAMP = 'viridis'`,
`VELOCITY_DEFAULT_COLOR_RAMP = 'rdylbu_r'`. Type colors come from each layer type's
`plugin.json` `color` (e.g. Tile `#67401d`), not from a table in the tool.

**Repo rules** (`AGENTS.md`): generic UI in `src/design-system/`, MMGIS-specific in
`src/essence/Basics/UserInterface_/`; hot reload for dev; no raw SQL; **never edit a
test to make it pass**; don't push to `main`/`master`. Tests are Playwright:
`npm run test:unit`, `npm run test:plugins:unit`, `npm run test:plugins`. CI jobs
that matter: `test (local)`, `test (off)`, `secret-detection`, `generate-tags`,
`bump-version` (the arm64/amd64 Docker image builds fail pre-existing).

---

## 3. The `settings` surface

### 3.1 Manifest and validation

```jsonc
// plugins/core/layertypes/Tile/plugin.json
"modules": {
  "map": "./map",
  "config": "./config",
  "legend": "./legend",
  "time": "./time",
  "settings": "./settings",          // NEW — a .jsx module
  "globe": { "cesium": "./globe/cesium", "lithosphere": "./globe/lithosphere" }
}
```

In `API/pluginValidation.js`, alongside the existing surfaces:

```js
const SETTINGS_OPS = ['sections', 'tabs', 'rowExtras', 'thumbnail', 'actions', 'summary']
SURFACES.settings = { ops: SETTINGS_OPS, requiresMake: false }
```

`surfaceOfModuleKey` already returns `settings` once `SURFACES.settings` exists,
and `generateLayerRegistry` already emits the import. Add `settings` to the
registry accessor for symmetry:

```js
// LayerTypeRegistry
getSettings(typeId) { return _effectiveModules(typeId)?.settings },
hasSettings(typeId) { return this.getSettings(typeId) != null },
```

Inheritance (`extends`) and the single-`module` shape must work for `settings`
with no extra code — verify with a unit test, don't assume.

### 3.2 Module contract

Only `sections` is required. Everything else is optional with a core fallback.

```jsx
// plugins/core/layertypes/Tile/settings.jsx
export default {
    /**
     * @param {object} layer  the layer config object (L_.layers.data[name])
     * @param {object} ctx    { capabilities, api, isOn, runtime, vars, withTitiler }
     * @returns {Array<Section>} Section = {
     *   id: string,              // stable, used for tab/section keys and deep links
     *   label: string,
     *   tab?: string,            // tab id this section belongs to; default 'settings'
     *   Component: React.FC<{ layer, layerName, api, ctx }>,
     *   badge?: string|number,   // e.g. active filter count
     *   order?: number,
     *   hidden?: boolean         // computed, e.g. no COG url → no expression section
     * }
     */
    sections(layer, ctx) { … },

    /** Optional tab ordering/labels; default = one tab per distinct `tab` id. */
    tabs(layer, ctx) { return [{ id: 'style', label: 'Style' }, { id: 'source', label: 'Source' }] },

    /** Optional row decorations in the layer list (badges, small status text). */
    rowExtras(layer, ctx) { return { badges: [{ id: 'cog', label: 'COG' }] } },

    /** Optional list-row thumbnail: a url, or a component, or null. */
    thumbnail(layer, ctx) { return { url: … } },

    /** Optional extra row action buttons (icon + handler). */
    actions(layer, ctx) { return [{ id: 'clearCache', icon: 'delete', title: 'Clear cache', onClick: … }] },

    /** Optional one-line summary shown under the name / in the settings header. */
    summary(layer, ctx) { return '2 bands · viridis · 0–255' },
}
```

`api` is built by core, one instance per open layer, and is the **only** way a
section touches the world:

```js
api = {
  get(path),                  // read from the layer's runtime/variables (lodash-style path)
  set(path, value),           // write + mark dirty; batched
  isOn(), ensureOn(),         // turning a layer on because settings need it is core's policy
  opacity(), setOpacity(v),
  restyle(),                  // dispatch the type's setStyle / dynamic-style restyle
  refreshLayer(),             // Map_.refreshLayer
  refreshLegend(),            // deriveLegend + LegendTool refresh
  resetSettings(scope),       // 'all' | section id
  runtime(),                  // L_.layers.layer[name] (Leaflet/engine object) — read-only use
  globe(),                    // Globe_ handle if present
  notify(kind, message),      // Toast / CursorInfo
  vars(),                     // layer.variables
  capabilities(),             // LayerTypeRegistry.capabilities(type)
  withTitiler: boolean,       // window.mmgisglobal.WITH_TITILER === 'true'
}
```

### 3.3 Shared section components (this is what keeps types thin)

Dynamic style, colormap/rescale and export controls are ~1,500 of the old tool's
lines and are shared by several types. Ship them **once** as exported components,
and let each type's `settings.jsx` compose them:

```jsx
// src/essence/Basics/Layers_/settings/sections.js  (core, importable by any type)
export { DynamicStyleSection }   // vector, vectortile, query
export { ColorRampSection }      // tile(COG), image, velocity, data
export { RescaleSection }        // min/max + units + reset
export { ExpressionSection }     // COG band math + STAC asset discovery
export { RasterAdjustSection }   // brightness/contrast/saturation/blend
export { VideoTransportSection } // play/pause/restart/mute/scrub
export { DataShaderSection }     // legacy DataShaders.getHTML bridge
```

```jsx
// plugins/core/layertypes/Vector/settings.jsx
import { DynamicStyleSection } from '@basics/Layers_/settings/sections'
export default {
    sections(layer, ctx) {
        return [
            ctx.capabilities.styling?.dynamic !== false && {
                id: 'dynamicStyle', label: 'Dynamic Style', tab: 'style',
                Component: DynamicStyleSection,
            },
        ].filter(Boolean)
    },
}
```

The invariant the user asked for holds — a type decides **whether**, **where** and
**in what order** its settings appear, and can replace any shared section with its
own — while core still owns the one implementation of hard logic.

### 3.4 Core fallback when a type has no `settings` module

`LayersNew` renders universal sections (Opacity, Filter if filterable,
Attachments, Reset) and, for types that still expose legacy shader HTML, the
`DataShaderSection` bridge. No blank panel, no crash, no type check.

---

## 4. Architecture

```
plugins/core/tools/LayersNew/
  plugin.json
  LayersNewTool.jsx            # tool module: initialize/make/destroy/finalize/getUrlString + createRoot
  LayersNewTool.css
  store.js                     # zustand: view, selectedLayer, search, typeFilters, headerStates, drag
  components/
    LayersPanel.jsx            # switches list ⇄ settings (page swap) / renders drawer
    Toolbar/SearchBar.jsx      # enhanced search + tag autocomplete + clear
    Toolbar/TypeFilters.jsx    # per-type + visible-only + has-filter-only
    Toolbar/ListActions.jsx    # expand all / collapse all / restore order
    List/LayerList.jsx         # virtualized-ready flat render of the tree
    List/LayerRow.jsx          # checkbox, color/drag handle, thumbnail, name, badges, actions
    List/GroupRow.jsx          # header row: expand, group power, count
    List/RowActions.jsx        # settings, info, time, reload, locate, export
    List/Thumbnail.jsx
    Settings/SettingsView.jsx  # full-height: header(back, name, summary) + Tabs + sections
    Settings/SettingsDrawer.jsx# same tree in a slide-over
    Settings/SectionHost.jsx   # error boundary + Collapsible + registry-driven render
    Settings/UniversalSections.jsx  # opacity, filter mount, attachments, reset
    Export/ExportDialog.jsx
    FilterMount.jsx            # imperative bridge: renders a div, calls Filtering.make(el, name)
  hooks/
    useLayerTree.js            # tree + search + filters + header states → flat rows
    useLayerVisibility.js      # toggle w/ loading guard + global loading + events
    useLayerSettings.js        # builds `api`, resolves sections/tabs from the registry
    useLayerOrdering.js        # dnd + depth + ordering history + url string
    useLayerThumbnail.js
    useRefreshStatus.js        # layerRefreshStatusChanged
    useRestyled.js             # RESTYLED_EVENT
  adapters/
    layersAdapter.js           # all L_ reads/writes used by the tool
    exportAdapter.js           # GeoJSON/KML/SHP + geodataset + extent logic
    timeAdapter.js             # TimeUI + layer time fields
    legendAdapter.js           # deriveLegend + LegendTool refresh
    attachmentsAdapter.js      # LayerAttachmentRegistry + sublayer ops
  tests/
    layersnew.spec.js          # @unit unit tests + e2e
src/essence/Basics/Layers_/settings/sections.js  # shared section components (§3.3)
src/design-system/components/…                   # only genuinely generic additions
```

Rules:

- **One React root**, created in `make()` into `#toolPanel`, unmounted in
  `destroy()`. No per-row roots. The dynamic-style ramp is a normal child
  component now, not an island (`_dynamicStyleRoots` disappears).
- **Re-render, don't rebuild.** Subscribe to `L_` events and update the store;
  never `destroy()+make()` yourself.
- **Adapters are the only place `L_`/`Map_`/etc. are touched.** Components and
  sections go through hooks/`api`. This is what makes the unit tests possible.
- `Filtering` stays jQuery/imperative: wrap it in `FilterMount` (a `useEffect`
  that calls `Filtering.destroy()`/`Filtering.make(el, layerName)` and tears
  down on unmount). Do **not** rewrite `Filtering` in this task.
- Drag-and-drop: keep `sortablejs` (already a dependency) driven from a ref, or
  use it via a small hook; do not add a new dnd library.

---

## 5. Feature parity matrix

Owner codes: **C** core `LayersNew` · **T** layer-type `settings` module ·
**S** shared section component (§3.3) · **A** adapter/hook · **F** compatibility
fallback · **D** deferred (§9).

### 5.1 Lifecycle, sizing, panel

| Old behavior | Owner | Notes |
| --- | --- | --- |
| `initialize()` reads `L_.getToolVars('layers')`, `vars.width` | C | `getToolVars('layersnew')`; keep `variables.expanded` |
| Mobile: `width='full'`, `height = round(mapRect.height * 0.7)` from `#map` | C | same computation; also drives drawer-vs-page presentation |
| `make(t, fromInit)` builds the interface | C | `createRoot(#toolPanel)` + render |
| `finalize()` replays `L_.FUTURES.tools` ordering history, then `make()`+`destroy()`, then `Filtering.initialize()` | C+A | same URL-restore semantics; `Filtering.initialize()` must still run exactly once |
| `getUrlString()` = `orderingHistory.map(h => h.join('-')).join('.')` | C+A | identical serialization so existing links keep working |
| `destroy()` unmounts dynamic-style roots + `separateFromMMGIS()` | C | unmount the single root; remove every listener/timer (see 5.14) |
| `expandable: true` panel behavior, tool width `vars.width` | C | manifest parity with `Layers/plugin.json` |
| External `destroy()/make()` on layer add/update/remove (`tree.js`) | C+A | react to it via store refresh; also stay correct if it is called |

### 5.2 List and tree

| Old behavior | Owner | Notes |
| --- | --- | --- |
| `depthTraversal(node, parent, depth)` recursion over `L_.layers` + `sublayers` | A (`useLayerTree`) | produce a flat row model with `depth`, `parent`, `type`, `name`, `displayName` |
| `_maxDepth` tracking, `DEPTH_SIZE = 13` indentation, `INDENT_COLOR` guides | C | keep pixel-equivalent indentation |
| Header rows with child layer counts | C | count = visible descendants under current search/filter |
| Type color swatch (doubles as the drag handle, `.layersToolColor`) | C | color from the type manifest, fallback `var(--color-a4)` |
| `layernotfound` state when `L_.layers.layer[name] == null` and type not in `quasiLayers` | C | disabled row + tooltip; identical `quasiLayers` list |
| Current on/off from `L_.layers.on` | A | single source of truth, never local state |
| Display name / `displayName` override, escaping (`F_.escapeHtml`, `F_.getSafeName`) | C | React escapes; keep `getSafeName` for `data-*`/test ids |
| Row DOM ids (`#LayersTool<safe>`, `#layerstart<safe>`) | C+F | keep equivalent `data-layer` attrs **and** `id="layersnew<safe>"`; old ids stay unique to the old tool |

### 5.3 Groups / headers

| Old behavior | Owner | Notes |
| --- | --- | --- |
| `toggleHeader(id)` expand/collapse, nested | C | store `headerStates` |
| `traverseHeaderLayersExpandedState(...)` restore configured expansion (`variables.expanded`) | C | |
| Expand all / collapse all | C | |
| Header "power" toggle switching all children | C | |
| Remember which children were on before a group was switched off; restore them on re-enable | C | parity-critical, easy to lose — test it |
| `layersToolHeaderStateChange` event dispatch | C | keep the event name (external listeners) |
| Header rows are structural (`LayerTypeRegistry.isStructural`) | C | never ask a header for settings |

### 5.4 Visibility

| Old behavior | Owner | Notes |
| --- | --- | --- |
| `toggleLayer(checkbox)` with `loading` class guard (ignore clicks while loading) | A (`useLayerVisibility`) | keep the guard + the console warning |
| `L_.setGlobalLoading(name)` / `setGlobalLoaded(name)` around `await L_.toggleLayer(...)` | A | |
| Per-row loading indicator | C | design-system spinner in the checkbox slot |
| Sync with external toggles via `L_.subscribeOnLayerToggle('LayersNew', …)` | A | unsubscribe in `destroy` |
| `layerVisibilityChange` event dispatch | C | keep name/payload |
| `quasiLayers` (`model`, `query`) toggling without a Leaflet layer | C | |
| Missing / unavailable layer handling on toggle | C | toast + row state |

### 5.5 Row actions

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Settings button opens settings (and enables the layer when the settings need it) | C | `api.ensureOn()` policy stays core |
| Info button → `LayerInfoModal.open(name)` | C | reuse the existing modal as-is |
| Time button → open time panel / time display | C+A | |
| Reload / refresh button + `layerRefreshStatusChanged` warning state | C+A (`useRefreshStatus`) | |
| Locate: require layer on → `layer.getBounds()` else `data.boundingBox` → `Map_.map.fitBounds`; warn toasts on each failure | C+A | keep all three failure messages |
| Export button opens the export UI | C | see 5.9 |
| Visibility checkbox | C | |
| Type-contributed extra actions | T | `actions()` (§3.2) |

### 5.6 Settings shell

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Inline `.settingsmain*` block per type, built by string concat | C | replaced by full-height view + `Tabs` + `SectionHost` |
| Opening settings turns the layer on when required | C | |
| Universal opacity slider | C | `Slider` + `L_.setLayerOpacity` |
| Raster brightness / contrast / saturation / blend mode | S (`RasterAdjustSection`) | declared by `tile`, `image`, `data`, `velocity` |
| Per-type settings (vector, vectortile, query, data, model, velocity, image, video, tile) | T (+S) | one `settings.jsx` per type under `plugins/core/layertypes/<Type>/` |
| Reset settings | C | `api.resetSettings('all')` restores configured values; per-section reset via section id |
| Settings panel lifecycle (build on open, tear down on close) | C | mount/unmount of `SettingsView`; sections must clean up in `useEffect` returns |
| Configure-page mirror sections | D | see §9 — open question from the mockup phase |

### 5.7 Dynamic style

Everything in this block is `S` (`DynamicStyleSection`, one implementation)
declared by `vector`, `vectortile`, `query`.

| Old behavior | Notes |
| --- | --- |
| Only rendered when `variables.dynamicStyle.enabled === true` | gate inside `sections()` |
| Read-only listing when `userSettable === false` | must stay read-only, not hidden |
| Whole-dataset vs current-view domain switch | |
| Styleable attribute + color attribute selectors | `Select` |
| Numeric ranges, categorical rules, statistics-backed rules | |
| Per-rule enable/disable; statistic selection; attribute selection; range editing | |
| Color ramp + bins/stops editing | reuse `components/DynamicStyleRamp.jsx` (move it to the shared section, keep the component) and/or `ColorRampPicker` |
| `overrideDynamicStyle` / `overrideDynamicStyleRuleOf` session-only overrides | via `api`, never mutating config |
| Server statistics refresh when a newly enabled rule needs fields | keep the request, keep the loading state |
| Statistics display, tooltips, explanatory notes (`Help` text) | keep the copy |
| `RESTYLED_EVENT` resync + remount of ramps | `useRestyled` → store update; no manual remounts |
| Dynamic style reset | |

### 5.8 Raster / COG / STAC / image / velocity / data / video

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Default ramps: image `binary`, tile `viridis`, velocity `rdylbu_r` | T | per-type default in that type's `settings.jsx` |
| `findJSColormap(...)` + reversed colormaps | S (`ColorRampSection`) | keep the JS-colormap fallback |
| TiTiler colormap preview images when `WITH_TITILER` | S | `api.withTitiler` |
| COG min/max rescale; configured vs current values; units | S (`RescaleSection`) | keep "current ≠ configured" display |
| Reset COG settings | S | |
| COG expression editing / reset / apply | S (`ExpressionSection`) | |
| STAC asset & band discovery, lazy loaded | S | keep laziness (network on demand) |
| Raster legend scale refresh after any of the above | A (`legendAdapter`) | `deriveLegend` + LegendTool |
| Cesium / LithoSphere sync on raster param change | A | `Globe_` path preserved |
| Image pixel-color update, no-data handling, image cache clear | T (`Image`) | including the reorder redraw (`redrawsOnReorder`) |
| Velocity range update, remove/re-add on change | T (`Velocity`) | |
| `populateCogScale(name)` called by `DataShaders` | C+F | keep a method with that name on the tool module; internally update the store |
| Data shader settings (`DataShaders.getHTML` + `attachEvents`) | S/F (`DataShaderSection`) | bridge legacy HTML in a container ref now; native React port is §9 |
| Video: play/pause, restart, mute, scrub slider, time/duration display, 100 ms sync, pause-state preservation while scrubbing | S (`VideoTransportSection`) declared by `Video` | the 100 ms interval **must** be cleared on unmount |

### 5.9 Export

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Formats GeoJSON / KML / SHP | A (`exportAdapter`) | logic lifted 1:1 |
| Scope: current extent / current extent with properties / entire raw file | A | dynamic-extent layers only get the extent options |
| Coordinates: source vs converted primary (`convertGeoJSONLngLatsToPrimaryCoordinates`) | A | |
| Geodataset retrieval via `calls.api('geodatasets_get', …)` | A | |
| KML URL → GeoJSON (`fetchKmlAsGeoJSON`), other URLs via `$.getJSON` | A | |
| `Features` → `features` normalization | A | |
| `tokml`, `shpwrite` + `proj42wkt` CRS lookup | A | |
| Filename handling, style + timestamp conversion | A | |
| Requires layer on; failure toasts | C | |
| UI | C (`ExportDialog`) | `Modal`/`Select`/`RadioGroup`/`ProgressButton` |

### 5.10 Attachments / composite layers

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Attachment headings from `L_.layers.attachments` | C+A | |
| Attachment visibility toggles (`L_.toggleSublayer`, `setAttachmentVisibility`) | A | |
| Attachment opacity (`L_.setSublayerOpacity`) | A | |
| Attachment dropdowns + per-attachment `dropdownFunc` | C+F | keep the imperative callback contract |
| `LayerAttachmentRegistry.describe` / `idForSublayerKey` | A | |
| Dynamic-style / statistics headings must stay independent of composite-layer headings | C | they were two heading families in one list; keep them distinguishable |

### 5.11 Time

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Time-enabled indicator on rows | C | `capabilities.time.enabled` |
| `time.dataStartTime` / `dataEndTime` display, refresh interval display | C | |
| "Set global time from data extent" → `TimeUI.updateTimes(start, end, end)` with success/error toasts | A (`timeAdapter`) | ISO→timestamp conversion as-is |
| Opening the time panel | C | |

### 5.12 Search, type filters, filtering

| Old behavior | Owner | Notes |
| --- | --- | --- |
| Name + description search | C | |
| Tag search with `#tag` syntax + autocomplete from `L_.layers.data` tags | C | keep `category:tag` parsing |
| Match highlighting (`markjs`) | C | replace with a React highlight helper (no jQuery `mark`) |
| Clear search; auto-expand groups while searching | C | |
| List stays primary UI (no palette) | C | explicit non-goal |
| Type filter chips built from `getAvailableLayerTypes()` (`L_.layers.dataFlat`) | C | availability computed, never a hardcoded list |
| Visible-only filter | C | |
| Active-filter-only filter, `layerHasActiveFilter(name)` (`_filterEncoded.filters`/`spatialFilter`, `Filtering.filters[name].values/spatial`) | C+A | port the predicate verbatim; generalize `type !== 'vector'` to `Filtering.isFilterable(name)` |
| `forceOff` / `forceOff2` / `forceOff3` presentation states | C | three independent "hidden by a filter" reasons — keep them independent, not one boolean |
| Filter UI mount per layer (`Filtering.make(container, layerName)`), teardown/reinit | C (`FilterMount`) | filter icon reflects active state |
| Geodataset / local vector / spatial filters | A | via `Filtering`, unchanged |

### 5.13 Ordering

| Old behavior | Owner | Notes |
| --- | --- | --- |
| `Sortable.create(list, { handle: '.layersToolColor', onStart, onChange, onEnd })` | A (`useLayerOrdering`) | same handle semantics |
| Moving a header moves its whole subtree | A | |
| Depth changes on drop; prevent dropping a header into its own descendants | A | |
| Hidden/collapsed rows handled correctly during drag | A | |
| `orderingHistory` as `[oldIndex, newIndex, headerState]`, URL (de)serialization, replay at init | C+A | byte-identical URL format |
| `L_.reorderLayers(newLayersOrdered)`, `Map_.orderedBringToFront` | A | |
| Restore-original-order button | C | |

### 5.14 Events, cleanup, misc

| Old behavior | Owner | Notes |
| --- | --- | --- |
| `document.addEventListener('layerRefreshStatusChanged', …)` | A | removed on unmount |
| `document.addEventListener(RESTYLED_EVENT, …)` | A | removed on unmount |
| `L_.subscribeOnLayerToggle('LayersTool', …)` | A | key `'LayersNew'`; unsubscribe in `destroy` |
| Video 100 ms interval, statistics polling, tippy instances | C | every timer and tippy destroyed on unmount |
| `Help` help-key registration (`helpKey = 'LayersTool'`) | C | new key `'LayersNew'`, same copy |
| Tooltips on every icon button (`tippy` → `Tooltip`) | C | no unlabeled icon buttons |
| Keyboard access: rows, checkboxes, tabs, back button focus management | C | focus moves to the settings header on open, back to the row on return |
| Loading/disabled states everywhere the old tool had them | C | |

---

## 6. Phases

Each phase ends with `npm run lint`-clean code (use the repo's configured lint/
format commands), its own unit tests, and a commit.

1. **Audit & formalize.** Re-read `LayersTool.js` against §5; write
   `plugins/core/tools/LayersNew/PARITY.md` with a row per §5 entry and a status
   column. This file is the PR's checklist and stays updated.
2. **Surface + registry.** `SURFACES.settings` in `API/pluginValidation.js`,
   `getSettings`/`hasSettings` on `LayerTypeRegistry`, an empty
   `settings.jsx` on one type, `npm run plugins -- activate`, unit tests for
   dispatch + `extends` + single-`module` shape. No UI yet.
3. **Tool skeleton.** Scaffold `LayersNew`, manifest, mission-config entries,
   `createRoot`/unmount, store, `initialize/make/destroy/finalize/getUrlString`,
   empty panel that opens from the toolbar next to the old Layers tool.
4. **Adapters + hooks.** `layersAdapter`, `useLayerTree`, `useLayerVisibility`,
   subscriptions/cleanup. Unit-testable without a browser.
5. **List view.** Rows, groups, indentation, badges, type colors, row actions,
   loading/not-found states, search + type filters, expand/collapse.
   → **Open the PR here.**
6. **Settings shell.** Full-height view with back navigation, `Tabs`,
   `SectionHost` with error boundary, universal sections (opacity, filter mount,
   attachments, reset), core fallback for types with no module.
7. **Drawer presentation.** Same tree in `SettingsDrawer`, chosen by
   viewport/mobile; overlay, focus trap, escape/back.
8. **Shared sections.** `src/essence/Basics/Layers_/settings/sections.js`:
   dynamic style (incl. moving `DynamicStyleRamp` in), color ramp, rescale,
   expression, raster adjust, video transport, data-shader bridge.
9. **Per-type modules.** `settings.jsx` for `Vector`, `VectorTile`, `Query`,
   `Tile`, `Image`, `Data`, `Velocity`, `Video`, `Model` — composition only,
   plus each type's genuinely local bits and its default ramp.
10. **Parity actions.** Export dialog + adapter, locate, time, info, reload,
    attachments, `populateCogScale` compatibility, ordering/dnd + URL history.
11. **Thumbnails + search polish.** `thumbnail()` per raster type with fallback;
    tag autocomplete; React highlighting.
12. **Verification & docs.** Full unit + plugin test suites; manual pass through
    §7; update `PARITY.md`, `/mockup/README.md` (link the prompt) and the PR
    body; list every deferral.

---

## 7. Acceptance criteria

1. `LayersNew` and `LayersTool` both appear in the toolbar of the reference
   mission and work independently; nothing under `plugins/core/tools/Layers/`
   changed except (optionally, additively) shared call sites named in §2.
2. `LayersNew` contains **no** `layerObj.type` string comparisons for settings
   dispatch; deleting a type's `settings.jsx` degrades that type to the core
   fallback with no error.
3. Settings open full-height with tabs and a back arrow that returns to the list
   with the previous scroll position and focus restored; on a narrow viewport the
   same settings render as a slide-over drawer.
4. Raster rows show thumbnails where derivable and fall back cleanly otherwise.
5. Search matches names, descriptions and `#tags` with autocomplete and
   highlighting, auto-expands groups, and is never the primary/only entry point.
6. Every §5 row is implemented or listed as deferred in `PARITY.md` + PR body
   with a reason and acceptance criteria for the follow-up.
7. Ordering URLs produced by `LayersNew.getUrlString()` are format-identical to
   the old tool's and restore on load.
8. On `destroy()`: React root unmounted, all `document` listeners removed,
   `L_.unsubscribeOnLayerToggle('LayersNew')` called, all intervals cleared, all
   tippy instances destroyed. Verified by a test, not by inspection.
9. No design-system component is forked or restyled from `LayersNew.css`; new
   generic components live in `src/design-system/`, MMGIS-specific ones in
   `src/essence/Basics/UserInterface_/`.
10. `npm run test:unit`, `npm run test:plugins:unit` and the existing
    `plugins/core/tools/Layers/tests/layers.spec.js` all pass, **unmodified**.

---

## 8. Tests

Co-locate in `plugins/core/tools/LayersNew/tests/` (tag pure tests `@unit` so
`test:plugins:unit` picks them up), plus unit tests for the registry change under
`tests/unit/`.

- Registry: `settings` resolution, `extends` inheritance, single-`module` shape,
  missing-module fallback, manifest validation accepts `SETTINGS_OPS` and
  rejects a typo'd op.
- `useLayerTree`: nesting, depth, counts, search (name/description/tag),
  type filters, visible-only, active-filter-only, the three `forceOff` reasons.
- `useLayerVisibility`: loading guard, global loading calls, event dispatch,
  external-toggle sync, group off→on child restoration.
- `useLayerOrdering`: header subtree moves, invalid drop into own descendant,
  hidden rows, ordering-history serialization round-trip.
- `exportAdapter`: format × scope × coordinate-system matrix, `Features`
  normalization, layer-off rejection.
- `timeAdapter`, `legendAdapter`, `attachmentsAdapter`: command mapping.
- Settings rendering: sections → tabs, badges, error boundary isolates a
  throwing section, core fallback renders universal sections only.
- Lifecycle: `make`/`destroy` leaves no listeners, intervals or roots.
- E2E: open tool → toggle → group collapse → search → open settings → change
  opacity → back → drawer at mobile viewport → export a vector layer.
- **Do not modify existing tests.** If one fails, the implementation is wrong or
  the failure is pre-existing on `development` — prove which.

---

## 9. Explicitly deferred

Deferrals must be re-stated in the PR body; nothing else may be dropped.

| Deferred | Reason | Acceptance criteria for the follow-up |
| --- | --- | --- |
| Replacing/removing the old `LayersTool` | needs a cutover decision + mission-config migration | old tool deleted, `LayersNew` renamed `Layers`, mission configs migrated, `tree.js`/`mmgisAPI`/`DataShaders` name checks updated |
| Rewriting `Filtering` in React | ~900 lines of jQuery with its own sortable + spatial map layer; out of scope | `Filtering` re-implemented as components, `FilterMount` deleted |
| Native React `DataShaders` settings | shader HTML is generated in a shared service used elsewhere | `DataShaderSection` renders components; `getHTML`/`attachEvents` no longer used by the tool |
| Configure-page mirror sections ("Layer Configuration") | product question from the mockup phase: a `Config` tab vs dropping them from the tool | decision recorded, then either a `config`-driven tab or explicit removal |
| List virtualization | only matters at very large layer counts; adds complexity to dnd | 1,000-layer mission scrolls at 60 fps with dnd intact |
| Thumbnails for non-raster types | needs a rendering/caching strategy per type | `thumbnail()` implemented for vector/query with a cache |
