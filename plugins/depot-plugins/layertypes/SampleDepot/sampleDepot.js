/**
 * SampleDepot layer type — extends `vector`.
 *
 * Sample-tube depots: drawn like vector features, but the depot inventory comes
 * from a depot service, each depot carries a computed `fillRatio`, and the
 * filter UI offers depot-specific aggregations rather than Vector's local ones.
 *
 * The point of this module is the four *shapes* of override the contract
 * documents (plugins/core/layertypes/README.md:96-118):
 *
 *   config.normalize        add to the parent   — inherited() first, then ours
 *   config.expand           add to the parent, async — await inherited()
 *   filter.getAggregations  replace outright    — inherited() never called
 *   map.timeChange          run before the parent — ours, then return inherited()
 *   map.make                parent declares phases — we write `main` only, and
 *                           the parent's `after`/`afterCommit` still run
 */

const DEPOT_DEFAULTS = {
    capacityProp: 'capacity',
    stowedProp: 'stowed',
}

const fillRatioOf = (props, capacityProp, stowedProp) => {
    const capacity = parseFloat(props?.[capacityProp])
    const stowed = parseFloat(props?.[stowedProp])
    if (!Number.isFinite(capacity) || capacity <= 0) return null
    return Math.max(0, Math.min(1, (Number.isFinite(stowed) ? stowed : 0) / capacity))
}

/**
 * `source.fetch` — the depot service. Vector has no `source` module, so this is
 * a new operation rather than an override; `inherited()` would be a no-op here.
 */
async function fetch(layerObj, ctx) {
    if (!ctx.url) return null

    const url = new URL(ctx.resolveUrl ? ctx.resolveUrl(ctx.url) : ctx.url, window.location.href)
    if (ctx.view)
        url.searchParams.set(
            'bbox',
            [ctx.view.minx, ctx.view.miny, ctx.view.maxx, ctx.view.maxy].join(',')
        )
    if (ctx.time?.requery) url.searchParams.set('datetime', `${ctx.time.start}/${ctx.time.end}`)

    const res = await window.fetch(url.toString(), {
        headers: { Accept: 'application/geo+json' },
        signal: ctx.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    const geojson = await res.json()

    // Style-by-data: the mission's `style` can then say `"color": "prop-fillRatio"`.
    const v = { ...DEPOT_DEFAULTS, ...(layerObj?.variables?.depot || {}) }
    for (const f of geojson?.features || []) {
        if (f.properties == null) f.properties = {}
        f.properties.fillRatio = fillRatioOf(f.properties, v.capacityProp, v.stowedProp)
    }
    return geojson
}

/**
 * `config.normalize` — ADD TO the parent. Vector's normalize sets `kind` and
 * `radius`; dropping those is exactly the bug the `inherited` argument exists
 * to prevent, so it runs first and we add depot defaults on top.
 *
 * NOTE the arity: core dispatches config ops with `[layerObj]` alone
 * (src/essence/Basics/Layers_/lifecycle/config.js:104,187), so `inherited` is
 * the SECOND argument here, not the third the README's example shows
 * (plugins/core/layertypes/README.md:104).
 */
function normalize(layerObj, inherited) {
    inherited()
    if (layerObj.variables == null) layerObj.variables = {}
    layerObj.variables.depot = { ...DEPOT_DEFAULTS, ...(layerObj.variables.depot || {}) }
    // A depot service is viewport-driven; default it here rather than expecting
    // a mission author to know (README: source, "dynamic extent").
    layerObj.variables.dynamicExtent = layerObj.variables.dynamicExtent ?? true
    return layerObj
}

/**
 * `config.expand` — ADD TO the parent, on an async operation. Vector's expand
 * turns a STAC url into a header of sublayers, which a depot url should still
 * be able to do, so we await it and then stamp every layer it produced.
 */
async function expand(layerObj, inherited) {
    const expanded = await inherited()
    const list = Array.isArray(expanded) ? expanded : [expanded ?? layerObj]
    for (const l of list) if (l != null) l._isDepot = true
    return Array.isArray(expanded) ? list : list[0]
}

/**
 * `filter.getAggregations` — REPLACE outright. Vector aggregates over whatever
 * properties the GeoJSON happens to have; a depot layer offers only the two
 * that mean something. `inherited` is deliberately not called.
 */
async function getAggregations(layerName, filters = {}, ctx = {}) {
    const geojson = filters?.geojson
    const features = geojson?.features || []
    const buckets = { empty: 0, partial: 0, full: 0 }
    for (const f of features) {
        const r = f?.properties?.fillRatio
        if (r == null) continue
        if (r <= 0) buckets.empty++
        else if (r >= 1) buckets.full++
        else buckets.partial++
    }
    return {
        fillState: Object.entries(buckets).map(([value, count]) => ({ value, count })),
    }
}

/**
 * `map.timeChange` — run BEFORE the parent. The depot inventory is stamped for
 * the new window first, then Vector's own time behaviour (local time filter, or
 * a reload) runs on top of it and its return value is passed straight through.
 */
function timeChange(layerObj, ctx = {}, inherited) {
    layerObj._depotWindow = { start: ctx.startTime, end: ctx.endTime }
    return inherited()
}

/**
 * `map.make` — the parent declares phases (`main` + `after` + `afterCommit`).
 * We write `main` only: it is handed the parent's `main`, and Vector's
 * filtering `after`/`afterCommit` still run around it untouched.
 */
const make = {
    async main(layerObj, ctx = {}, inherited) {
        layerObj._depotMadeAt = Date.now()
        await inherited()
    },
}

const SampleDepot = {
    source: { fetch },
    config: { normalize, expand },
    filter: { getAggregations },
    map: { make, timeChange },
}

export default SampleDepot
export { fillRatioOf }
