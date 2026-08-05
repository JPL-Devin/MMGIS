/**
 * Shared, dependency-free join between a predicted and an observed dust-opacity
 * dataset. Imported relatively by both plugins in this container (the layer type
 * that acquires the two datasets, and the attachment that visualises the
 * difference), so the semantics of "delta" live in exactly one place.
 *
 * Keep free of `src/essence` imports — that is what makes it unit testable.
 */

const num = (v) => (Number.isFinite(parseFloat(v)) ? parseFloat(v) : null)

const featuresOf = (geojson) =>
    Array.isArray(geojson) ? geojson : geojson?.features || []

/**
 * Index a feature collection by a join property.
 * @returns {Map<string, Object>} last feature wins for a duplicate key
 */
export function indexBy(geojson, joinProp) {
    const index = new Map()
    for (const feature of featuresOf(geojson)) {
        const key = feature?.properties?.[joinProp]
        if (key === undefined || key === null || key === '') continue
        index.set(String(key), feature)
    }
    return index
}

/**
 * Join observed values onto the predicted features.
 *
 * The result is one normal FeatureCollection — predicted geometry carrying both
 * values and their difference — which is what makes this a single layer with a
 * single lifecycle rather than one plugin reading another layer's render.
 *
 * @param {Object} predicted FeatureCollection of predicted values
 * @param {Object} observed  FeatureCollection of observed values
 * @param {Object} opts
 * @param {string} opts.joinProp      property present in both, identifying a site
 * @param {string} opts.predictedProp numeric property on the predicted features
 * @param {string} opts.observedProp  numeric property on the observed features
 * @param {boolean} [opts.keepUnmatched] keep predicted features with no observation
 * @returns {Object} FeatureCollection
 */
export function joinOpacity(predicted, observed, opts) {
    const {
        joinProp = 'site_id',
        predictedProp = 'opacity',
        observedProp = 'opacity',
        keepUnmatched = true,
    } = opts || {}

    const observedIndex = indexBy(observed, joinProp)
    const features = []

    for (const feature of featuresOf(predicted)) {
        const key = feature?.properties?.[joinProp]
        const match = key == null ? undefined : observedIndex.get(String(key))
        if (!match && !keepUnmatched) continue

        const predictedValue = num(feature?.properties?.[predictedProp])
        const observedValue = match ? num(match.properties?.[observedProp]) : null
        const delta =
            predictedValue !== null && observedValue !== null
                ? observedValue - predictedValue
                : null

        features.push({
            ...feature,
            properties: {
                ...feature.properties,
                dust_predicted: predictedValue,
                dust_observed: observedValue,
                dust_delta: delta,
                dust_abs_delta: delta === null ? null : Math.abs(delta),
                dust_pct_error:
                    delta !== null && predictedValue
                        ? (delta / predictedValue) * 100
                        : null,
                dust_matched: Boolean(match),
            },
        })
    }

    return { type: 'FeatureCollection', features }
}

/**
 * The symmetric range of the deltas in a joined collection, for a diverging
 * colour scale. `[0, 0]` when there is nothing to scale.
 */
export function deltaRange(geojson) {
    let max = 0
    for (const feature of featuresOf(geojson)) {
        const value = num(feature?.properties?.dust_delta)
        if (value !== null) max = Math.max(max, Math.abs(value))
    }
    return [-max, max]
}

const dustJoin = { indexBy, joinOpacity, deltaRange }

export default dustJoin
