/**
 * SpectraPoints layer type — extends `vector`.
 *
 * Instrument observation points that each carry a spectrum (a wavelength array
 * and a reflectance array of the same length) in one feature property.
 *
 * The only surface declared here is `source.fetch`: the observations, either from
 * a GeoJSON service (`url`) whose features already carry a spectrum or, with no
 * url, synthesised (see ./synthesize.js). It also stamps `variables.spectra` —
 * the self-describing metadata the interaction and the tool read back off the
 * layer (which property holds the spectrum, its units, how many to compare).
 *
 * That stamping wants to be `config.normalize`, but module inheritance is
 * per-surface and shallow (`LayerTypeRegistry._effectiveModules`), so declaring a
 * `config` surface here would replace Vector's whole one and silently lose its
 * `expand` (STAC) and `normalize`. Doing it in `fetch` is the only place an
 * extending type can add one config fact without taking the surface over.
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
    // Keep anything else configured here (bbox, count) so stamping is lossless.
    const meta = { ...configured, ...SPECTRA_DEFAULTS }
    Object.keys(SPECTRA_DEFAULTS).forEach((k) => {
        // A cleared Configure field arrives as '', not undefined.
        if (configured[k] !== undefined && configured[k] !== '')
            meta[k] = configured[k]
    })
    meta.maxSelections = parseInt(meta.maxSelections, 10) || 4
    return meta
}

/**
 * Resolves the type's facts and writes them back onto the layer, so every
 * consumer reads the same resolved values off `layerData.variables.spectra`
 * rather than re-deriving them.
 */
export function stampMeta(layerObj) {
    if (layerObj.variables == null) layerObj.variables = {}
    const meta = spectraMeta(layerObj)
    layerObj.variables.spectra = meta
    return meta
}

async function fetch(layerObj, ctx) {
    const meta = stampMeta(layerObj)

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
    source: { fetch },
}

export default SpectraPoints
