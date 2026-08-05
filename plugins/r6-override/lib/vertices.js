/**
 * Shared by this container's layer type and its interaction — the one fact both
 * need, in the one place neither owns. Imported relatively, per
 * plugins/README.md ("One feature, several plugins"). Nothing from src/essence
 * is imported here, so it is unit-testable in Node.
 */

/** The property name TrueVector stamps its vertex count onto. */
export const VERTEX_COUNT_PROP = 'trueVectorVertexCount'

/**
 * @param {object|null} feature GeoJSON feature.
 * @returns {number} number of positions in the feature's geometry, 0 if none.
 */
export function vertexCountOf(feature) {
    return countPositions(feature?.geometry?.coordinates)
}

function countPositions(coordinates) {
    if (!Array.isArray(coordinates)) return 0
    // A position is [x, y(, z)] — an array of numbers.
    if (typeof coordinates[0] === 'number') return 1
    let total = 0
    for (const part of coordinates) total += countPositions(part)
    return total
}
