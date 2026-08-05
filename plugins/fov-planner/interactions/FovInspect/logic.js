/**
 * FovInspect's decisions, with nothing imported from `src/essence`.
 *
 * The handler beside this file is a thin adapter; this is what the unit test
 * covers.
 */
import { summarize } from '../../lib/fov'

/**
 * @param {object|null} feature   the clicked observation
 * @param {object[]}    siblings  the layer's other features, if core gave us any
 * @param {object|null} config    this interaction's settings on the layer
 * @returns {object|null} the coverage report, or null when there is nothing to say
 */
export function decide(feature, siblings, config) {
    if (feature == null) return null
    const report = summarize(feature, siblings || [], config || {})
    return report.azimuth === null ? null : report
}

/** The event name the FovCoverageBar component listens for. */
export const REPORT_EVENT = 'fov-planner:report'
