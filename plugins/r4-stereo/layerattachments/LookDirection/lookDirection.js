/**
 * LookDirection attachment — draws each footprint's look direction (a wedge, or
 * a bearing line) from its centre, derived from the host's emission/azimuth
 * properties.
 *
 * It also publishes the index it built on the returned attachment object
 * (`_stereoIndex`) so the StereoPairs interaction can reuse it instead of
 * re-walking every footprint's geometry.
 */
import {
    indexFeatures,
    bearingLine,
    wedge,
} from './stereoGeometry.js'

// Leaflet is a global the app sets up before any attachment is built. Read it
// per call rather than at import time, so this module can be imported (and unit
// tested) outside the browser.
const leaflet = () => window.L

const settings = (config = {}) => ({
    style: config.style === 'line' ? 'line' : 'wedge',
    lengthDeg: Number.isFinite(parseFloat(config.lengthDeg))
        ? parseFloat(config.lengthDeg)
        : 0.05,
    color: config.color || '#ffcc00',
    fields: {
        emission: config.emissionProp || undefined,
        incidence: config.incidenceProp || undefined,
        azimuth: config.azimuthProp || undefined,
    },
})

/** GeoJSON FeatureCollection of one look-direction shape per footprint. */
export function lookDirectionGeojson(geojson, config) {
    const s = settings(config)
    const index = indexFeatures(geojson, s.fields)
    return {
        collection: {
            type: 'FeatureCollection',
            features: index.map((r) => ({
                type: 'Feature',
                properties: {
                    ...r.feature.properties,
                    _lookAzimuth: r.view.azimuth,
                    _lookEmission: r.view.emission,
                },
                geometry:
                    s.style === 'line'
                        ? bearingLine(r.centroid, r.view, s.lengthDeg)
                        : wedge(r.centroid, r.view, s.lengthDeg),
            })),
        },
        index,
    }
}

function make(ctx) {
    const s = settings(ctx.config)
    const { collection, index } = lookDirectionGeojson(ctx.geojson, ctx.config)
    if (!collection.features.length) return false

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'look_direction',
        geojson: collection,
        layer: leaflet().geoJson(collection, {
            style: {
                color: s.color,
                weight: 1,
                fillColor: s.color,
                fillOpacity: s.style === 'line' ? 0 : 0.15,
            },
            interactive: false,
        }),
        // What the StereoPairs interaction reads: the viewing geometry per
        // footprint, already parsed. Extra keys survive verbatim on the stored
        // attachment, which is the only channel between the two plugins.
        _stereoIndex: index,
        _stereoFields: s.fields,
        // syncData is handed new data but not the config, so keep it.
        _config: ctx.config,
    }
}

/**
 * The core default re-adds the *host's* GeoJSON, which would draw footprints
 * instead of wedges, so this rebuilds the derived shapes and refreshes the index
 * the interaction reads.
 */
function syncData(attachment, ctx) {
    attachment.layer.clearLayers()
    if (ctx.onlyClear) return
    const { collection, index } = lookDirectionGeojson(
        ctx.geojson,
        ctx.config ?? attachment._config
    )
    attachment.geojson = collection
    attachment._stereoIndex = index
    attachment.layer.addData(collection)
}

export default { make, syncData }
