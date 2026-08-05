/**
 * SpectraSelect's decisions, with nothing imported from `src/essence` so this is
 * unit-testable in Node.
 */

export const FALLBACK_META = {
    spectrumProp: 'spectrum',
    wavelengthKey: 'wavelengths',
    reflectanceKey: 'reflectance',
    wavelengthUnits: 'nm',
    maxSelections: 4,
}

/**
 * Which property holds what is a fact the SpectraPoints layer type knows. It
 * reaches us through the layer's own config (`variables.spectra`, which the type's
 * `config.normalize` stamps), because `capabilities.defaultInteractions` can only
 * name interaction ids — it carries no settings the way
 * `capabilities.defaultAttachments` does.
 *
 * @param {object|null} layerVar `layerData.variables`
 * @param {object|null} config this interaction's own settings, if any
 * @returns {object} resolved metadata
 */
export function resolveMeta(layerVar, config) {
    const meta = { ...FALLBACK_META, ...(layerVar?.spectra || {}) }
    // The interaction's own settings win, for a layer whose type isn't ours.
    Object.entries(config || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== '') meta[k] = v
    })
    meta.maxSelections = parseInt(meta.maxSelections, 10) || 4
    return meta
}

/**
 * @param {object|null} feature clicked GeoJSON feature
 * @param {string} layerName
 * @param {object} meta resolved metadata
 * @returns {{id:string,label:string,layerName:string,wavelengths:number[],reflectance:number[],units:string}|null}
 */
export function extractSelection(feature, layerName, meta) {
    if (feature == null) return null
    const props = feature.properties || {}
    const spectrum = props[meta.spectrumProp]
    if (spectrum == null) return null
    const wavelengths = spectrum[meta.wavelengthKey]
    const reflectance = spectrum[meta.reflectanceKey]
    if (!Array.isArray(wavelengths) || !Array.isArray(reflectance)) return null
    if (wavelengths.length === 0 || wavelengths.length !== reflectance.length)
        return null

    const label = props.name != null ? String(props.name) : 'unnamed'
    return {
        id: `${layerName}::${label}`,
        label,
        layerName,
        wavelengths: wavelengths.map(Number),
        reflectance: reflectance.map(Number),
        units: spectrum.units || meta.wavelengthUnits,
    }
}

/**
 * Clicking the same point again removes it; otherwise it is appended and the
 * oldest dropped past `max`.
 * @param {Array} selections
 * @param {object} selection
 * @param {number} max
 * @returns {Array} a new array
 */
export function nextSelections(selections, selection, max) {
    const existing = (selections || []).filter((s) => s.id !== selection.id)
    if (existing.length !== (selections || []).length) return existing
    const out = [...existing, selection]
    return out.slice(Math.max(0, out.length - max))
}
