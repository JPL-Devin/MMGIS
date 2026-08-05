/**
 * HazardZone layer type — extends `vector`.
 *
 * Hazard polygons (slope, rock abundance, crater rims) whose features carry a
 * severity and a hazard class. Drawing, picking, filtering and both globes are
 * inherited from `vector`; this module declares only the surfaces that differ.
 *
 * The property names the severity and class live under are this type's fact.
 * They reach the buffer attachment through the manifest's
 * `capabilities.defaultAttachments` (never by writing into the attachment's own
 * config subtree) and the interaction through `defaultInteractions`.
 */
import { propsOf } from '../../lib/hazardGeometry'

/**
 * `config.normalize` — the layer's config object is this type's to fix up
 * before core reads it. Hazard severity is what a hazard layer should colour by,
 * so if the mission did not configure a style, name the severity property with
 * the `prop-` convention the inherited vector renderer understands.
 */
function normalize(layerObj) {
    const { severityProp } = propsOf(layerObj?.variables?.hazard)

    layerObj.style = layerObj.style || {}
    if (layerObj.style.fillColor == null)
        layerObj.style.fillColor = `prop-${severityProp}`

    return layerObj
}

/**
 * `legend.derive` — a hazard layer's legend is its severity ramp, which comes
 * from the render rather than from anything an admin configured.
 */
function derive(layerObj) {
    layerObj._legend = [
        {
            shape: 'continuous',
            color: '#ffffb2',
            value: 'low severity',
            styleMatching: true,
            propertyName: propsOf(layerObj?.variables?.hazard).severityProp,
            propertyValue: 0,
        },
        {
            shape: 'continuous',
            color: '#bd0026',
            value: 'high severity',
            styleMatching: true,
            propertyName: propsOf(layerObj?.variables?.hazard).severityProp,
            propertyValue: 1,
        },
    ]
    return true
}

const HazardZone = {
    config: { normalize },
    legend: { derive },
}

export default HazardZone
