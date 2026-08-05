/**
 * Shared client for the SampleDepot backend plugin's routes.
 *
 * This module is the seam between the three plugins of this container: the
 * layer type (`layertypes/SampleTubes`) and the interaction
 * (`interactions/TubeRetrieve`) both talk to the backend plugin
 * (`backend/SampleDepot`) through here, so the route paths, the shape of a tube
 * and the GeoJSON conversion exist once. It imports nothing from src/essence,
 * which is also what makes it unit-testable in Node.
 */

export const API_PREFIX = 'api/sampledepot'

/** The property a tube's retrieved state lives in, once converted to GeoJSON. */
export const RETRIEVED_PROP = 'retrieved'
/** The property carrying a tube's database id. */
export const ID_PROP = 'tube_id'

/**
 * MMGIS may be served under a subpath and the frontend's copy of it is
 * window.mmgisglobal.ROOT_PATH, so urls are built the way the backend README
 * says to build them: no leading slash, the trailing slash comes from ROOT_PATH.
 */
export function apiUrl(path) {
    const rp =
        typeof window !== 'undefined' && window.mmgisglobal
            ? window.mmgisglobal.ROOT_PATH
            : ''
    const root = rp ? `${rp}/` : ''
    return `${root}${API_PREFIX}/${path}`
}

/**
 * Turn the backend's tube rows into a FeatureCollection the inherited vector
 * renderer can draw. Pure — this is the part tests cover.
 *
 * @param {Array<object>} tubes rows as the backend returns them
 * @returns {object} a GeoJSON FeatureCollection
 */
export function tubesToGeoJSON(tubes) {
    const features = (tubes || [])
        .filter((t) => t && t.lng != null && t.lat != null)
        .map((t) => ({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [Number(t.lng), Number(t.lat)],
            },
            properties: {
                [ID_PROP]: t.id,
                depot: t.depot_name,
                name: t.name,
                sample_type: t.sample_type,
                [RETRIEVED_PROP]: t.retrieved === true,
                // `retrieved_state` is a string so a mission's style can name it
                // with `prop-` and a derived legend can match on it.
                retrieved_state: t.retrieved === true ? 'retrieved' : 'onGround',
                retrieved_at: t.retrieved_at || null,
            },
        }))
    return { type: 'FeatureCollection', features }
}

async function request(path, options) {
    const res = await window.fetch(apiUrl(path), {
        // A route behind ensureUser needs the session cookie.
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        ...(options || {}),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return res.json()
}

/** GET the tubes of a depot (or all of them) as GeoJSON. */
export async function fetchTubesGeoJSON(depot) {
    const q = depot ? `?depot=${encodeURIComponent(depot)}` : ''
    const body = await request(`tubes${q}`)
    return tubesToGeoJSON(body.tubes)
}

/** POST: flip a tube to retrieved. */
export async function markRetrieved(id) {
    return request('tubes/retrieve', {
        method: 'POST',
        body: JSON.stringify({ id }),
    })
}

/** POST: drop a new tube at a location. */
export async function addTube(tube) {
    return request('tubes/add', {
        method: 'POST',
        body: JSON.stringify(tube),
    })
}
