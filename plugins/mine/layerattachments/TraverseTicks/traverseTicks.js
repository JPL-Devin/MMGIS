/**
 * TraverseTicks attachment — odometry tick marks along a traverse.
 *
 * Walks each LineString of the host's data and drops a tick (and, optionally, a
 * distance label) at every `intervalMeters` of along-path distance, the way a
 * rover traverse is read: "where was it at 500 m?".
 */

import F_ from '@basics/Formulae_/Formulae_'

const L = window.L

const linesOf = (geojson) => {
    const lines = []
    ;(geojson?.features || []).forEach((f) => {
        const g = f.geometry
        if (!g) return
        if (g.type === 'LineString') lines.push(g.coordinates)
        else if (g.type === 'MultiLineString') g.coordinates.forEach((c) => lines.push(c))
    })
    return lines
}

/**
 * Points, in [lng, lat, distance] form, spaced `interval` metres of along-path
 * distance apart. Distances accumulate across a MultiLineString's parts so a
 * traverse split into sols reads as one odometer.
 */
const ticksAlong = (lines, interval) => {
    const ticks = []
    let total = 0
    let next = interval
    lines.forEach((coords) => {
        for (let i = 1; i < coords.length; i++) {
            const [aLng, aLat] = coords[i - 1]
            const [bLng, bLat] = coords[i]
            const seg = F_.lngLatDistBetween(aLng, aLat, bLng, bLat)
            if (!seg) continue
            while (next <= total + seg) {
                const t = (next - total) / seg
                ticks.push([aLng + (bLng - aLng) * t, aLat + (bLat - aLat) * t, next])
                next += interval
            }
            total += seg
        }
    })
    return ticks
}

const tickLayers = (geojson, opts) => {
    const ticks = ticksAlong(linesOf(geojson), opts.interval)
    const layers = []
    ticks.forEach(([lng, lat, dist]) => {
        layers.push(
            L.circleMarker([lat, lng], {
                radius: opts.radius,
                color: opts.color,
                fillColor: opts.color,
                fillOpacity: 1,
                weight: 1,
            })
        )
        if (opts.labels)
            layers.push(
                L.marker([lat, lng], {
                    interactive: false,
                    icon: L.divIcon({
                        className: 'traverseTicksLabel',
                        html: `<div style="color:${opts.color};font-size:11px;white-space:nowrap;text-shadow:0 0 3px #000;transform:translate(8px,-8px)">${formatDist(
                            dist
                        )}</div>`,
                    }),
                })
            )
    })
    return layers
}

const formatDist = (m) => (m >= 1000 ? `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 2)} km` : `${Math.round(m)} m`)

const optsFrom = (config) => ({
    interval: Math.max(1, parseFloat(F_.getIn(config, 'intervalMeters', 100)) || 100),
    color: F_.getIn(config, 'color', '#ffcc00'),
    radius: parseFloat(F_.getIn(config, 'radius', 4)) || 4,
    labels: F_.getIn(config, 'showLabels', true) !== false,
})

function make({ geojson, config }) {
    const opts = optsFrom(config)
    return {
        on: F_.getIn(config, 'initialVisibility', true),
        type: 'traverse_ticks',
        geojson,
        layer: L.layerGroup(tickLayers(geojson, opts)),
        // syncData is handed new data but not the config.
        _opts: opts,
    }
}

/**
 * The core default re-adds the host's GeoJSON, which is wrong here: these are
 * derived markers in a layerGroup, so they are rebuilt from the new data.
 */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    tickLayers(geojson, attachment._opts).forEach((l) => attachment.layer.addLayer(l))
}

export default { make, syncData }

export { ticksAlong, formatDist }
