# CurtainWall layer type

A **radargram hung in 3D**: a vertical image standing along a ground track, its x
axis distance along the track and its y axis depth. That is how subsurface
sounder data (SHARAD, MARSIS, RIMFAX) and seismic sections actually want to be
seen — MMGIS's existing `Curtain` *tool* shows GPR curtains in a 2D panel next to
the map; this puts the same section in the scene, below the surface, where the
instrument flew.

- Type: `curtainwall` (the plugin is named `CurtainWall` because `core/tools/Curtain`
  already exists and the CLI matches plugins by bare name).
- Globe-only, Cesium. One `wall` entity per layer: `positions` from the track,
  `minimumHeights`/`maximumHeights` from the rails, `ImageMaterialProperty` for
  the section image.
- `top`/`bottom` are relative to the surface *under each vertex*, so a curtain
  follows terrain instead of floating at a constant elevation. Per-vertex heights
  come from a `heights` array or from 3D coordinates.

## Surfaces used

| surface | why |
|---|---|
| `globe.cesium` | the render |
| `source` | accepts the sounder sidecar form `{ track, heights, image }` as well as plain GeoJSON |
| `legend` | a radargram image has no key, so the legend is the depth range it was hung with (`legend.derive` → `layerObj._legend`) |

## Honest limits

- **Not run in a browser.** Unit-tested geometry + manifest only; the Cesium path
  is unexercised. The `setOpacity`/`setVisibility` signatures are `(layerObj, gctx)`
  per the README's "every operation is `(layerObj, ctx)`", with the new state read
  off `gctx.visible` / `gctx.opacity` — `gctx.opacity` is **not** in the documented
  gctx table, so that read is a guess.
- **How the fetched GeoJSON reaches a globe-only `make` is undocumented.** The map
  ctx has `ctx.data`; the globe gctx table has no equivalent. `source.fetch`
  therefore also stashes the result on `layerObj._curtainGeoJSON` and `make` reads
  that.
- **LithoSphere is not supported.** `gctx.raw` there is the LithoSphere namespace,
  which has no geometry API and no exported THREE, so there is no way to add a
  wall to its scene from a plugin. Cesium's `raw` (the whole Cesium namespace) is
  a genuine escape hatch; LithoSphere's is a formality.
- One image is stretched across the whole track (`repeat` opts into per-segment
  repetition instead). No time support, no picking.
