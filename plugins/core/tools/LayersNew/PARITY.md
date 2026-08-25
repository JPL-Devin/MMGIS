# LayersNew parity checklist

This checklist mirrors the feature matrix in `LayersNew-spec.md` §5. Phases
1–4 establish the registry surface, tool lifecycle, adapters, store, and
reactive hook boundaries. The list and settings implementations are subsequent
handoffs.

## Lifecycle, sizing, and panel

| Old behavior | Owner | Status |
| --- | --- | --- |
| `initialize()` reads tool variables and width | C | Phase 3 scaffolded |
| Mobile full width and 70% map height | C | Phase 3 implemented |
| `make(t, fromInit)` builds the interface | C | Phase 3 one-root mount |
| Replay ordering and initialize Filtering in `finalize()` | C+A | Phase 3 implemented |
| Byte-identical ordering URL serialization | C+A | Phase 3 implemented |
| Destroy dynamic roots and separate from MMGIS | C | Phase 3 root teardown; dynamic roots deferred |
| Expandable panel and configured width | C | Phase 3 manifest/lifecycle |
| External layer add/update/remove refreshes the UI | C+A | Phase 4 reactive boundary |

## Layer tree and list

| Old behavior | Owner | Status |
| --- | --- | --- |
| Recursive layer/sublayer traversal | A (`useLayerTree`) | Phase 4 row model |
| Depth indentation and guide colors | C | Deferred to list phase |
| Header child counts | C | Deferred to list phase |
| Type color swatch and drag handle | C | Deferred to list phase |
| `layernotfound` unavailable state | C | Deferred to list phase |
| `L_.layers.on` visibility source of truth | A | Phase 4 adapter |
| Display-name overrides and safe names | C | Deferred to list phase |
| Equivalent row data attributes and IDs | C+F | Deferred to list phase |

## Groups and headers

| Old behavior | Owner | Status |
| --- | --- | --- |
| Nested header expand/collapse | C | Deferred to list phase |
| Configured expansion restore | C | Deferred to list phase |
| Expand all / collapse all | C | Deferred to list phase |
| Header power toggle | C | Deferred to list phase |
| Restore children after group re-enable | C | Deferred to list phase |
| `layersToolHeaderStateChange` event | C | Phase 4 hook boundary |
| Structural headers never receive settings | C | Phase 4 registry boundary |

## Visibility and row actions

| Old behavior | Owner | Status |
| --- | --- | --- |
| Toggle with loading guard | A | Phase 4 hook |
| Global loading around asynchronous toggles | A | Phase 4 adapter/hook |
| Per-row loading indicator | C | Deferred to list phase |
| External toggle subscription | A | Phase 4 implemented |
| `layerVisibilityChange` event synchronization | C | Phase 4 hook |
| Quasi-layer toggling | C | Deferred to list phase |
| Missing-layer warning and state | C | Deferred to list phase |
| Settings/info/time/reload/locate/export actions | C+A | Deferred to list/settings phases |
| Type-contributed extra actions | T | Deferred to type modules |

## Settings shell and dynamic style

| Old behavior | Owner | Status |
| --- | --- | --- |
| Full-height settings drawer and tabs | C | Deferred to drawer phase |
| Ensure-on policy and universal opacity | C+A | Registry/API boundary in Phase 4 |
| Raster adjustments and type settings | S/T | Deferred to type modules |
| Reset settings and section lifecycle | C | Deferred to drawer phase |
| Dynamic-style gate and read-only state | T/S | Deferred to type modules |
| Domain, attribute, range, category, statistics controls | S/T | Deferred to type modules |
| Color ramp and session overrides | S/T | Deferred to type modules |
| RESTYLED_EVENT resync | A | Phase 4 `useRestyled` |

## Raster, COG, STAC, image, velocity, data, and video

| Old behavior | Owner | Status |
| --- | --- | --- |
| Default ramps and reversed colormaps | T/S | Deferred to type modules |
| TiTiler previews and COG rescale/expression | S | Deferred to type modules |
| STAC asset/band discovery | S | Deferred to type modules |
| Legend refresh after raster changes | A | Phase 4 adapter |
| Cesium/LithoSphere raster synchronization | A | Phase 4 adapter boundary |
| Image pixel/no-data/cache behavior | T | Deferred to type modules |
| Velocity range replacement | T | Deferred to type modules |
| `populateCogScale(name)` bridge | C+F | Phase 3 store bridge |
| DataShaders bridge | S/F | Deferred to settings phase |
| Video transport and 100ms cleanup | S | Deferred to type modules |

## Export

| Old behavior | Owner | Status |
| --- | --- | --- |
| GeoJSON, KML, and SHP formats | A | Phase 4 adapter boundary |
| Extent/property/raw-file scopes | A | Deferred to export UI |
| Source/primary coordinate conversion | A | Phase 4 adapter |
| Geodataset retrieval and URL normalization | A | Phase 4 adapter boundary |
| Feature normalization, filename, style, timestamp, CRS | A | Deferred to export implementation |
| Layer-on requirement and failure toasts | C | Deferred to export UI |

## Attachments and composite layers

| Old behavior | Owner | Status |
| --- | --- | --- |
| Attachment headings from runtime state | C+A | Phase 4 adapter boundary |
| Visibility and opacity commands | A | Phase 4 adapter |
| Dropdown callbacks | C+F | Deferred to list phase |
| Registry attachment metadata | A | Phase 4 adapter |
| Independent dynamic-style/statistics headings | C | Deferred to list/settings phases |

## Time

| Old behavior | Owner | Status |
| --- | --- | --- |
| Time-enabled row indicator and extent display | C | Deferred to list phase |
| Set global time from extent | A | Phase 4 adapter |
| Time panel opening | C | Deferred to list phase |

## Search, type filters, and Filtering

| Old behavior | Owner | Status |
| --- | --- | --- |
| Name and description search | C | Phase 4 pure row helper |
| `#tag` search and autocomplete | C | Phase 4 tag matching; autocomplete deferred |
| React match highlighting and clear behavior | C | Deferred to list phase |
| Auto-expand while searching | C | Deferred to list phase |
| Type chips from available runtime types | C | Deferred to list phase |
| Visible-only and active-filter-only predicates | C+A | Deferred to list phase |
| Independent force-off presentation states | C | Deferred to list phase |
| Imperative Filtering mount/teardown bridge | C+A | `Filtering.initialize()` preserved; UI deferred |

## Ordering

| Old behavior | Owner | Status |
| --- | --- | --- |
| Sortable handle semantics | A | Deferred to list phase |
| Header subtree movement and depth changes | A | Deferred to list phase |
| Hidden/collapsed drop handling | A | Deferred to list phase |
| Ordering history, URL replay, and serialization | C+A | Phase 3/4 implemented |
| Runtime reorder and map bring-to-front | A | Phase 4 adapter |
| Restore original order | C | Deferred to list phase |

## Events, cleanup, and miscellaneous behavior

| Old behavior | Owner | Status |
| --- | --- | --- |
| Refresh status listener | A | Phase 4 `useRefreshStatus` |
| Dynamic-style restyle listener | A | Phase 4 `useRestyled` |
| LayersNew toggle subscription and teardown | A | Phase 4 implemented |
| Video/statistics timers and tooltip cleanup | C | Deferred to owning phases |
| Help registration and tooltip labels | C | Deferred to list phase |
| Keyboard and focus management | C | Deferred to drawer/list phases |
| Loading and disabled states | C | Deferred to list/settings phases |
