/**
 * HazardHUD component — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 * `HazardHUD.js` imports CSS and `L_`, so it cannot be imported in Node; the
 * readout logic lives in `lib/hazard.js`, which imports nothing.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { readout, classify, normalizeSeverity } from '../../../lib/hazard.js'

const manifest = manifestOf(__dirname)

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('HazardHUD')
    expect(manifest.type).toBe('component')
    expect(manifest.paths['HazardHUD']).toBeDefined()
})

test('every declared path resolves to a file @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the readout with nothing selected @unit', () => {
    expect(readout({ zones: [], report: null })).toEqual({
        zones: '0 zones',
        status: 'no zone selected',
        severity: 'nominal',
    })
    expect(readout({ zones: ['a'], report: null }).zones).toBe('1 zone')
})

test('the readout after an interaction reports a hazard @unit', () => {
    const report = classify(
        { properties: { name: 'Scarp', severity: 'hazard' } },
        null
    )
    expect(readout({ zones: ['a', 'b'], report })).toEqual({
        zones: '2 zones',
        status: 'Scarp — HAZARD',
        severity: 'hazard',
    })
})

test('severity is normalized from strings, numbers and nonsense @unit', () => {
    expect(normalizeSeverity('Caution')).toBe('caution')
    expect(normalizeSeverity(2)).toBe('hazard')
    expect(normalizeSeverity('purple')).toBe('nominal')
    expect(normalizeSeverity(undefined)).toBe('nominal')
})
