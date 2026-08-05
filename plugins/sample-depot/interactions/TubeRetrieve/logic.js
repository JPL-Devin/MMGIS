/**
 * TubeRetrieve's decisions, with nothing imported from `src/essence`.
 *
 * The property names come from the container's shared lib rather than being
 * retyped here — that module is the seam between this interaction and the
 * SampleTubes layer type that produced the features.
 */
import { ID_PROP, RETRIEVED_PROP } from '../../lib/depotApi'

/**
 * What a click should do.
 *
 * @param {object|null} feature The clicked GeoJSON feature, if there was one.
 * @param {object|null} config This interaction's settings on the layer.
 * @param {{lat: number, lng: number}|null} latlng Where the click landed.
 * @param {object} layerVar The layer's `variables` (for the depot name).
 * @returns {{action: 'retrieve', id: number}|{action: 'add', tube: object}|null}
 */
export function decide(feature, config, latlng, layerVar) {
    // `config` is null until an admin fills the form in, and partial after, so
    // defaults belong here rather than in the manifest.
    const { allowAdd = false, sampleType = 'regolith' } = config || {}

    if (feature != null) {
        const props = feature.properties || {}
        const id = props[ID_PROP]
        if (id == null) return null
        // Already retrieved: nothing to write, so don't.
        if (props[RETRIEVED_PROP] === true) return null
        return { action: 'retrieve', id }
    }

    // No feature: an empty-map click drops a new tube, if the admin allowed it.
    if (!allowAdd || latlng == null) return null
    const depot = (layerVar || {}).depot
    if (!depot) return null
    return {
        action: 'add',
        tube: {
            depot_name: depot,
            sample_type: sampleType,
            lng: latlng.lng,
            lat: latlng.lat,
        },
    }
}
