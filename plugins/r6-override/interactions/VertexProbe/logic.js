/**
 * VertexProbe's decisions, with nothing imported from `src/essence`.
 *
 * The handler beside this file imports `L_`, which makes it un-importable in a
 * Node unit test — so the decisions live here and `tests/` covers them.
 */

import { vertexCountOf, VERTEX_COUNT_PROP } from '../../lib/vertices'

/**
 * @param {object|null} feature The clicked GeoJSON feature, if there was one.
 * @param {object|null} config  This interaction's settings on the layer. Comes
 *   from an admin, or from TrueVector's
 *   `capabilities.defaultInteractions.click['vertex:probe']` — this code cannot
 *   and need not tell which.
 * @returns {{label: string, vertices: number, counted: boolean}|null}
 *   null when there is nothing to report.
 */
export function decide(feature, config) {
    if (feature == null) return null
    const { property = 'name', vertexCountProp = VERTEX_COUNT_PROP } =
        config || {}

    const label = feature.properties?.[property]
    if (label == null) return null

    // TrueVector stamps the count at make time; any other host type has not, so
    // fall back to walking the geometry rather than reporting a wrong 0.
    const stamped = feature.properties?.[vertexCountProp]
    const counted = typeof stamped === 'number'

    return {
        label: String(label),
        vertices: counted ? stamped : vertexCountOf(feature),
        counted,
    }
}
