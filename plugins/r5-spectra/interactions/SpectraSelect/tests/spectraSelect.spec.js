/**
 * SpectraSelect interaction — unit tests.
 *
 * These import `logic.js`, not `SpectraSelect.js`: the handler imports
 * `ToolController_`, which cannot be imported in Node, so the decisions live in a
 * module that imports nothing. Clicking a real feature is an E2E test.
 */
import { test, expect } from '@playwright/test'
import {
    resolveMeta,
    extractSelection,
    nextSelections,
    FALLBACK_META,
} from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const spectrum = (key = 'spectrum') => ({
    properties: {
        name: 'OBS-001',
        [key]: { wavelengths: [400, 500], reflectance: [0.2, 0.3], units: 'nm' },
    },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('spectra:select')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(manifest.applicableLayerTypes).toContain('spectrapoints')
    // The tool the handler calls; without this the interaction is silently left
    // out of the generated registry.
    expect(manifest.pluginDependencies).toContain('r5-spectra/tools/Spectra')
    // Every config field must sit inside configPath or it is written where the
    // runner never reads it.
    manifest.config.rows.forEach((row) =>
        (row.components || []).forEach((c) =>
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
        )
    )
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the layer type\'s facts reach the interaction through layer variables @unit', () => {
    const meta = resolveMeta({ spectra: { spectrumProp: 'refl', maxSelections: 2 } }, null)
    expect(meta.spectrumProp).toBe('refl')
    expect(meta.maxSelections).toBe(2)
    // Unset ones still fall back.
    expect(meta.wavelengthKey).toBe(FALLBACK_META.wavelengthKey)
})

test('the interaction\'s own settings override the layer type, and blanks do not @unit', () => {
    const layerVar = { spectra: { spectrumProp: 'a' } }
    expect(resolveMeta(layerVar, { spectrumProp: 'b' }).spectrumProp).toBe('b')
    // A cleared Configure field arrives as ''.
    expect(resolveMeta(layerVar, { spectrumProp: '' }).spectrumProp).toBe('a')
    expect(resolveMeta(null, { maxSelections: '' }).maxSelections).toBe(4)
})

test('an event with no feature, or no spectrum, selects nothing @unit', () => {
    const meta = resolveMeta(null, null)
    expect(extractSelection(null, 'L', meta)).toBe(null)
    expect(extractSelection({ properties: {} }, 'L', meta)).toBe(null)
    // Mismatched array lengths are not plottable.
    expect(
        extractSelection(
            { properties: { spectrum: { wavelengths: [1, 2], reflectance: [1] } } },
            'L',
            meta
        )
    ).toBe(null)
})

test('a selection carries the spectrum and an id scoped to its layer @unit', () => {
    const meta = resolveMeta(null, null)
    const sel = extractSelection(spectrum(), 'Spectra Points', meta)
    expect(sel.id).toBe('Spectra Points::OBS-001')
    expect(sel.wavelengths).toEqual([400, 500])
    expect(sel.reflectance).toEqual([0.2, 0.3])
    expect(sel.units).toBe('nm')
})

test('a renamed spectrum property is honoured @unit', () => {
    const meta = resolveMeta({ spectra: { spectrumProp: 'vswir' } }, null)
    expect(extractSelection(spectrum('vswir'), 'L', meta)).not.toBe(null)
    expect(extractSelection(spectrum(), 'L', meta)).toBe(null)
})

test('the comparison set toggles and is capped @unit', () => {
    const s = (id) => ({ id, wavelengths: [1], reflectance: [1] })
    let list = nextSelections([], s('a'), 2)
    list = nextSelections(list, s('b'), 2)
    expect(list.map((x) => x.id)).toEqual(['a', 'b'])
    // Re-selecting removes.
    expect(nextSelections(list, s('a'), 2).map((x) => x.id)).toEqual(['b'])
    // Past the cap the oldest is dropped.
    expect(nextSelections(list, s('c'), 2).map((x) => x.id)).toEqual(['b', 'c'])
})
