/**
 * FieldObsPoints layer type — extends `vector`.
 *
 * Its data does not come from the layer's `url`: it comes from this plugin's own
 * config (`variables.fieldObs.endpoint`), which is a *path* an admin types. The
 * turn from path to request is `ctx.resolveUrl`, which is root-relative behind
 * ROOT_PATH — hand-rolling it off `window.mmgisglobal` is what that exists to
 * replace.
 */
export const DEFAULT_ENDPOINT = '/api/fieldObs/observations'

/** Where this layer's observations live, as configured. Pure — unit tested. */
export function endpointOf(layerObj) {
    const endpoint = layerObj?.variables?.fieldObs?.endpoint
    return typeof endpoint === 'string' && endpoint.trim()
        ? endpoint.trim()
        : DEFAULT_ENDPOINT
}

async function fetch(layerObj, ctx) {
    const url = ctx.resolveUrl(endpointOf(layerObj))
    const res = await window.fetch(url, {
        credentials: 'same-origin',
        headers: { Accept: 'application/geo+json' },
        signal: ctx.signal,
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}

const FieldObsPoints = {
    source: { fetch },
}

export default FieldObsPoints
