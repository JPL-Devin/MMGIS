/**
 * StratUnitLabels — the unit names beside each outcrop's column bar.
 *
 * Built after its siblings (`capabilities.host.buildsAfterSiblings`) because the
 * bar it labels is another attachment: the bar's own geometry options are read
 * off `ctx.siblings` so a label cannot drift from the rectangle it names.
 */
import { unitsOfLayer } from '../../lib/unitTable'

const leaflet = () => window.L
const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const M_PER_DEG = 111320

/** The bar attachment's resolved geometry, or its defaults if it isn't built. */
function barGeometry(siblings) {
    const bars = siblings?.strat_column_bars
    return {
        widthMeters: num(bars?._opts?.widthMeters, 40),
        exaggeration: num(bars?._opts?.exaggeration, 1),
    }
}

function labelsOf(geojson, units, opts) {
    const { widthMeters, exaggeration, side, textColor, showThickness } = opts
    const offsetDeg = (side === 'left' ? -1 : 1) * (widthMeters / 1.6 / M_PER_DEG)

    const markers = []
    ;(geojson?.features || []).forEach((f) => {
        if (f.geometry?.type !== 'Point') return
        const [lng, lat] = f.geometry.coordinates
        units.forEach((u) => {
            const mid = lat + (((u.top + u.base) / 2) * exaggeration) / M_PER_DEG
            const text = showThickness ? `${u.name} — ${u.thickness} m` : u.name
            markers.push(
                leaflet().marker([mid, lng + offsetDeg], {
                    interactive: false,
                    icon: leaflet().divIcon({
                        className: 'stratUnitLabel',
                        html: `<span style="color:${textColor};white-space:nowrap">${text}</span>`,
                    }),
                })
            )
        })
    })
    return markers
}

function optsOf(config, siblings) {
    return {
        ...barGeometry(siblings),
        side: config?.side === 'left' ? 'left' : 'right',
        textColor: config?.textColor || '#111111',
        showThickness: config?.showThickness === true,
    }
}

function make(ctx) {
    const units = unitsOfLayer(ctx.layerObj)
    if (units.length === 0) return false

    const opts = optsOf(ctx.config, ctx.siblings)
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'strat_unit_labels',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(labelsOf(ctx.geojson, units, opts)),
        _units: units,
        _opts: opts,
    }
}

function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    labelsOf(geojson, attachment._units, attachment._opts).forEach((m) =>
        attachment.layer.addLayer(m)
    )
}

const StratUnitLabels = { make, syncData }

export default StratUnitLabels
