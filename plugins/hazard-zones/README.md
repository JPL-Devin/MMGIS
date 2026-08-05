# Hazard Zones — an MMGIS plugin container

One user-facing capability spread over three plugin families. It is meant to be
its own repository and installed into an MMGIS instance:

```bash
npm run plugins -- install /path/to/hazard-zones     # or --link while developing
npm run plugins -- list --container hazard-zones
```

| plugin | family | what it is |
|---|---|---|
| `layertypes/HazardZone` | layertype (`typeId: hazardzone`) | a vector-derived type whose features are zones; severity drives the style and a derived legend, and every zone layer clicks through to `hazard:report` |
| `layerattachments/HazardBuffer` | layerattachment (`hazard_buffer`) | the exclusion band drawn around every zone, and the buffered geometry the report tests against |
| `interactions/HazardReport` | interaction (`hazard:report`) | click any feature: reports which zones — and which exclusion buffers — it falls in |
| `lib/` | — | the geometry and report logic all three share (dependency-free, unit tested) |

## How the three find each other

- **layertype → attachment**: `HazardBuffer` declares
  `applicableLayerTypes: ["hazardzone"]`, so the buffer is offered on (and only
  on) a hazard zone layer, including any type that `extends` it.
- **layertype → interaction**: `HazardZone` declares
  `capabilities.defaultInteractions.click: ["hazard:report"]`, so a new zone
  layer reports without a mission author configuring anything.
- **interaction → attachment**: `hazard:report` reads the buffered features off
  the built attachment at `L_.layers.attachments[hostName].hazard_buffer`
  (`_bufferedFeatures`), rather than re-deriving the buffer or reading the
  attachment's `configPath` out of the host layer's config.
- All three declare each other in `pluginDependencies`.

## Configuring a mission

1. Create a layer of type `hazardzone` pointing at GeoJSON polygons with a
   `severity` property (`low` | `medium` | `high` | `extreme`).
2. In that layer's **Attachment - Paths** tab, switch on *Hazard Exclusion
   Buffer* and set a buffer in metres.
3. On any other vector layer whose features you want checked, add
   `hazard:report` to the click pipeline (layer modal → Interactions →
   Customize pipeline). A `hazardzone` layer already has it by default.

## Tests

```bash
npm run test:plugins:unit     # or: npx playwright test plugins/hazard-zones --grep @unit
```

The pure geometry and report logic are covered. The renderers, the attachment's
Leaflet layer and the popup are not — they need the app.

## Caveats

- The buffer is a vertex-scaling approximation, not a true Minkowski buffer:
  convex-correct, cheap, and wrong on strongly concave zones.
- `hazard:report` matches a zone to its buffered twin by index, which holds
  because the attachment derives the buffers in the host's feature order.
