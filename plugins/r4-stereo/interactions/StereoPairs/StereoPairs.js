/**
 * StereoPairs — click a footprint, highlight the other footprints overlapping it
 * whose viewing geometry makes a usable stereo pair.
 *
 * It prefers the index the LookDirection attachment already built (stashed on the
 * attachment object as `_stereoIndex`) and falls back to recomputing from the
 * host layer's GeoJSON when the attachment isn't configured.
 */
import {
    indexFeatures,
    pairsFor,
    geometryOf,
    bboxOf,
    centroidOf,
} from '../../layerattachments/LookDirection/stereoGeometry.js'

// Read the globals per call so this module still imports in a Node unit test —
// `import L_ from '@basics/Layers_/Layers_'` (what the docs suggest) makes the
// module un-importable outside webpack, and the scaffolded spec imports it.
const leaflet = () => window.L
const layers = () => window.L_

let highlight = null

function clearHighlight() {
    if (highlight?.remove) highlight.remove()
    highlight = null
}

/** Every feature the host layer is holding, as a FeatureCollection. */
function hostGeojson(layerName) {
    const held = layers()?.layers?.layer?.[layerName]
    const features = []
    const collect = (l) => {
        if (!l) return
        if (Array.isArray(l)) return l.forEach(collect)
        if (typeof l.eachLayer === 'function') return l.eachLayer(collect)
        if (l.feature) features.push(l.feature)
    }
    collect(held)
    return { type: 'FeatureCollection', features }
}

/** The attachment's index if it built one, else one computed here. */
export function indexFor(layerName, fields) {
    const attachment =
        layers()?.layers?.attachments?.[layerName]?.look_direction
    if (attachment?._stereoIndex?.length)
        return { index: attachment._stereoIndex, source: 'attachment' }
    return {
        index: indexFeatures(hostGeojson(layerName), fields),
        source: 'recomputed',
    }
}

function recordFor(feature, index, fields) {
    const match = index.find((r) => r.feature === feature)
    if (match) return match
    // The clicked feature may not be the same object the index holds (a
    // recomputed index, or a feature re-created by a filter), so fall back to
    // building its record directly.
    const view = geometryOf(feature, fields)
    const centroid = centroidOf(feature)
    if (!view || !centroid) return null
    return { feature, view, centroid, bbox: bboxOf(feature), id: feature.id }
}

const StereoPairs = {
    use(ctx) {
        clearHighlight()
        if (!ctx?.feature) return

        const cfg = ctx.config || {}
        const fields = {
            emission: cfg.emissionProp || ctx.layerVar?.stereo?.emissionProp,
            incidence: cfg.incidenceProp || ctx.layerVar?.stereo?.incidenceProp,
            azimuth: cfg.azimuthProp || ctx.layerVar?.stereo?.azimuthProp,
        }
        const criteria = {
            minConvergence: parseFloat(cfg.minConvergence) || undefined,
            maxConvergence: parseFloat(cfg.maxConvergence) || undefined,
            maxEmissionDifference:
                parseFloat(cfg.maxEmissionDifference) || undefined,
            maxIlluminationDifference:
                parseFloat(cfg.maxIlluminationDifference) || undefined,
        }

        const { index, source } = indexFor(ctx.layerName, fields)
        const origin = recordFor(ctx.feature, index, fields)
        const pairs = pairsFor(origin, index, criteria)

        // Anything a later interaction should know.
        ctx.state.stereoPairs = {
            layerName: ctx.layerName,
            indexSource: source,
            origin: origin?.id,
            pairs: pairs.map((p) => ({
                id: p.record.id,
                convergence: p.metrics.convergence,
                emissionDifference: p.metrics.emissionDifference,
                illuminationDifference: p.metrics.illuminationDifference,
            })),
        }

        const L = leaflet()
        const map = ctx.Map_?.map
        if (!L || !map || !pairs.length) return

        highlight = L.geoJson(
            {
                type: 'FeatureCollection',
                features: pairs.map((p) => ({
                    type: 'Feature',
                    properties: {
                        ...p.record.feature.properties,
                        _stereoConvergence: p.metrics.convergence,
                    },
                    geometry: p.record.feature.geometry,
                })),
            },
            {
                style: {
                    color: cfg.color || '#00e5ff',
                    weight: 3,
                    fillOpacity: 0.1,
                    fillColor: cfg.color || '#00e5ff',
                },
                interactive: false,
            }
        )
            .bindTooltip(
                `${pairs.length} stereo partner${pairs.length === 1 ? '' : 's'}`
            )
            .addTo(map)
    },
}

export default StereoPairs
