---
layout: page
title: Heatmap
permalink: /configure/layers/heatmap
parent: Layers
grand_parent: Configure
---

# Heatmap Layer

A density heatmap of another vector layer's features, drawn on a canvas over the 2D map. A heatmap layer loads no data of its own: it acquires the GeoJSON of the layer named by `variables.sourceLayer` (through that layer's own type — file, geodataset, source plugin...) and rasterizes it.

- Points are weighted directly.
- LineStrings are densified geodesically every `lineSampleSpacingMeters` meters.
- Polygons contribute their densified boundary plus an interior grid of samples (`polygonInteriorSamples`, default 64), each weighted by the feature's weight.
- Multi\* geometries and GeometryCollections are supported.

Only samples in (or within radius + blur of) the current viewport are drawn. The canvas is redrawn after `moveend`/`zoomend` (debounced), whenever the source layer's time window changes, and immediately when a Layers-tool control changes. Toggling the source layer off does not hide the heatmap; it keeps its acquired features.

All projection happens through the mission's active CRS (`map.options.crs`), so custom and polar projections (`L.Proj.CRS`) work. Radius in meters is converted using the on-screen ground resolution at the view center.

**Limitation:** 2D map only — there is no Globe or Viewer rendering.

#### Layer Name

_type:_ string  
The unique display name and identifier of the layer.

#### Source Layer

_type:_ string _(`variables.sourceLayer`)_  
The name of a vector layer in this mission whose features are rendered. Required. The heatmap has no URL.

#### Radius

_type:_ number _(`variables.radius`)_ _default:_ 25  
Radius of each sample's influence, in `radiusUnits`.

#### Radius Units

_type:_ enum `px` | `m` _(`variables.radiusUnits`)_ _default:_ `px`  
Pixels (constant across zooms) or ground meters (converted using the active CRS resolution at the current zoom).

#### Blur

_type:_ number _(`variables.blur`)_ _default:_ 15  
Extra softening, in pixels, beyond the radius.

#### Max Intensity

_type:_ number _(`variables.maxIntensity`)_ _optional_  
The accumulated weight at which the gradient saturates. Defaults to the largest single sample weight, so one isolated feature of maximum weight is fully saturated.

#### Weight Property

_type:_ string _(`variables.weightProperty`)_ _optional_  
A numeric feature property used as each feature's weight. When absent, every feature weighs 1. The Layers tool lets users switch this live between the numeric properties found in the loaded source features.

#### Weight Min / Weight Max

_type:_ number _(`variables.weightMin`, `variables.weightMax`)_ _optional_  
Clamp weights to this range; when both are set, weights are normalized to 0..1 within it.

#### Gradient

_type:_ object _(`variables.gradient`)_ _default:_ `{"0.4":"blue","0.65":"lime","1":"red"}`  
Color stops keyed by intensity fraction (0..1).

#### Line Sample Spacing (m)

_type:_ number _(`variables.lineSampleSpacingMeters`)_ _default:_ 10  
Geodesic spacing between samples along lines and polygon boundaries.

#### Example

```json
{
  "name": "Rock Density",
  "type": "heatmap",
  "visibility": true,
  "initialOpacity": 0.8,
  "variables": {
    "sourceLayer": "Rocks",
    "weightProperty": "size",
    "radius": 25,
    "blur": 15,
    "maxIntensity": 10,
    "gradient": { "0.4": "blue", "0.65": "lime", "1": "red" },
    "lineSampleSpacingMeters": 5,
    "radiusUnits": "px"
  }
}
```

The `Heatmap` and `HeatmapPolar` Reference Missions (Configure → New Mission) demonstrate the type on Earth (EPSG:3857) and on a Mars north polar stereographic projection.
