/**
 * RoverTraverse layer type.
 *
 * It draws exactly like `vector` (everything is inherited through `extends`),
 * so the only surface it owns is `config`: at parse time it fills in the
 * waypoint-property names the sibling plugins read and, unless the mission
 * author opted out, turns on the waypoint-sol attachment so the type is useful
 * the moment it is chosen. The click behaviour (`traverse:step`) is wired
 * through `capabilities.defaultInteractions`, not here.
 *
 * Kept free of MMGIS singletons so it can be imported in a Node unit test.
 * See plugins/core/layertypes/README.md (the `config` surface).
 */

const DEFAULTS = {
    orderProp: 'sol',
    solProp: 'sol',
    siteProp: 'site',
    driveProp: 'drive',
}

/**
 * Fill traverse defaults and pre-wire the waypoint-sol attachment.
 * Pure: mutates and returns the passed layerObj (core uses the return value).
 */
function normalize(layerObj) {
    if (!layerObj || typeof layerObj !== 'object') return layerObj

    const variables = layerObj.variables || (layerObj.variables = {})

    // Shared config the attachment and the interaction both read.
    variables.traverse = { ...DEFAULTS, ...(variables.traverse || {}) }
    // orderProp falls back to the sol property when left blank.
    if (!variables.traverse.orderProp)
        variables.traverse.orderProp = variables.traverse.solProp

    // Turn the companion attachment on by default (the key's presence is the
    // request; an author can still set enabled:false to opt out).
    const attachments =
        variables.layerAttachments || (variables.layerAttachments = {})
    if (attachments.waypointSol == null)
        attachments.waypointSol = { enabled: true }

    return layerObj
}

const RoverTraverse = { normalize }
export default RoverTraverse
