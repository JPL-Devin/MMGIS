/**
 * ThermalInertia layer type — extends `vector`.
 *
 * A single-module type: its keys are the *surfaces* it overrides, not renderer
 * operations. Drawing, picking, filtering and both globes are all inherited from
 * `vector` (one level, per surface) — this type differs only in its config
 * defaults, so it declares exactly one operation of one surface: `config.normalize`.
 *
 * The derived thermal-inertia value is NOT computed here. A thermal-inertia
 * layer is styled and explained by its two sibling plugins (the ThermalShade
 * attachment and the ThermalExplain interaction), which the manifest turns on
 * for every layer of this type via capabilities.defaultAttachments /
 * defaultInteractions, and hands the day/night property names to. So the type
 * owns the *facts* (property names, model constant) and the vector renderer it
 * inherits draws the base features unchanged.
 */

/**
 * `config.normalize` — this type's own config defaults, applied during mission
 * config parsing before core reads the layer.
 *
 * NOTE (a sharp edge, see the report): overriding an operation REPLACES the
 * parent's — merge is per-operation, so this does NOT run vector.normalize and
 * then add to it. Anything vector.normalize established that a thermal-inertia
 * layer still needs (`kind`, `radius`) has to be re-set here. There is no
 * super-call, and importing vector's own config module to delegate would pull
 * jQuery/`F_` in and make this file un-importable in a Node unit test.
 */
function normalize(layerObj) {
    // Reproduced from vector.normalize because overriding replaces it.
    layerObj.kind = layerObj.kind || 'none'
    layerObj.radius = layerObj.style?.radius || layerObj.radius || 6
    return layerObj
}

const ThermalInertia = {
    config: { normalize },
}

export default ThermalInertia
