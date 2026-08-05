/**
 * Shared, essence-free client for the FleetState backend plugin.
 *
 * This module is the seam between the four fleet-live plugins: the property
 * names the layer type puts on each feature (`rover`, `health`, `note`) are
 * defined here once, and the interaction and the component import them rather
 * than restating strings.
 */

export const FLEET_PROPS = {
    id: 'rover',
    health: 'health',
    battery: 'battery',
    note: 'note',
}

export const HEALTH_COLORS = {
    nominal: '#4e9a06',
    degraded: '#e9b949',
    fault: '#cc0000',
}

const root = () => {
    const rp = window?.mmgisglobal?.ROOT_PATH
    return rp ? `${rp}/` : ''
}

/** Core answers a rejection with HTTP 200 and status:'failure' — check the body. */
const unwrap = async (res) => {
    const body = await res.json()
    if (body?.status === 'failure')
        throw new Error(body.message || 'FleetState request failed')
    return body.body
}

export async function getFleet() {
    const res = await window.fetch(`${root()}api/fleetstate/state`, {
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
    })
    return unwrap(res)
}

export async function postNote(rover, note) {
    const res = await window.fetch(`${root()}api/fleetstate/note`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rover, note }),
    })
    return unwrap(res)
}

/** Style each feature by health so a mission needs no style config. */
export function decorate(geojson) {
    if (geojson == null) return null
    const features = (geojson.features || []).map((f) => ({
        ...f,
        properties: {
            ...f.properties,
            _healthColor:
                HEALTH_COLORS[f.properties?.[FLEET_PROPS.health]] || '#888888',
            style: {
                color:
                    HEALTH_COLORS[f.properties?.[FLEET_PROPS.health]] ||
                    '#888888',
                fillColor:
                    HEALTH_COLORS[f.properties?.[FLEET_PROPS.health]] ||
                    '#888888',
                fillOpacity: f.properties?.[FLEET_PROPS.note] ? 1 : 0.5,
                weight: f.properties?.[FLEET_PROPS.note] ? 4 : 2,
                radius: 8,
            },
        },
    }))
    return { type: 'FeatureCollection', features }
}
