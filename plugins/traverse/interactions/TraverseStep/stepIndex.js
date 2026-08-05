/**
 * The pure part of TraverseStep, kept in its own file so a Node unit test can
 * import it without pulling in `L_` (which needs the browser). See the Testing
 * section of plugins/core/interactions/README.md.
 */

/**
 * The index of the waypoint to move to.
 * @param {number} length  number of waypoints
 * @param {number} current index of the anchor (-1 if none)
 * @param {number} step     +1 (next) or -1 (previous)
 * @param {boolean} wrap    wrap around the ends, else clamp
 * @returns {number} target index, or -1 when there is nowhere to go
 */
export function stepIndex(length, current, step, wrap) {
    if (length <= 0) return -1
    if (current < 0) return step > 0 ? 0 : length - 1
    const next = current + step
    if (next < 0) return wrap ? length - 1 : 0
    if (next >= length) return wrap ? 0 : length - 1
    return next
}
