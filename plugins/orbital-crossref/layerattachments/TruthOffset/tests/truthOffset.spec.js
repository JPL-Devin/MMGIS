/**
 * TruthOffset attachment — unit tests.
 *
 * NOTE: unlike the scaffold, these do NOT import `truthOffset.js`. Reaching the
 * ground-truth layer needs `L_` (`@basics/Layers_/Layers_`), and a module that
 * imports a singleton cannot be imported in Node at all — so the testable half
 * lives in `lib/crossref.js` and the module itself is E2E-only.
 */
import { test, expect } from '@playwright/test'
import { manifestOf } from '../../../../../tests/helpers/plugin-contract.js'
import { matchTruth, pairAll, distanceMeters, offsetColor } from '../../../lib/crossref.js'

const manifest = manifestOf(__dirname)

const at = (lng, lat, props = {}) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props,
})

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('truth_offset')
    expect(manifest.configPath).toBe('variables.layerAttachments.truthOffset')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('distance is metres on the great circle @unit', () => {
    // ~1112 m at the equator for 0.01 degrees of longitude.
    expect(Math.round(distanceMeters([0, 0], [0.01, 0]))).toBe(1112)
})

test('a prediction matches its ground truth by property, not proximity @unit', () => {
    const prediction = at(0, 0, { _crossrefTruthId: 'B' })
    const truths = [at(0.001, 0, { _crossrefTruthId: 'A' }), at(0.01, 0, { _crossrefTruthId: 'B' })]
    const match = matchTruth(prediction, truths, { matchProp: '_crossrefTruthId' })
    expect(match.feature.properties._crossrefTruthId).toBe('B')
    expect(Math.round(match.distance)).toBe(1112)
})

test('without a match property it falls back to nearest, bounded @unit', () => {
    const prediction = at(0, 0)
    const truths = [at(0.01, 0), at(0.001, 0)]
    expect(Math.round(matchTruth(prediction, truths, {}).distance)).toBe(111)
    expect(matchTruth(prediction, truths, { maxDistanceMeters: 10 })).toBe(null)
})

test('pairing skips predictions with no ground truth @unit', () => {
    const predictions = [at(0, 0, { _crossrefTruthId: 'A' }), at(1, 1, { _crossrefTruthId: 'Z' })]
    const truths = [at(0.001, 0, { _crossrefTruthId: 'A' })]
    const pairs = pairAll(predictions, truths, { matchProp: '_crossrefTruthId' })
    expect(pairs.length).toBe(1)
    expect(pairs[0].to).toEqual([0.001, 0])
})

test('the offset ramp is green at zero and red at the worst @unit', () => {
    expect(offsetColor(0, 1000)).toBe('rgb(46,160,60)')
    expect(offsetColor(2000, 1000)).toBe('rgb(215,25,60)')
})
