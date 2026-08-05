/**
 * WindBarb attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import WindBarb, { barbSvg } from '../windBarb.js'
import { barbCounts } from '../../../lib/wind.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('wind_barb')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.windBarb')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof WindBarb.make).toBe('function')
})

test('the property dropdowns ask Configure for the layer\'s property names @unit', () => {
    const components = manifest.config.rows.flatMap((r) => r.components)
    for (const field of ['speedProp', 'directionProp']) {
        const com = components.find(
            (c) => c.field === `${manifest.configPath}.${field}`
        )
        expect(com.optionsFrom).toBe('layerProperties')
        expect(com.options.length).toBeGreaterThan(0)
    }
})

test('barb feathers follow the meteorological 50/10/5 decomposition @unit', () => {
    expect(barbCounts(0)).toEqual({ pennants: 0, fullBarbs: 0, halfBarbs: 0 })
    expect(barbCounts(65)).toEqual({ pennants: 1, fullBarbs: 1, halfBarbs: 1 })
    // Rounded to the nearest 5 knots, as barbs are drawn.
    expect(barbCounts(12)).toEqual({ pennants: 0, fullBarbs: 1, halfBarbs: 0 })
})

test('the barb is rotated to the configured direction @unit', () => {
    expect(barbSvg(10, 235, '#fff')).toContain('rotate(235deg)')
})
