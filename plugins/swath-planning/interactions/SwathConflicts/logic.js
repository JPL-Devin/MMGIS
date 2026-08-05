/**
 * SwathConflicts's decisions — nothing from `src/essence`, so it is testable.
 */
import { conflictsWith } from '../../lib/swathGeometry'

/**
 * @param {object|null} feature the clicked swath
 * @param {object[]} others the swaths currently in view (the layer's features)
 * @param {object|null} config this interaction's settings on the layer
 * @returns {{id: string, count: number, worst: object|null, conflicts: object[], message: string}|null}
 */
export function report(feature, others, config) {
    if (feature == null) return null
    const { idProp = 'swath_id', rollProp = 'roll_deg', maxListed = 5 } = config || {}
    const conflicts = conflictsWith(feature, others || [], { idProp, rollProp })
    const id = feature.properties?.[idProp] ?? 'this swath'
    const listed = conflicts.slice(0, maxListed)
    return {
        id: String(id),
        count: conflicts.length,
        worst: conflicts[0] || null,
        conflicts: listed,
        message: conflicts.length
            ? `${id}: ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} in view — ` +
              listed
                  .map(
                      (c) =>
                          `${c.id} (${c.overlapDeg2.toFixed(3)} deg², roll ${c.rollDeg ?? '?'}°)`
                  )
                  .join(', ')
            : `${id}: no conflicts in the current view`,
    }
}
