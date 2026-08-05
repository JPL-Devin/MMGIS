/**
 * SampleTubes layer type — extends `vector`.
 *
 * Its data is not at a url core can fetch (it is this container's backend
 * plugin, needs the session cookie, and the rows have to be turned into
 * features), so it declares the `source` surface and inherits everything else
 * from `vector`: drawing, picking, filtering, both globes.
 *
 * The property names the interaction and any styling rely on live in
 * ../../lib/depotApi.js, imported relatively, so they exist once in the
 * container rather than once per plugin.
 */
import { fetchTubesGeoJSON } from '../../lib/depotApi'

async function fetch(layerObj, ctx) {
    void ctx
    const depot = layerObj?.variables?.depot || null
    const geojson = await fetchTubesGeoJSON(depot)

    // A legend derived from the data rather than configured: it both labels and
    // styles (styleMatching), so a mission needs no per-layer style for the
    // retrieved/on-ground distinction to be visible.
    layerObj._legend = [
        {
            shape: 'circle',
            color: '#4e9a06',
            value: 'On the ground',
            styleMatching: true,
            propertyName: 'retrieved_state',
            propertyValue: 'onGround',
        },
        {
            shape: 'circle',
            color: '#888888',
            value: 'Retrieved',
            styleMatching: true,
            propertyName: 'retrieved_state',
            propertyValue: 'retrieved',
        },
    ]
    return geojson
}

function derive(layerObj) {
    // fetch() already computed it from the data; nothing to derive before then.
    return Array.isArray(layerObj._legend) && layerObj._legend.length > 0
}

const SampleTubes = {
    source: { fetch },
    legend: { derive },
}

export default SampleTubes
