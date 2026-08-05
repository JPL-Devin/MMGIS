/**
 * OrbitalPrediction layer type — extends `vector`.
 *
 * Predicted surface positions from an orbital propagation service. Drawing,
 * picking, filtering and both globes are inherited from `vector`; this type
 * owns only how the data arrives and what a prediction feature is guaranteed to
 * carry, because that is the fact the attachment and the interaction in this
 * container depend on.
 */
import { MATCH_ID_PROP } from '../../lib/crossref'

/**
 * Normalize the service's records into features whose match key sits in one
 * known place. The attachment and the interaction are configured with the
 * mission's own property name, but a prediction that names its ground truth
 * gets it copied to MATCH_ID_PROP too, so a mission that configures nothing
 * still pairs.
 */
function stamp(collection, layerObj) {
    const idProp = layerObj?.variables?.crossref?.truthIdProp
    const features = collection?.features || []
    if (idProp)
        for (const f of features) {
            const v = f.properties?.[idProp]
            if (v != null && f.properties) f.properties[MATCH_ID_PROP] = v
        }
    return collection
}

async function fetch(layerObj, ctx) {
    if (!ctx.url) return null
    const url = new URL(ctx.url, window.location?.href || 'http://localhost/')
    if (ctx.view) {
        url.searchParams.set(
            'bbox',
            [ctx.view.minx, ctx.view.miny, ctx.view.maxx, ctx.view.maxy].join(',')
        )
    }
    if (ctx.time?.requery && ctx.time.start && ctx.time.end)
        url.searchParams.set('datetime', `${ctx.time.start}/${ctx.time.end}`)

    const res = await window.fetch(url.toString(), {
        headers: { Accept: 'application/geo+json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return stamp(await res.json(), layerObj)
}

/** A prediction layer is viewport-driven unless a mission says otherwise. */
function normalize(layerObj) {
    layerObj.variables = layerObj.variables || {}
    if (layerObj.variables.dynamicExtent === undefined)
        layerObj.variables.dynamicExtent = true
    return layerObj
}

const OrbitalPrediction = {
    source: { fetch },
    config: { normalize },
}

export { stamp }
export default OrbitalPrediction
