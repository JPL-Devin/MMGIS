/**
 * FieldObsAdd's decisions, with nothing imported from `src/essence`.
 */

export const DEFAULT_ENDPOINT = '/api/fieldObs/observations'

/**
 * Path → request url, behind ROOT_PATH.
 *
 * This duplicates what a layer type's `source` surface gets for free as
 * `ctx.resolveUrl`. There is no equivalent on an interaction's `ctx`, and
 * `LayerCapturer._resolveSourceUrl` is module-private, so the only documented
 * option is the hand-roll in plugins/core/backend/README.md:222-234.
 *
 * @param {string} endpoint  Root-relative path, or an absolute url.
 * @param {string} rootPath  `window.mmgisglobal.ROOT_PATH`.
 */
export function resolveApiUrl(endpoint, rootPath) {
    const path =
        typeof endpoint === 'string' && endpoint.trim()
            ? endpoint.trim()
            : DEFAULT_ENDPOINT
    if (/^(https?:)?\/\//.test(path)) return path
    const root = (rootPath || '').replace(/\/$/, '')
    return `${root}${path.startsWith('/') ? '' : '/'}${path}`
}

/**
 * What to POST for a click, or null when there is nothing to write.
 *
 * @param {object} ctxLike  `{ feature, event, config }` — the parts of `ctx` a
 *                          Node test can build.
 */
export function observationFor({ feature, event, config } = {}) {
    const latlng = event?.latlng
    if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng))
        return null

    const { noteProperty = 'name', notePrefix = 'Observed' } = config || {}
    const from = feature?.properties?.[noteProperty]
    return {
        note: from == null ? notePrefix : `${notePrefix}: ${from}`,
        lat: latlng.lat,
        lng: latlng.lng,
        payload: feature?.properties ? { source: feature.properties } : null,
    }
}
