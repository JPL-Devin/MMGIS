/**
 * The stratigraphy container's one shared fact: how a unit-colour table typed
 * into a layer's settings becomes units a renderer can stack.
 *
 * Imported relatively by the layer type, both attachments and the interaction's
 * logic, and free of `src/essence` imports so it is unit testable.
 *
 * One line per unit, top of the column first:
 *
 *     Shale,#7a6a53,12.5
 *     Sandstone, #d8c27a , 4
 *     # a comment, and blank lines, are ignored
 */

const num = (v, fallback) =>
    Number.isFinite(parseFloat(v)) ? parseFloat(v) : fallback

/**
 * @param {string} text The raw textarea value.
 * @returns {{name: string, color: string, thickness: number}[]} Top unit first.
 */
export function parseUnitTable(text) {
    if (typeof text !== 'string') return []
    return text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith('#'))
        .map((line) => line.split(',').map((cell) => cell.trim()))
        .filter((cells) => cells[0])
        .map((cells) => ({
            name: cells[0],
            color: cells[1] || '#888888',
            thickness: num(cells[2], 1),
        }))
}

/**
 * Cumulative depth of the top and base of each unit, so a bar and its labels
 * agree on where a unit sits without either computing it twice.
 *
 * @param {{thickness: number}[]} units
 * @returns {{name: string, color: string, thickness: number, top: number, base: number}[]}
 */
export function stackUnits(units) {
    let depth = 0
    return (units || []).map((unit) => {
        const top = depth
        depth += num(unit.thickness, 1)
        return { ...unit, top, base: depth }
    })
}

/** Total thickness of a parsed table. */
export function totalThickness(units) {
    return stackUnits(units).reduce((max, u) => Math.max(max, u.base), 0)
}

/**
 * Where the layer type's admin-typed unit table lives on a host layer.
 *
 * This exists because the declarative seams (`defaultAttachments`,
 * `defaultInteractions`) carry only what a *manifest author* knows, and the unit
 * table is something an *admin* types. See the container's README.
 */
export const UNIT_TABLE_PATH = ['stratColumn', 'unitTable']

/**
 * @param {object} layerObj A host layer's config, as handed to an attachment.
 * @returns {{name, color, thickness, top, base}[]}
 */
export function unitsOfLayer(layerObj) {
    let node = layerObj?.variables
    for (const key of UNIT_TABLE_PATH) node = node?.[key]
    return stackUnits(parseUnitTable(node))
}
