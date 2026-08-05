/**
 * Pure helpers for the paged-catalogue feature — no `src/essence` imports, so
 * these are the part that is unit-testable in Node. Both the layertype's
 * `source.fetch` and the `page:report` interaction call in here.
 */

export const DEFAULTS = {
    pageSize: 500,
    maxPages: 8,
}

/**
 * Build the URL for one page of a viewport-bound catalogue request.
 *
 * @param {string} base   the layer's configured service url (ctx.url)
 * @param {object|null} view  ctx.view — {minx,miny,maxx,maxy,...} or null
 * @param {number} page   zero-based page index
 * @param {number} limit  page size
 * @returns {string}
 */
export function buildPageUrl(base, view, page, limit) {
    const url = new URL(base)
    url.searchParams.set('page', String(page))
    url.searchParams.set('limit', String(limit))
    if (view)
        url.searchParams.set(
            'bbox',
            [view.minx, view.miny, view.maxx, view.maxy].join(',')
        )
    return url.toString()
}

/**
 * Stamp every feature in a page with the page it came from, so a later click
 * can report it. Mutates and returns the same array.
 *
 * @param {Array} features
 * @param {number} page
 * @returns {Array}
 */
export function tagPage(features, page) {
    if (!Array.isArray(features)) return []
    for (const f of features) {
        if (f && typeof f === 'object') {
            f.properties = f.properties || {}
            f.properties._page = page
        }
    }
    return features
}

/** True when the server says there is another page after this one. */
export function hasNextPage(fc, limit) {
    if (!fc) return false
    if (typeof fc.next === 'boolean') return fc.next
    return Array.isArray(fc.features) && fc.features.length >= limit
}

/**
 * What the `page:report` interaction says about a clicked feature.
 *
 * @param {object|null} feature
 * @returns {{label: string, page: number}|null} null when there is nothing to say.
 */
export function decidePage(feature) {
    if (feature == null) return null
    const page = feature.properties?._page
    if (page == null) return null
    return { page: Number(page), label: `From page ${page}` }
}
