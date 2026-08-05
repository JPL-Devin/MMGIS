# fov-planner

Observation planning for MMGIS: **where an instrument is pointed, what it will
see on the ground, and what it duplicates.**

A planning or field-ops team keeps a list of pointed acquisitions — a mast
camera at azimuth 137° with a 30° FOV out to 800 m, a drone survey, a ground
spectrometer. MMGIS can draw the *positions* today (a vector layer of points),
but nothing draws the *footprints*, and nothing tells you two observations cover
the same ground. This container does both.

Four plugins, one feature, one install:

| plugin | family | what it does |
|---|---|---|
| `layertypes/ObservationPlan` | layertype (`extends vector`) | `observationplan` — fetches a plan service bbox- and time-limited, colours features by status, and turns on the two plugins below by default |
| `layerattachments/FovFootprint` | layerattachment | draws each observation's FOV wedge on the ground |
| `interactions/FovInspect` | interaction (`main`, click) | on click, reports the observation's pointing and which other observations overlap it |
| `components/FovCoverageBar` | component | a page-level readout of that report |
| `lib/fov.js` | plain module | the spherical geometry all of the above share — the unit-tested part |

## Install

```bash
npm run plugins -- install --link /path/to/fov-planner --container fov-planner
npm run plugins -- validate
npm run plugins -- activate     # install does this for you
```

Uninstall is `npm run plugins -- uninstall fov-planner`, which takes all four
with it.

## Use it

1. Configure → the mission → add a layer, type **observationplan**, and give it
   a GeoJSON endpoint of Point features.
2. Configure → the mission → Components → turn **FovCoverageBar** on.
3. Reload the map, turn the layer on, click an observation.

Step 1 is all the layer needs. The type's manifest declares

```json
"capabilities": {
    "defaultAttachments": { "fov_footprint": { "azimuthProp": "azimuth", … } },
    "defaultInteractions": { "click": { "fov:inspect": { "azimuthProp": "azimuth", … } } }
}
```

so footprints are drawn and clicks are reported without an admin configuring
two more plugins by hand. Everything is overridable per layer: the attachment's
fields are in the layer modal's **Attachment - Markers** tab and the
interaction's on its card in the **Interactions** tab; an empty field means "as
the type declared".

## Feature properties

Defaults, all renameable in either form:

| property | meaning |
|---|---|
| `azimuth` | boresight, degrees clockwise from north. **Required** — a feature without it gets no footprint and no report |
| `fov` | field of view in degrees; `360` draws a full disc. Falls back to `defaultFovDeg` (30) |
| `range` | ground range in metres. Falls back to `defaultRangeMeters` (500) |
| `obs_id` | how the observation is named in the coverage bar |
| `status` | `planned` / `acquired` / `failed`, which colours the marker |

Set **Body Radius (m)** on the attachment for anything that isn't Earth: Mars is
`3396190`, the Moon `1737400`. Nothing reads the mission's own radius for you.

## Known limits

- **Map only.** No globe module, so footprints are 2D. `"globe": false` is
  declared, not forgotten.
- **Overlap is a bounding-box test**, not a polygon intersection — a planning
  hint, not a measurement. Each hit says so (`overlapKind: 'bounds'`).
- **Overlaps only cover what is drawn.** The interaction collects the layer's
  other features by walking the host's Leaflet group, and a layer of this type
  is dynamic-extent by default, so observations outside the viewport are not
  counted.
- **No backend.** The plan service is whatever URL the layer is given; there is
  no MMGIS-side store of plans and no write path.

## Test

```bash
npm run test:plugins:unit     # 20 tests, most of them lib/fov.js
```
