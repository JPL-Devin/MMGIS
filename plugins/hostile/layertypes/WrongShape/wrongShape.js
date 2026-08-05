async function fetch() {
    // Not a FeatureCollection, not an array, not null.
    return { rows: [{ lat: 1, lon: 2 }], note: 'definitely not geojson' }
}

const WrongShape = { source: { fetch } }

export default WrongShape
