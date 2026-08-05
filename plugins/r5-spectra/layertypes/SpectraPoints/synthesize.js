/**
 * Synthetic spectra — imports nothing from src/, so it is unit-testable.
 *
 * The data is INVENTED, not fetched: reflectance is a smooth continuum with two
 * Gaussian absorption bands whose depth and centre vary per point, over
 * 400–2500 nm at 50 nm steps. It is shaped like a VSWIR point spectrum
 * (e.g. EMIT/CRISM style) but it is not real measurement data.
 */

/** Deterministic 32-bit hash → [0, 1) generator, so a layer looks the same twice. */
export function seededRandom(seed) {
    let h = 2166136261
    const s = String(seed)
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i)
        h = Math.imul(h, 16777619)
    }
    return function next() {
        h ^= h << 13
        h ^= h >>> 17
        h ^= h << 5
        return ((h >>> 0) % 1000000) / 1000000
    }
}

export function wavelengthGrid(start = 400, end = 2500, step = 50) {
    const out = []
    for (let w = start; w <= end; w += step) out.push(w)
    return out
}

/**
 * @param {number[]} wavelengths
 * @param {{band1:number, band1Depth:number, band2:number, band2Depth:number, albedo:number}} p
 * @returns {number[]} reflectance, 0–1
 */
export function reflectanceCurve(wavelengths, p) {
    const gauss = (w, center, depth, width) =>
        depth * Math.exp(-Math.pow(w - center, 2) / (2 * width * width))
    return wavelengths.map((w) => {
        const continuum = p.albedo + 0.00008 * (w - 400)
        const r =
            continuum -
            gauss(w, p.band1, p.band1Depth, 90) -
            gauss(w, p.band2, p.band2Depth, 140)
        return Math.round(Math.max(0.01, Math.min(0.95, r)) * 10000) / 10000
    })
}

/**
 * @param {object} opts
 * @param {number[]} [opts.bbox] [minx, miny, maxx, maxy]
 * @param {number} [opts.count]
 * @param {string} [opts.seed]
 * @param {object} opts.meta resolved `variables.spectra`
 * @returns {object} GeoJSON FeatureCollection
 */
export function synthesizeCollection({
    bbox,
    count = 24,
    seed = 'spectrapoints',
    meta,
}) {
    const [minx, miny, maxx, maxy] =
        Array.isArray(bbox) && bbox.length === 4
            ? bbox.map(Number)
            : [-0.4, -0.4, 0.4, 0.4]
    const rand = seededRandom(seed)
    const wavelengths = wavelengthGrid()
    const features = []
    for (let i = 0; i < count; i++) {
        const lng = minx + rand() * (maxx - minx)
        const lat = miny + rand() * (maxy - miny)
        const band1 = 900 + rand() * 200
        const band2 = 1900 + rand() * 300
        const band1Depth = 0.03 + rand() * 0.14
        const spectrum = {
            [meta.wavelengthKey]: wavelengths,
            [meta.reflectanceKey]: reflectanceCurve(wavelengths, {
                albedo: 0.18 + rand() * 0.25,
                band1,
                band1Depth,
                band2,
                band2Depth: 0.02 + rand() * 0.1,
            }),
            units: meta.wavelengthUnits,
        }
        features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: {
                name: `OBS-${String(i + 1).padStart(3, '0')}`,
                band_depth_1um: Math.round(band1Depth * 1000) / 1000,
                synthetic: true,
                [meta.spectrumProp]: spectrum,
            },
        })
    }
    return { type: 'FeatureCollection', features }
}
