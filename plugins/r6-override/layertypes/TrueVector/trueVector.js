/**
 * TrueVector — this container's replacement for the built-in `vector` type.
 *
 * The intent was to *supersede* `vector`: same behaviour, our implementation.
 * That is not expressible (see README-FINDINGS.md in this container), so the
 * type claims its own `typeId` and inherits `vector` instead, overriding only
 * the operations it means to do differently:
 *
 *   map.make — core's build, plus an `after` phase that stamps each feature
 *              with its vertex count so a sibling plugin can read it without
 *              walking the geometry again
 *
 * Everything else (source, picking, filtering, both globes) is vector's.
 */

import { vertexCountOf, VERTEX_COUNT_PROP } from '../../lib/vertices'

/**
 * Count the vertices of every feature once, at make time, and leave the answer
 * on the feature's own properties — the seam the `vertex:probe` interaction
 * reads (`ctx.feature.properties[vertexCountProp]`). The property *name* is a
 * fact this type owns; it reaches the interaction through the manifest's
 * `capabilities.defaultInteractions.click['vertex:probe'].vertexCountProp`,
 * not through either plugin reading the other's config.
 */
function stampVertexCounts(layerObj) {
    const features = layerObj?.geojson?.features
    if (!Array.isArray(features)) return
    for (const feature of features) {
        if (feature == null) continue
        feature.properties = feature.properties || {}
        feature.properties[VERTEX_COUNT_PROP] = vertexCountOf(feature)
    }
}

const TrueVector = {
    map: {
        // `after` wraps core's default rather than replacing it: vector's own
        // make still builds and registers the layer.
        make: {
            after(layerObj) {
                stampVertexCounts(layerObj)
            },
        },
    },
}

export default TrueVector
