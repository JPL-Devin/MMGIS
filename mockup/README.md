# LayersTool redesign — mockups

Visual exploration only. **Nothing here is implemented** — this directory contains rendered
images and this document. No file outside `/mockup` is touched by this branch.

What is being explored:

1. The LayersTool as a React component tree instead of jQuery + string-built HTML.
2. **Layer types own their settings UI.** The tool reads whatever a type registers and renders
   it; it never branches on the type id.
3. **Settings fill the whole tool panel** with a back `←` at the top right, instead of expanding
   inline underneath the layer row.

Everything is drawn in MMGIS's existing dark theme tokens (`src/design-system/themes.js`,
`--color-a*`, `--color-<type>`) and composed from components that already exist in
`src/design-system/components/` — the few genuinely new shared pieces are called out per image
and summarised at the bottom.

---

## Today, for reference

Captured from a running Reference Mission on `development`, so the comparison is against the
real thing rather than from memory.

| Layer list | Vector settings | Raster settings |
| --- | --- | --- |
| ![Current layer list](./00-current-layer-list.png) | ![Current vector settings](./00-current-vector-settings.png) | ![Current raster settings](./00-current-raster-settings.png) |

The two things the redesign reacts to are visible here: a layer's settings open *inside* the
tree and push everything below them down, and every control lives in a ~300px column — which is
why the dynamic-style editor, the filter builder and the COG rescale + colormap have all ended
up as very tall, very narrow stacks. `plugins/core/tools/Layers/LayersTool.js` is ~3,875 lines
and carries all of that type-specific markup itself.

---

## 01 · Layer list (root view)

![Layer list](./01-layer-list.png)

The list keeps what works today — type colour rails, group counts, drag handles, the search
row — and changes what a row *says*:

- Row actions collapse to a single gear until hover, so a dense tree stays readable. Which
  actions a row has comes from the type's capabilities, not from a hardcoded set.
- Badges surface state that is currently invisible or buried: active filter count, feature
  count, time-in-range, refresh failure.
- The legend swatch is the type's own `legend.derive()` output, including the dynamic-style
  ramp, so the list itself shows how a layer is drawn.
- The icon strip becomes filter chips generated from the registered layer types — a new type,
  including one from an external plugin, appears there for free with its manifest `color`.

## 02 · Layer settings — vector

![Vector settings](./02-settings-vector.png)

Opening settings replaces the whole panel. Back at the top right (and `Esc`) returns to the
list with scroll position, expanded groups and search text intact.

- The header carries identity: group breadcrumb, layer name, a type pill coloured from the
  manifest, and the existing reset action.
- Tabs are **declared by the type**, not hardcoded. The vector module asks for
  Style / Filter / Time / Data / Attachments; a type that declares one section gets no tab bar.
- Each section is labelled with its owner — dashed = LayersTool core, blue = layer type. Core
  keeps only what every layer has: visibility, opacity, reload, locate, export, time.
- Dynamic style rules become rule cards (reorder, toggle, delete) with room for property,
  statistic, domain and ramp. That is the ~700 lines of string-built HTML in `LayersTool.js`
  today, rebuilt from `Select`, `Slider`, `Checkbox` and `ColorRampPicker`.

## 03 · Layer settings — tile / raster

![Tile settings](./03-settings-tile.png)

Same shell, entirely different body, and the tool knows nothing about either. The band
expression gets real room (input, apply, reset, operator hint, STAC asset list); colormap,
min/max and the legend read as one control instead of nine stacked rows; brightness / contrast /
saturation keep their current CSS-filter behaviour with the value beside the track.

## 04 · The same shell, three more layer types

![Other layer types](./04-settings-other-types.png)

`data` owns its shader-ramp editor, `image` its two-handle visibility range, `video` its
transport and scrub bar including the clock-sync switch only it has. Adding a layer type adds a
settings UI; it does not add a branch to the LayersTool.

## 05 · How a layer type owns its settings UI

![Architecture](./05-architecture.png)

