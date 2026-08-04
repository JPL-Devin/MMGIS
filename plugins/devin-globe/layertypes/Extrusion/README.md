# Extrusion layer type

A globe-only layer type that draws GeoJSON as **data-driven 3D geometry**:

- `Polygon` / `MultiPolygon` → an extruded prism whose height comes from a numeric
  feature property (crater depth, methane column, population, count…).
- `Point` → a column of the same driven height.
- Both are colored by the same property through a color ramp, so height and hue
  agree.

MMGIS can already drape vectors on terrain, but nothing gives a polygon or a
point real vertical extent — a 3D choropleth/column plot is what's missing, and
it is the one visualization the globe can do that the 2D map fundamentally
can't.

## Config

`type: "extrusion"`, `url` to a GeoJSON FeatureCollection, and under
`variables.extrusion`:

| field | meaning |
|---|---|
| `property` | numeric feature property driving height + color |
| `heightScale` | meters per unit of the property |
| `maxHeight` | if > 0, the largest value is drawn exactly this tall (units-agnostic) and `heightScale` is ignored |
| `baseHeight` | height the geometry starts at |
| `columnRadius` | radius of the column drawn for points |
| `min` / `max` | fix the color/height domain instead of deriving it from the data |
| `ramp` | array of hex stops (default a blue→red 5-stop ramp) |
| `outline` | outline each prism/column |

## Engines

Declared for **Cesium only**. LithoSphere's layerers (`vector`, `clamped`,
`3dtiles`, …) have no primitive for per-feature extruded geometry, and the
`gctx` a LithoSphere module gets exposes `renderer.addLayer(type, config)`
rather than a scene graph, so there is no honest way for a third-party plugin to
add this geometry there without changing LithoSphere itself. Declaring the
engine without a working module would be worse: manifest validation
cross-checks engines against modules, and the type would silently draw nothing
when the globe is in LithoSphere mode.

## Notes / limits

- Data acquisition: the type has no 2D map renderer, so `make` fetches its own
  GeoJSON (the renderer vocabulary deliberately excludes fetching).
- `MultiPolygon` extrudes only the first ring of each feature's first polygon;
  holes are ignored.
- No `time`, `filter` or picking surfaces — features are entities with their
  properties attached, but click/hover interactions are not wired.
