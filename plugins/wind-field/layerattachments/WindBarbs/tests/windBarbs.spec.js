/**
 * WindBarbs attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import WindBarbs, { barbsOf } from '../windBarbs.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('wind_barbs')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.windBarbs')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof WindBarbs.make).toBe('function')
})

const fc = (props) => ({
    type: 'FeatureCollection',
    features: [
        { geometry: { type: 'Point', coordinates: [10, 20] }, properties: props },
        { geometry: { type: 'LineString', coordinates: [] }, properties: props },
    ],
})

test('barbs are built from point features only, coloured by speed @unit', () => {
    const barbs = barbsOf(fc({ windSpeed: 25, windDirection: 0 }), null)
    expect(barbs.length).toBe(1)
    expect(barbs[0].color).toBe('#d7191c') // gale
    // shaft + flights
    expect(barbs[0].lines.length).toBe(2)
})

test('property names come from the settings the layer type declared @unit', () => {
    const config = { speedProp: 'spd', directionProp: 'dir', scale: 200 }
    const barbs = barbsOf(fc({ spd: 3, dir: 180 }), config)
    expect(barbs[0].color).toBe('#abd9e9') // light
    // Direction 180 => the barb points north (increasing latitude).
    const [[from, to]] = barbs[0].lines
    expect(to[0]).toBeGreaterThan(from[0])
})
