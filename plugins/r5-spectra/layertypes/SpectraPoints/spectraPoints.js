/**
 * SpectraPoints layer type — extends `vector`.
 *
 * Instrument observation points that each carry a spectrum (a wavelength array
 * and a reflectance array of the same length) in one feature property.
 *
 * Surfaces declared here:
 *   config.normalize — stamps `variables.spectra` (the self-describing metadata
 *                      other plugins in this feature read: which property holds
 *                      the spectrum, its units, how many points to keep)
 *   source.fetch     — the observations. Either a GeoJSON service (`url`) whose
 *                      features already carry a spectrum, or, with no url,
 *                      synthesised points (see ./synthesize.js).
 *
 * Drawing, picking, filtering and both globes are inherited from `vector`.
 */
import { synthesizeCollection } from './synthesize'

export const SPECTRA_DEFAULTS = {
    spectrumProp: 'spectrum',
    wavelengthKey: 'wavelengths',
    reflectanceKey: 'reflectance',
    wavelengthUnits: 'nm',
    maxSelections: 4,
}

/**
 * The type's own facts, resolved from the layer's config with defaults.
 * @param {object} layerObj
 * @returns {object}
 */
export function spectraMeta(layerObj) {
    const configured = layerObj?.variables?.spectra || {}
    const meta = { ...SPECTRA_DEFAULTS }
    Object.keys(SPECTRA_DEFAULTS).forEach((k) => {
        // A cleared Configure field arrives as '', not undefined.
        if (configured[k] !== undefined && configured[k] !== '')
            meta[k] = configured[k]
    })
    meta.maxSelections = parseInt(meta.maxSelections, 10) || 4
    return meta
}

function normalize(layerObj) {
    if (layerObj.variables == null) layerObj.variables = {}
    // Written back onto the layer so that any consumer — the interaction, the
    // tool, an attachment — can read the same resolved facts off layerData
    // instead of re-deriving them.
    layerObj.variables.spectra = spectraMeta(layerObj)
    return layerObj
}

async function fetch(layerObj, ctx) {
    const meta = spectraMeta(layerObj)

    if (ctx.url) {
        const res = await window.fetch(ctx.url, {
            headers: { Accept: 'application/geo+json' },
        })
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
    }

    // No service configured: synthesised observations, so the type is usable
    // (and demonstrable) without standing a spectral service up.
    return synthesizeCollection({
        bbox: layerObj.variables?.spectra?.bbox,
        count: parseInt(layerObj.variables?.spectra?.count, 10) || 24,
        seed: layerObj.name || 'spectrapoints',
        meta,
    })
}

const SpectraPoints = {
    config: { normalize },
    source: { fetch },
}

export default SpectraPoints
