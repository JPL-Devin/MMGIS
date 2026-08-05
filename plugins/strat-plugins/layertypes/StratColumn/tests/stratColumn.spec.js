/**
 * StratColumn layer type — unit tests.
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
import StratColumn from '../stratColumn.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('stratcolumn')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(StratColumn)) expect(SURFACES).toContain(key)
})

test('fetch returns the features the service gave it @unit', async () => {
    const collection = { type: 'FeatureCollection', features: [] }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await StratColumn.source.fetch(
            { name: 'StratColumn' },
            { url: 'https://example.test/items', trigger: 'make' }
        )
        expect(result).toEqual(collection)
    } finally {
        window.fetch = original
    }
})

test('fetch stamps a stable depth property from the admin-named one @unit', async () => {
    const collection = {
        type: 'FeatureCollection',
        features: [{ properties: { depth_ft: 3 } }, { properties: {} }],
    }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const layerObj = {
            name: 'StratColumn',
            variables: {
                stratColumn: {
                    depthProp: 'depth_ft',
                    unitTable: 'Shale,#7a6a53,10\nSandstone,#d8c27a,5',
                },
            },
        }
        const result = await StratColumn.source.fetch(layerObj, {
            url: 'https://example.test/items',
            trigger: 'make',
        })
        // A feature with no depth falls back to the table's total thickness.
        expect(result.features.map((f) => f.properties.stratDepth)).toEqual([3, 15])
    } finally {
        window.fetch = original
    }
})

test('the legend is derived from the unit table, or refused @unit', () => {
    const layerObj = {
        variables: { stratColumn: { unitTable: 'Shale,#7a6a53,10' } },
    }
    expect(StratColumn.legend.derive(layerObj)).toBe(true)
    expect(layerObj._legend).toEqual([
        { shape: 'square', color: '#7a6a53', value: 'Shale (10 m)' },
    ])
    expect(StratColumn.legend.derive({ variables: {} })).toBe(false)
})
