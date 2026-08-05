/**
 * SwathLook attachment — an arrow from each planned swath's centre showing the
 * roll/look direction the instrument will use.
 */
import { centroidOf, lookVector } from '../../lib/swathGeometry'

const leaflet = () => window.L

const arrowsOf = (geojson, cfg) => {
    const {
        azimuthProp = 'look_azimuth',
        rollProp = 'roll_deg',
        sideProp = 'look_direction',
        lengthDeg = 0.6,
        color = '#ffcc00',
    } = cfg || {}
    return (geojson?.features || [])
        .map((f) => {
            const centre = centroidOf(f)
            if (!centre) return null
            const p = f.properties || {}
            const roll = Number(p[rollProp])
            const side = p[sideProp] || (roll < 0 ? 'left' : 'right')
            const end = lookVector(centre, p[azimuthProp], lengthDeg, side)
            const line = leaflet().polyline(
                [
                    [centre[1], centre[0]],
                    [end[1], end[0]],
                ],
                { color, weight: 2, opacity: 0.9 }
            )
            if (Number.isFinite(roll))
                line.bindTooltip(`${side} ${Math.abs(roll).toFixed(0)}°`, {
                    sticky: true,
                })
            return line
        })
        .filter(Boolean)
}

function make(ctx) {
    const cfg = ctx.config || {}
    return {
        on: cfg.initialVisibility !== false,
        type: 'swath_look',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(arrowsOf(ctx.geojson, cfg)),
        _cfg: cfg,
    }
}

/** Derived lines in a layerGroup, so the core re-addData default is wrong. */
function syncData(attachment, { geojson, onlyClear, config }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    attachment.geojson = geojson
    arrowsOf(geojson, config || attachment._cfg).forEach((l) =>
        attachment.layer.addLayer(l)
    )
}

/** Retune in place rather than paying for core's whole-host rebuild. */
function onConfigChange(ctx) {
    if (!ctx.attachment) return
    ctx.attachment._cfg = ctx.config || {}
    syncData(ctx.attachment, {
        geojson: ctx.attachment.geojson,
        config: ctx.attachment._cfg,
    })
}

const SwathLook = { make, syncData, onConfigChange }

export default SwathLook
