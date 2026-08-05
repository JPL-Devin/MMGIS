/**
 * ChainMid layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag is what selects these;
 * `npm run test:unit` only covers `tests/unit`). Behavior against a real map
 * belongs in an E2E spec — see plugins/core/layertypes/Vector/tests/.
 *
 * A type that extends declares surfaces rather than a renderer, and `fetch` is a
 * plain async function, so it is testable here with a stubbed `window.fetch`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ChainMid from '../chainMid.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('chainmid')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(ChainMid)) expect(SURFACES).toContain(key)
})

test('fetch returns the features the service gave it @unit', async () => {
    const collection = { type: 'FeatureCollection', features: [] }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await ChainMid.source.fetch(
            { name: 'ChainMid' },
            { url: 'https://example.test/items', trigger: 'make' }
        )
        expect(result).toEqual(collection)
    } finally {
        window.fetch = original
    }
})