The mechanism already exists. Layer types are discovered from
`plugins/core/layertypes/*/plugin.json`, emitted into `src/pre/layertypes.js` by
`API/updateTools.js → updateLayerTypes()`, and resolved through `LayerTypeRegistry`, which
already dispatches `map`, `globe.<engine>`, `config`, `filter`, `time`, `source` and `legend`
with no hardcoded type ids. The proposal adds one more surface to that list — `settings`, a
React module:

```jsonc
// plugins/core/layertypes/Vector/plugin.json
"modules": {
  "map": "./map",
  "config": "./config",
  "settings": "./settings"   // new surface
}
```

```jsx
// plugins/core/layertypes/Vector/settings.jsx
export default {
    // The sections this type contributes, in order.
    sections(layer, { capabilities }) {
        return [
            { id: 'style', label: 'Style', Component: BaseStyle },
            { id: 'dynamic', label: 'Style', Component: DynamicStyle },
            { id: 'filter', label: 'Filter', Component: Filtering,
              count: activeFilterCount(layer) },
        ]
    },
    // Optional: badges this type wants on its list rows.
    rowBadges(layer) { … },
}
```

Each `Component` is plain React, handed a narrow `api` (`get` / `set` settings state for this
layer, `restyle()`, `refresh()`, `reset()`, `toast()`) so no type module reaches into `L_` or
`Map_` directly.

Wiring cost in core is one entry, so `settings` is a validated surface like the others:

```js
// API/pluginValidation.js
const SETTINGS_OPS = ['sections', 'rowBadges']
SURFACES.settings = { ops: SETTINGS_OPS, requiresMake: false }
```

Nothing else: `flattenLayerModules()` and the `src/pre` generator already emit any declared
module key, and `extends:` inheritance and single-`module` layer types keep working unchanged.

Core still decides everything that must be asked of *every* layer, from the manifest
capabilities that already exist: `map.styling` gates the opacity control, `time: true` gates the
time section and the row's time badge, `map.refreshByRemake` decides whether `api.restyle()` can
avoid a refetch, `structural: true` means no settings view at all, and `color` / `defaultIcon`
drive the rail, the type pill and the filter chip.

---

## Design-system usage

Already in `src/design-system/components/`, used as-is: `Tabs`, `Collapsible`, `Slider`,
`RangeSlider`, `Select`, `Dropdown`, `Toggle`, `Checkbox`, `RadioGroup`, `ColorRampPicker`,
`InputWithUnit`, `Button`, `IconButton`, `IconTextButton`, `Tooltip`, `Modal`.

Proposed additions, each because the mockups need it more than once and none of the above covers
it:

| New component | Why | Built from |
| --- | --- | --- |
| `SettingsSection` | Every settings body is a titled section with an owner label; types shouldn't each re-style a header. | `Collapsible` |
| `RuleCard` | Reorderable, toggleable, deletable card with a header and a body — dynamic style rules, filter groups, shader ramps. | `Checkbox`, `IconButton` |
| `RampLegend` | Horizontal and vertical colour ramp with tick labels, shared by dynamic style, COG colormap and data shaders. | `ColorRampPicker` ramp data |
| `FilterChip` | Toggleable chip with a type dot, for the type filter row. | `Button` |
| `TreeRow` | The list row itself: rail, indent, checkbox, swatch, name, badges, hover actions. | `Checkbox`, `IconButton`, `Tooltip` |

## Open questions

- **Where do "Layer Configuration (Configure Page)" sections go?** Today the tool exposes
  read-only mirrors of the Configure-page config. Keeping them means a second, admin-flavoured
  settings surface inside the same panel — a `Config` tab rendered from `layerTypeConfigs`, or
  dropped from the tool entirely.
- **Migration order.** The shell (list + navigation + core sections) can land before any type
  ships a `settings` module, as long as core falls back to today's markup for types that don't;
  or the vector type goes first as the proof and the rest follow.
- **Panel width.** The full-panel settings view assumes the tool's current expandable width. A
  rule editor is comfortable at ~420px but the STAC/band-expression body would prefer more.
- **Attachments.** `LayerAttachmentRegistry` has the same shape as the type registry, so
  attachments could contribute sections to the same view — the vector mockup shows an
  `Attachments 3` tab as a placeholder for that, not a designed screen.
