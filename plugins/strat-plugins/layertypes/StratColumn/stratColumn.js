/**
 * StratColumn layer type — outcrops with a measured section at each point.
 *
 * Extends `vector`, so drawing, picking, filtering and both globes are
 * inherited. What differs is where the data comes from (`source`), what the
 * layer's own settings mean (`config`) and that its legend is the unit table an
 * admin typed rather than anything configured as a legend (`legend`).
 */
import { parseUnitTable, unitsOfLayer } from '../../lib/unitTable'

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * Outcrop points. `ctx.url` may be a plain GeoJSON or an OGC API Features
 * collection; either way the depth property is stamped onto a stable name so
 * the layer's `style` can say `prop-stratDepth` and the attachments do not have
 * to re-read the admin's property name per feature.
 */
async function fetch(layerObj, ctx) {
    if (!ctx.url) return null

    // `window.location` is one global tests/helpers/browser-globals.js does not
    // stub, so a relative-url base has to be optional here.
    const url = new URL(ctx.url, window.location?.href)
    url.searchParams.set('limit', num(layerObj?.variables?.stratColumn?.limit, 1000))
    if (ctx.view)
        url.searchParams.set(
            'bbox',
            [ctx.view.minx, ctx.view.miny, ctx.view.maxx, ctx.view.maxy].join(',')
        )

    const res = await window.fetch(url, {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const geojson = await res.json()

    const depthProp = layerObj?.variables?.stratColumn?.depthProp
    const total = unitsOfLayer(layerObj).reduce(
        (max, u) => Math.max(max, u.base),
        0
    )
    ;(geojson?.features || []).forEach((f) => {
        if (!f.properties) f.properties = {}
        f.properties.stratDepth = depthProp
            ? num(f.properties[depthProp], total)
            : total
    })

    return geojson
}

/** A layer of this type is a point layer whose features are clicked one at a time. */
function normalize(layerObj) {
    if (layerObj.variables?.stratColumn?.unitTable == null) return layerObj
    // The unit table is the layer's legend, so a mission need not configure one.
    layerObj._stratUnits = parseUnitTable(layerObj.variables.stratColumn.unitTable)
    return layerObj
}

/** The legend *is* the unit table — one swatch per unit, top first. */
function derive(layerObj) {
    const units = unitsOfLayer(layerObj)
    if (units.length === 0) return false
    layerObj._legend = units.map((u) => ({
        shape: 'square',
        color: u.color,
        value: `${u.name} (${u.thickness} m)`,
    }))
    return true
}

const StratColumn = {
    source: { fetch },
    config: { normalize },
    legend: { derive },
}

export default StratColumn
