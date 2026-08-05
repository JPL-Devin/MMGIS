/**
 * HazardZone layer type.
 *
 * It draws exactly like a vector, so it `extends` vector and ships no renderer.
 * What it owns is the meaning of a zone: severity drives the style and the
 * legend, and every hazardzone layer clicks through to hazard:report.
 *
 * Surfaces implemented: `config` (normalize) and `legend` (derive).
 */
import { colorForSeverity, SEVERITY_COLORS } from '../../lib/hazardGeometry'

const DEFAULT_SEVERITY_PROP = 'severity'

/**
 * Give the layer a severity-driven style before core reads it, unless the
 * mission already styled it. `prop-<name>` is core's "read this from the
 * feature" form, but the values are words rather than colours, so severity is
 * mapped to a colour per feature in `expand`-free fashion here instead: the
 * legend below carries `styleMatching`, which is what colours the features.
 */
function normalize(layerObj) {
    const vars = layerObj.variables || (layerObj.variables = {})
    const hz = vars.hazardZone || (vars.hazardZone = {})
    if (!hz.severityProperty) hz.severityProperty = DEFAULT_SEVERITY_PROP

    const fillOpacity = parseFloat(hz.fillOpacity)
    layerObj.style = {
        color: colorForSeverity(null),
        weight: 2,
        fillOpacity: Number.isFinite(fillOpacity) ? fillOpacity : 0.35,
        ...(layerObj.style || {}),
    }
    return layerObj
}

/**
 * A severity legend, which is also what colours the features: core's
 * `styleMatching` entries match a feature property to a legend colour.
 */
function derive(layerObj) {
    const prop =
        layerObj?.variables?.hazardZone?.severityProperty ||
        DEFAULT_SEVERITY_PROP

    layerObj._legend = Object.keys(SEVERITY_COLORS).map((severity) => ({
        color: SEVERITY_COLORS[severity],
        shape: 'square',
        value: severity,
        strokecolor: SEVERITY_COLORS[severity],
        styleMatching: { property: prop, value: severity },
    }))
    return true
}

export default {
    config: { normalize },
    legend: { derive },
}
