/**
 * SpectraPoints layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`. `fetch`, `normalize` and the synthesiser
 * are plain functions, so they are testable here; the render is `vector`'s.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import SpectraPoints, { spectraMeta, SPECTRA_DEFAULTS } from '../spectraPoints.js'
import { synthesizeCollection, reflectanceCurve, wavelengthGrid } from '../synthesize.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('spectrapoints')
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    // The click behaviour the type comes with — the only way a type can put an
    // interaction in a layer's pipeline without the mission naming it.
    expect(manifest.capabilities.defaultInteractions.click).toEqual([
        'spectra:select',
    ])
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(SpectraPoints)) expect(SURFACES).toContain(key)
})

test('normalize stamps the facts other plugins read off the layer @unit', () => {
    const layerObj = { name: 'S' }
    SpectraPoints.config.normalize(layerObj)
    expect(layerObj.variables.spectra).toEqual(SPECTRA_DEFAULTS)
})

test('a configured property survives normalize, a cleared one does not @unit', () => {
    expect(spectraMeta({ variables: { spectra: { spectrumProp: 'vswir' } } }).spectrumProp).toBe('vswir')
    expect(spectraMeta({ variables: { spectra: { spectrumProp: '' } } }).spectrumProp).toBe('spectrum')
    expect(spectraMeta({ variables: { spectra: { maxSelections: '' } } }).maxSelections).toBe(4)
})

test('fetch returns the features the service gave it @unit', async () => {
    const collection = { type: 'FeatureCollection', features: [] }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await SpectraPoints.source.fetch(
            { name: 'SpectraPoints' },
            { url: 'https://example.test/items', trigger: 'make' }
        )
        expect(result).toEqual(collection)
    } finally {
        window.fetch = original
    }
})

test('with no url, fetch synthesises spectra-carrying points @unit', async () => {
    const layerObj = { name: 'S', variables: { spectra: { count: 5 } } }
    const fc = await SpectraPoints.source.fetch(layerObj, { url: '', trigger: 'make' })
    expect(fc.features.length).toBe(5)
    const props = fc.features[0].properties
    expect(props.synthetic).toBe(true)
    expect(props.spectrum.wavelengths.length).toBe(props.spectrum.reflectance.length)
})

test('the synthesiser is deterministic per layer @unit', () => {
    const meta = SPECTRA_DEFAULTS
    const a = synthesizeCollection({ count: 3, seed: 'x', meta })
    const b = synthesizeCollection({ count: 3, seed: 'x', meta })
    const c = synthesizeCollection({ count: 3, seed: 'y', meta })
    expect(a).toEqual(b)
    expect(c).not.toEqual(a)
})

test('reflectance stays in a physical range and dips at the absorption bands @unit', () => {
    const grid = wavelengthGrid()
    const curve = reflectanceCurve(grid, {
        albedo: 0.3,
        band1: 1000,
        band1Depth: 0.15,
        band2: 2000,
        band2Depth: 0.1,
    })
    expect(curve.length).toBe(grid.length)
    curve.forEach((r) => {
        expect(r).toBeGreaterThanOrEqual(0.01)
        expect(r).toBeLessThanOrEqual(0.95)
    })
    const at = (w) => curve[grid.indexOf(w)]
    expect(at(1000)).toBeLessThan(at(700))
    expect(at(2000)).toBeLessThan(at(1600))
})
