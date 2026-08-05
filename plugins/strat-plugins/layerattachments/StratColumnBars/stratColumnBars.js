/**
 * StratColumnBars — a stacked unit bar at each outcrop point.
 *
 * The bar's geometry comes from the unit table an admin typed into the *layer
 * type's* subtree, read via `unitsOfLayer(ctx.layerObj)`. See the container
 * README: `capabilities.defaultAttachments` can only carry facts a manifest
 * author knows, and the table is not one of them.
 */
import { unitsOfLayer } from '../../lib/unitTable'

const leaflet = () => window.L
const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

const M_PER_DEG = 111320

/** One unit's rectangle, offset north of the outcrop by its depth in the column. */
function barsOf(geojson, units, opts) {
    const { widthMeters, exaggeration, outlineColor } = opts
    const halfDeg = widthMeters / 2 / M_PER_DEG

    const rects = []
    ;(geojson?.features || []).forEach((f) => {
        if (f.geometry?.type !== 'Point') return
        const [lng, lat] = f.geometry.coordinates
        units.forEach((u) => {
            const top = lat + (u.top * exaggeration) / M_PER_DEG
            const base = lat + (u.base * exaggeration) / M_PER_DEG
            rects.push(
                leaflet().rectangle(
                    [
                        [top, lng - halfDeg],
                        [base, lng + halfDeg],
                    ],
                    {
                        color: outlineColor,
                        weight: 1,
                        fillColor: u.color,
                        fillOpacity: 0.85,
                    }
                )
            )
        })
    })
    return rects
}

function optsOf(config, layerObj) {
    return {
        widthMeters: num(config?.widthMeters, 40),
        exaggeration: num(config?.exaggeration, 1),
        outlineColor:
            config?.outlineColor ||
            layerObj?.variables?.stratColumn?.outlineColor ||
            '#222222',
    }
}

function make(ctx) {
    const units = unitsOfLayer(ctx.layerObj)
    if (units.length === 0) return false

    const opts = optsOf(ctx.config, ctx.layerObj)
    return {
        on: ctx.config?.initialVisibility !== false,
        type: 'strat_column_bars',
        geojson: ctx.geojson,
        layer: leaflet().layerGroup(barsOf(ctx.geojson, units, opts)),
        // syncData is handed new data but the same config, and re-deriving the
        // units per redraw would re-parse the table for nothing.
        _units: units,
        _opts: opts,
    }
}

/** Derived rectangles, so core's re-`addData` default would draw the raw points. */
function syncData(attachment, { geojson, onlyClear }) {
    attachment.layer.clearLayers()
    if (onlyClear) return
    barsOf(geojson, attachment._units, attachment._opts).forEach((r) =>
        attachment.layer.addLayer(r)
    )
}

/** Retune in place rather than paying for core's rebuild-the-host default. */
function onConfigChange(ctx) {
    const attachment = ctx.attachment
    if (!attachment) return
    attachment._opts = optsOf(ctx.config, ctx.layerObj)
    attachment._units = unitsOfLayer(ctx.layerObj)
    syncData(attachment, { geojson: attachment.geojson })
}

const StratColumnBars = { make, syncData, onConfigChange }

export default StratColumnBars
