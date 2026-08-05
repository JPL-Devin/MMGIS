/**
 * Annotation layer type.
 *
 * Draws exactly like a vector layer (`extends: vector`) — only where the data
 * comes from differs, so the whole plugin is the `source` surface plus a small
 * `config` surface that gives the layer a url it doesn't need to configure.
 */
import L_ from '@basics/Layers_/Layers_'

import { apiUrl, styleAnnotations } from './lib/pure'

async function fetchAnnotations(layerObj, ctx = {}) {
    const mission = L_.mission || window.mmgisglobal?.mission || ''
    const url = apiUrl(
        `/list?mission=${encodeURIComponent(mission)}`,
        window.mmgisglobal?.ROOT_PATH || ''
    )
    const res = await window.fetch(url, {
        headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return styleAnnotations(
        await res.json(),
        layerObj?.variables?.annotationColor || '#ffcc00'
    )
}

function normalize(layerObj) {
    // A source-backed type needs no url; core only reads one if it is there.
    if (layerObj.url == null) layerObj.url = ''
    return layerObj
}

export default {
    source: { fetch: fetchAnnotations },
    config: { normalize },
}
