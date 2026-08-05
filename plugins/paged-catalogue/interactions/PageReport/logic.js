/**
 * PageReport's decision, with nothing imported from `src/essence` — the part
 * that is unit-testable in Node. The handler beside it (PageReport.js) is a thin
 * adapter that imports Toast and acts on this answer.
 *
 * The page each feature came from is stamped onto `properties._page` by the
 * PagedCatalogue layertype's `source.fetch`; here we just read it back.
 */
import { decidePage } from '../../lib/pageMath'

/**
 * @param {object|null} feature  the clicked GeoJSON feature, if any
 * @returns {{label: string, page: number}|null} null when there is nothing to report
 */
export function decide(feature) {
    return decidePage(feature)
}
