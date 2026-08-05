/**
 * truth:open interaction — unit tests.
 *
 * `TruthOpen.js` imports `L_` (it must: only the singleton can reach another
 * layer), so the tests drive `logic.js` and the manifest instead.
 */
import { test, expect } from '@playwright/test'
import { decide, truthLayerNames } from '../logic.js'
import { manifestOf } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const at = (lng, lat, props = {}) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props,
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('truth:open')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents).toContain('click')
    expect(manifest.applicableLayerTypes).toContain('orbitalprediction')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('an event with no feature decides nothing @unit', () => {
    expect(decide(null, null, [])).toBe(null)
})

test('the clicked prediction resolves to its ground truth @unit', () => {
    const prediction = at(0, 0, { _crossrefTruthId: 'A' })
    const truths = [at(0.01, 0, { _crossrefTruthId: 'A', name: 'Crater' })]
    const result = decide(prediction, null, truths)
    expect(result.truth.properties.name).toBe('Crater')
    expect(result.distance).toBe(1112)
})

test('the offset the attachment already wrote wins @unit', () => {
    // The two plugins must not disagree in the UI, so the interaction prefers
    // the number the attachment stamped on the feature.
    const prediction = at(0, 0, { _crossrefTruthId: 'A', _crossrefOffsetMeters: 42 })
    const truths = [at(0.01, 0, { _crossrefTruthId: 'A' })]
    expect(decide(prediction, null, truths).distance).toBe(42)
})

test('truth layers are read from settings in either shape @unit', () => {
    expect(truthLayerNames(null)).toEqual([])
    expect(truthLayerNames({ truthLayers: ['A', 'B'] })).toEqual(['A', 'B'])
    expect(truthLayerNames({ truthLayers: 'A, B' })).toEqual(['A', 'B'])
})
