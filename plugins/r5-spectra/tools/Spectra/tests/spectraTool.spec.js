/**
 * SpectraTool — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). A tool imports React, CSS and
 * MMGIS singletons, none of which load outside the bundler, so these tests
 * cover the contract and the pure plot geometry; open-the-tool behavior belongs
 * in an E2E spec.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { extentOf, polylinePoints, colorFor, SERIES_COLORS } from '../plot.js'

const manifest = manifestOf(__dirname)

test('plugin.json is valid @unit', () => {
    expect(manifest.name).toBe('Spectra')
    expect(manifest.type).toBe('tool')
    expect(manifest.paths['SpectraTool']).toBeDefined()
})

test('every declared path resolves to a file @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('no selections means no extent @unit', () => {
    expect(extentOf([])).toBe(null)
    expect(extentOf(null)).toBe(null)
})

test('the extent spans every selected spectrum @unit', () => {
    const extent = extentOf([
        { wavelengths: [400, 500], reflectance: [0.1, 0.2] },
        { wavelengths: [450, 900], reflectance: [0.05, 0.4] },
    ])
    expect(extent).toEqual({ minX: 400, maxX: 900, minY: 0.05, maxY: 0.4 })
})

test('a flat spectrum does not divide by zero @unit', () => {
    const selection = { wavelengths: [400, 500], reflectance: [0.2, 0.2] }
    const extent = extentOf([selection])
    expect(extent.maxY).toBeGreaterThan(extent.minY)
    const points = polylinePoints(selection, extent, BOX)
    expect(points).not.toContain('NaN')
})

const BOX = {
    width: 300,
    height: 200,
    padLeft: 38,
    padRight: 8,
    padTop: 8,
    padBottom: 24,
}

test('a spectrum maps to the corners of the plot box @unit', () => {
    const selection = { wavelengths: [400, 2500], reflectance: [0, 1] }
    const extent = extentOf([selection])
    const points = polylinePoints(selection, extent, BOX).split(' ')
    expect(points[0]).toBe('38,176')
    expect(points[1]).toBe('292,8')
})

test('series colours cycle @unit', () => {
    expect(colorFor(0)).toBe(SERIES_COLORS[0])
    expect(colorFor(SERIES_COLORS.length)).toBe(SERIES_COLORS[0])
})
