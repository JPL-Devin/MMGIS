/**
 * Pure row -> GeoJSON conversion, kept out of the route so it is unit testable
 * without a database or a live server.
 */
function toFeature(row) {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.lng, row.lat] },
        properties: {
            id: row.id,
            note: row.note,
            author: row.author || null,
            mission: row.mission,
            createdAt: row.createdAt,
        },
    }
}

function toFeatureCollection(rows) {
    return { type: 'FeatureCollection', features: (rows || []).map(toFeature) }
}

module.exports = { toFeature, toFeatureCollection }
