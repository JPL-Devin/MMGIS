/**
 * DepotCapacity attachment — a capacity ring around each depot.
 *
 * The ring's radius is fixed by the depot's capacity and its arc is filled to
 * the depot's `fillRatio` (computed by the SampleDepot type's `source.fetch`),
 * so a glance says both how big a depot is and how full it is.
 *
 * Dependency-free on purpose: reading `window.L` per call keeps the module
 * importable in a unit test (plugins/core/layerattachments/README.md:356).
 */

const leaflet = () => window.L

const num = (v, fallback) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback)

const RAMP = [
    [0.34, '#d7191c'],
    [0.67, '#fdae61'],
    [Infinity, '#1a9641'],
]

const colorFor = (ratio) => RAMP.find(([limit]) => ratio < limit)[1]

/** One circle per point feature, sized by capacity and coloured by fill. */
function ringsOf(geojson, config) {
    const capacityProp = config?.capacityProp || 'capacity'
    const metersPerTube = num(config?.metersPerTube, 12)
    const minRadius = num(config?.minRadiusMeters, 8)

    return (geojson?.features || [])
        .filter((f) => f?.geometry?.type === 'Point')
        .map((f) => {
            const [lng, lat] = f.geometry.coordinates
            const capacity = num(f.properties?.[capacityProp], 0)
            const ratio = num(f.properties?.fillRatio, 0)
            return leaflet().circle([lat, lng], {
                radius: Math.max(minRadius, capacity * metersPerTube),
                color: colorFor(ratio),
                weight: 2,
                fill: true,
                fillOpacity: 0.15 + 0.45 * Math.max(0, Math.min(1, ratio)),
            })
        })
}

function make(ctx) {
    const layer = leaflet().layerGroup(ringsOf(ctx.geojson, ctx.config))

    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'depot_capacity',
        geojson: ctx.geojson,
        layer,
    }
}

/**
 * The host's data changed. The core default re-adds the host's GeoJSON, which
 * would draw the depots again rather than their rings.
 */
function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    ringsOf(geojson, config).forEach((ring) => attachment.layer.addLayer(ring))
}

/**
 * Retune in place: the core default rebuilds the whole host layer just to
 * change a radius scale.
 */
function onConfigChange(ctx) {
    if (ctx.attachment == null) return
    syncData(ctx.attachment, {
        geojson: ctx.attachment.geojson,
        config: ctx.config,
    })
}

const DepotCapacity = { make, syncData, onConfigChange }

export default DepotCapacity
export { ringsOf, colorFor }
