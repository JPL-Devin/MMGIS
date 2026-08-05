/**
 * Row → GeoJSON. CommonJS: a backend plugin is `require`d by the server, so this
 * cannot be the container's shared ESM `lib/` module the frontend imports.
 */
function toFeature(row) {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
        properties: {
            id: row.id,
            note: row.note,
            author: row.author || null,
            createdAt: row.createdAt || null,
            ...(row.payload || {}),
        },
    }
}

function toFeatureCollection(rows) {
    return {
        type: 'FeatureCollection',
        features: (rows || []).map(toFeature),
    }
}

module.exports = { toFeature, toFeatureCollection }
