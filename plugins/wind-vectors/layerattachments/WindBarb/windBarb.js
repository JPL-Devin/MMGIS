/**
 * WindBarb attachment — a meteorological wind barb at every station.
 *
 * Settings arrive as `ctx.config` from the manifest's `configPath`; a
 * `windstation` host also gets the defaults its layer type declared in
 * `capabilities.defaultAttachments`, with the layer's own settings on top.
 */
import { windOf, barbCounts, toKnots } from '../../lib/wind'

const leaflet = () => window.L

/**
 * The SVG of one barb, pointing along `direction` (degrees from north).
 *
 * @param {number} speedKnots
 * @param {number} direction
 * @param {string} color
 * @returns {string} svg markup
 */
export function barbSvg(speedKnots, direction, color) {
    const { pennants, fullBarbs, halfBarbs } = barbCounts(speedKnots)
    const shaft = 32
    const parts = [`<line x1="16" y1="32" x2="16" y2="${32 - shaft}" stroke="${color}" stroke-width="2"/>`]
    let y = 32 - shaft
    for (let i = 0; i < pennants; i++) {
        parts.push(`<polygon points="16,${y} 16,${y + 5} 27,${y + 2.5}" fill="${color}"/>`)
        y += 6
    }
    for (let i = 0; i < fullBarbs; i++) {
        parts.push(`<line x1="16" y1="${y}" x2="27" y2="${y + 3}" stroke="${color}" stroke-width="2"/>`)
        y += 4
    }
    for (let i = 0; i < halfBarbs; i++) {
        parts.push(`<line x1="16" y1="${y}" x2="22" y2="${y + 1.5}" stroke="${color}" stroke-width="2"/>`)
        y += 4
    }
    return (
        `<svg width="32" height="32" viewBox="0 0 32 32" ` +
        `style="transform: rotate(${direction}deg); transform-origin: 16px 32px;">` +
        parts.join('') +
        '</svg>'
    )
}

function make(ctx) {
    const L = leaflet()
    const config = ctx.config || {}
    const color = config.color || '#ffffff'
    const units = config.speedUnits || 'knots'
    const features = ctx.geojson?.features || []

    const drawn = []
    const markers = []
    for (const feature of features) {
        const wind = windOf(feature, config)
        if (wind == null) continue
        const coords = feature.geometry?.coordinates
        if (!Array.isArray(coords) || coords.length < 2) continue
        const knots = toKnots(wind.speed, units)
        markers.push(
            L.marker([coords[1], coords[0]], {
                interactive: false,
                icon: L.divIcon({
                    className: 'windBarb',
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    html: barbSvg(knots, wind.direction, color),
                }),
            })
        )
        drawn.push(feature)
    }
    if (markers.length === 0) return false

    return {
        on: config.initialVisibility !== false,
        type: 'wind_barb',
        geojson: { type: 'FeatureCollection', features: drawn },
        layer: L.layerGroup(markers),
    }
}

const WindBarb = {
    make,
}

export default WindBarb
