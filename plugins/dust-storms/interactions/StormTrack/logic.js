/**
 * StormTrack's decisions, with nothing imported from `src/essence`, so they can
 * be unit tested in Node.
 */
import { DEFAULT_PROPS, stepInTime } from '../../lib/storms'

/**
 * Where to go next when a storm extent is clicked.
 *
 * @param {object|null} feature   The clicked GeoJSON feature.
 * @param {object|null} config    This interaction's settings on the layer:
 *   `{ direction: 'forward'|'backward' }`.
 * @param {object|null} left      What the layer type left on the layer object
 *   (`layerObj._dustStorms`): `{ all, props }`. There is no way to ask another
 *   plugin, so the type leaves the storm archive and its property names behind.
 * @returns {{feature: object, props: object, direction: string}|null} null when
 *   there is nothing to follow — no feature, no archive, or an end of the track.
 */
export function nextExtent(feature, config, left) {
    if (feature == null) return null
    const all = left?.all
    if (!Array.isArray(all) || all.length === 0) return null

    const props = { ...DEFAULT_PROPS, ...(left?.props || {}) }
    // `config` is null until an admin fills the form in, so default here.
    const direction = config?.direction === 'backward' ? 'backward' : 'forward'
    const next = stepInTime(all, feature, direction === 'backward' ? -1 : 1, props)
    if (next == null) return null
    return { feature: next, props, direction }
}
