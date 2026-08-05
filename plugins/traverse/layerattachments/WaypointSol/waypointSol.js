/**
 * WaypointSol attachment — labels each traverse waypoint with its sol and draws
 * the drive direction (a bearing arrow) at each segment between consecutive
 * waypoints.
 *
 * It is a sublayer: it builds its own layerGroup rather than decorating the
 * host, so it is listed and toggleable under the host's Composite Layers. It
 * needs the host's waypoint-property names, which the RoverTraverse layer type
 * writes to `layerObj.variables.traverse` — read from `ctx.layerObj`, since an
 * attachment only gets its *own* subtree as `ctx.config`.
 *
 * Leaflet is read per call (not imported), so the pure helpers below can be
 * imported and unit-tested in Node. See
 * plugins/core/layerattachments/README.md.
 */

const leaflet = () => window.L

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const getIn = (obj, path) =>
    path == null
        ? undefined
        : String(path)
              .split('.')
              .reduce((o, k) => (o == null ? undefined : o[k]), obj)

// A point feature's [lng, lat], or null.
function lngLat(feature) {
    const g = feature && feature.geometry
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) return null
    const [lng, lat] = g.coordinates
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null
}

/**
 * The host's point features in traverse order (ascending by orderProp, then by
 * original index). Non-points are dropped. Pure — the interaction sorts the
 * same way, deliberately.
 */
function orderWaypoints(geojson, orderProp) {
    const features = (geojson && geojson.features) || []
    return features
        .map((feature, index) => ({ feature, index, ll: lngLat(feature) }))
        .filter((w) => w.ll)
        .sort((a, b) => {
            const av = num(getIn(a.feature.properties, orderProp), a.index)
            const bv = num(getIn(b.feature.properties, orderProp), b.index)
            return av === bv ? a.index - b.index : av - bv
        })
}

/**
 * Initial compass bearing (degrees clockwise from north) from a→b, each
 * [lng, lat]. Pure.
 */
function bearing(a, b) {
    const toRad = (d) => (d * Math.PI) / 180
    const [lng1, lat1] = a
    const [lng2, lat2] = b
    const φ1 = toRad(lat1)
    const φ2 = toRad(lat2)
    const Δλ = toRad(lng2 - lng1)
    const y = Math.sin(Δλ) * Math.cos(φ2)
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
    return (Math.atan2(y, x) * 180) / Math.PI
}

function buildLayer(geojson, layerObj, config) {
    const L = leaflet()
    const traverse = (layerObj && layerObj.variables && layerObj.variables.traverse) || {}
    const orderProp = traverse.orderProp || traverse.solProp || 'sol'
    const solProp = traverse.solProp || 'sol'
    const color = config?.arrowColor || '#c9611e'
    const showArrows = config?.showArrows !== false

    const ordered = orderWaypoints(geojson, orderProp)
    const renderables = []

    // Sol label beside each waypoint.
    ordered.forEach((w) => {
        const sol = getIn(w.feature.properties, solProp)
        if (sol == null) return
        const [lng, lat] = w.ll
        renderables.push(
            L.marker([lat, lng], {
                interactive: false,
                icon: L.divIcon({
                    className: 'waypointSolLabel',
                    html: `<span class="waypointSolLabel-text">sol ${sol}</span>`,
                    iconAnchor: [-8, 8],
                }),
            })
        )
    })

    // Drive-direction arrow at the midpoint of each segment.
    if (showArrows) {
        for (let i = 0; i < ordered.length - 1; i++) {
            const from = ordered[i].ll
            const to = ordered[i + 1].ll
            const deg = bearing(from, to)
            const mid = [(from[1] + to[1]) / 2, (from[0] + to[0]) / 2]
            renderables.push(
                L.marker(mid, {
                    interactive: false,
                    icon: L.divIcon({
                        className: 'waypointSolArrow',
                        html: `<span class="waypointSolArrow-glyph" style="color:${color};transform:rotate(${deg}deg)">&#9650;</span>`,
                        iconSize: [16, 16],
                        iconAnchor: [8, 8],
                    }),
                })
            )
        }
    }

    return L.layerGroup(renderables)
}

function make(ctx) {
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'waypoint_sol',
        geojson: ctx.geojson,
        layer: buildLayer(ctx.geojson, ctx.layerObj, ctx.config),
        _layerObj: ctx.layerObj,
        _config: ctx.config,
    }
}

/**
 * The host's data changed. These are derived markers in a layerGroup, not a
 * re-`addData`-able geoJson layer, so rebuild them from the new data.
 */
function syncData(attachment, ctx) {
    attachment.layer.clearLayers()
    if (ctx.onlyClear) return
    const rebuilt = buildLayer(ctx.geojson, attachment._layerObj, attachment._config)
    rebuilt.eachLayer((l) => attachment.layer.addLayer(l))
    attachment.geojson = ctx.geojson
}

const WaypointSol = { make, syncData }
export default WaypointSol
// Exported for unit tests (pure, browser-free).
export { orderWaypoints, bearing }
