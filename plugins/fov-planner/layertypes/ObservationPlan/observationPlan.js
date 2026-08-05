/**
 * ObservationPlan layer type — extends `vector`.
 *
 * A layer of planned pointed observations. Drawing, picking, filtering and both
 * globes are vector's; this type owns two things:
 *
 *   source.fetch     — the plan service, which answers with a plain
 *                      FeatureCollection but is bbox- and time-limited so a
 *                      long campaign doesn't arrive at once.
 *   config.normalize — the defaults that make a layer of this type useful the
 *                      moment an admin picks the type: a status-driven style,
 *                      dynamic extent, and time.
 *
 * The FOV footprint and the click behavior are *not* here: they are declared in
 * the manifest's `capabilities.defaultAttachments` / `defaultInteractions`, so
 * this type never writes into another plugin's config subtree.
 */

const STATUS_COLORS = {
    planned: '#c67f00',
    acquired: '#4e9a06',
    failed: '#cc0000',
}

async function fetch(layerObj, ctx) {
    if (!ctx.url) return null

    const url = new URL(ctx.url, window.location.origin)
    if (ctx.view) {
        url.searchParams.set(
            'bbox',
            [ctx.view.minx, ctx.view.miny, ctx.view.maxx, ctx.view.maxy].join(',')
        )
    }
    if (ctx.time?.requery && ctx.time.start && ctx.time.end) {
        url.searchParams.set('datetime', `${ctx.time.start}/${ctx.time.end}`)
    }

    const res = await window.fetch(url.toString(), {
        headers: { Accept: 'application/geo+json' },
        signal: ctx.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)

    const collection = await res.json()
    const statusProp = layerObj?.variables?.observationPlan?.statusProp || 'status'

    // The inherited renderer styles from feature properties, so the per-status
    // color is computed here rather than in a renderer of our own.
    for (const feature of collection?.features || []) {
        const status = feature?.properties?.[statusProp]
        if (feature.properties && STATUS_COLORS[status])
            feature.properties['prop-color'] = STATUS_COLORS[status]
    }
    return collection
}

/**
 * Sensible defaults for a brand-new layer of this type.
 * `inherited` is vector's normalize — run it first, it sets `kind`/`radius`.
 */
function normalize(layerObj, ctx, inherited) {
    if (typeof inherited === 'function') inherited()

    const vars = (layerObj.variables = layerObj.variables || {})
    vars.observationPlan = vars.observationPlan || {}
    vars.observationPlan.statusProp = vars.observationPlan.statusProp || 'status'

    // A campaign is long and dense: only fetch what is in view.
    if (vars.dynamicExtent == null) vars.dynamicExtent = true

    // Style by the status color `fetch` computed, falling back to planned.
    layerObj.style = layerObj.style || {}
    if (layerObj.style.color == null) layerObj.style.color = 'prop-color'
    if (layerObj.style.fillOpacity == null) layerObj.style.fillOpacity = 0.8

    return layerObj
}

const ObservationPlan = {
    source: { fetch },
    config: { normalize },
}

export default ObservationPlan
