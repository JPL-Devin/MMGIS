/**
 * DustOpacityCompare layer type — extends `vector`.
 *
 * Predicted versus observed dust opacity. The two datasets are acquired *here*,
 * in `source.fetch`, and joined into one FeatureCollection, rather than one
 * plugin reaching into another layer's render — see "Composing across layers is
 * not supported" in plugins/README.md. The result is a normal layer: core
 * refetches it, filters it, and the inherited vector renderer draws it.
 */
import { joinOpacity, deltaRange } from '../../lib/dustJoin'

const setting = (layerObj, key, fallback) => {
    const value = layerObj?.variables?.dustOpacity?.[key]
    return value === undefined || value === '' ? fallback : value
}

async function getJSON(url, ctx) {
    const res = await window.fetch(ctx.resolveUrl ? ctx.resolveUrl(url) : url, {
        headers: { Accept: 'application/geo+json' },
        signal: ctx.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
    return res.json()
}

async function fetch(layerObj, ctx) {
    // The predicted dataset is the layer's own url; the observed one is this
    // type's own config row. Both are acquired on every trigger core drives, so
    // the join is never stale relative to the layer that shows it.
    const predictedUrl = setting(layerObj, 'predictedUrl', ctx.url)
    const observedUrl = setting(layerObj, 'observedUrl', null)
    if (!predictedUrl || !observedUrl) return null

    const [predicted, observed] = await Promise.all([
        getJSON(predictedUrl, ctx),
        getJSON(observedUrl, ctx),
    ])

    const joined = joinOpacity(predicted, observed, {
        joinProp: setting(layerObj, 'joinProp', 'site_id'),
        predictedProp: setting(layerObj, 'predictedProp', 'opacity'),
        observedProp: setting(layerObj, 'observedProp', 'opacity'),
        keepUnmatched: setting(layerObj, 'keepUnmatched', true) !== false,
    })

    // Stash the scale for `legend.derive`, which is handed the config and not
    // the data (layertypes README, the `legend` surface).
    layerObj._dustDeltaRange = deltaRange(joined)
    return joined
}

/**
 * A legend that comes from the data: the diverging scale the deltas span.
 * Returns false when this layer has nothing to derive.
 */
function derive(layerObj) {
    const range = layerObj?._dustDeltaRange
    if (!range || range[1] === 0) return false
    layerObj._legend = [
        { color: '#2166ac', value: `${range[0].toFixed(2)} (over-predicted)`, shape: 'circle' },
        { color: '#f7f7f7', value: '0', shape: 'circle' },
        { color: '#b2182b', value: `+${range[1].toFixed(2)} (under-predicted)`, shape: 'circle' },
    ]
    return true
}

const DustOpacityCompare = {
    source: { fetch },
    legend: { derive },
}

export default DustOpacityCompare
