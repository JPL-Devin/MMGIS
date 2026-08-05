/**
 * GeologicUnits layer type — extends `vector`.
 *
 * A single-module type whose only overridden surface is `legend`: it inherits
 * all of vector's drawing, picking, filtering and both globes. What it adds is
 * a legend derived from the *data* — the distinct unit codes in the layer's
 * features — plus, in plugin.json, the `capabilities.defaultAttachments` and
 * `capabilities.defaultInteractions` that ship the contact-ticks attachment and
 * the contact-units interaction with every layer of this type.
 *
 * See plugins/core/layertypes/README.md, `legend` surface.
 */
import { buildUnitLegend } from './lib/unitLegend'

// `L_` is a global the app sets (`window.L_ = L_`). Read it per call rather than
// importing `@basics/Layers_/Layers_`, so this module stays importable in a Node
// unit test — the testable logic lives in lib/unitLegend.js regardless.
const layers = () => (typeof window !== 'undefined' ? window.L_ : undefined)

/**
 * Pull GeoJSON features off whatever the map is currently holding for a layer.
 * The live layer is a Leaflet `geoJson` (or a group of them); `toGeoJSON()` is
 * the uniform way to read features back out.
 */
function liveFeatures(layerName) {
    const held = layers()?.layers?.layer?.[layerName]
    if (!held) return []
    const list = Array.isArray(held) ? held : [held]
    const out = []
    for (const l of list) {
        if (typeof l?.toGeoJSON !== 'function') continue
        const gj = l.toGeoJSON()
        if (gj?.type === 'FeatureCollection') out.push(...(gj.features || []))
        else if (gj?.type === 'Feature') out.push(gj)
    }
    return out
}

/**
 * `derive` is handed the layer's config, not its data — so read the rendered
 * features off the live layer, build the categorical unit legend, and stash it
 * on `layerObj._legend` for the LayersTool/LegendTool to draw. Return false when
 * there is nothing to derive (no features yet, or none carry a unit code).
 */
function derive(layerObj) {
    const unitProp = layerObj?.variables?.geology?.unitProp || 'unit'
    const legend = buildUnitLegend(liveFeatures(layerObj?.name), { unitProp })
    if (!legend.length) return false
    layerObj._legend = legend
    return true
}

const GeologicUnits = {
    legend: { derive },
}

export default GeologicUnits
