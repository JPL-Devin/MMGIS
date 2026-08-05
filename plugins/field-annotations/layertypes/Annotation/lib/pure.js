/**
 * Import-free helpers shared by the layertype, the interaction and their unit
 * tests. Anything that touches an MMGIS singleton cannot be imported in a Node
 * test (jquery needs a real document), so the testable logic lives here.
 */
export const apiUrl = (path, rootPath = '') =>
    `${String(rootPath).replace(/\/$/, '')}/api/annotations${path}`

export function styleAnnotations(geojson, color) {
    const features = (geojson?.features || []).map((f) => ({
        ...f,
        properties: {
            ...f.properties,
            style: { color, fillColor: color, fillOpacity: 0.9, radius: 6 },
        },
    }))
    return { type: 'FeatureCollection', features }
}

export function buildAnnotationBody(latlng, note, mission) {
    return {
        mission: mission || '',
        lng: latlng?.lng,
        lat: latlng?.lat,
        note: note,
    }
}
