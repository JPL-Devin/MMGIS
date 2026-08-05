/**
 * WindField layer type — unit tests.
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
import WindField from '../windField.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('windfield')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(WindField)) expect(SURFACES).toContain(key)
})

test('the attachment and interaction it ships with are declared @unit', () => {
    // The seam: the property names the attachment needs are declared here, by
    // the plugin that knows them, not typed again by an admin.
    expect(manifest.capabilities.defaultAttachments.wind_barbs).toEqual({
        speedProp: 'windSpeed',
        directionProp: 'windDirection',
        scale: 200,
    })
    expect(manifest.capabilities.defaultInteractions.click).toEqual([
        'wind:report',
    ])
})

test('fetch normalizes the service onto this container\u2019s property names @unit', async () => {
    const collection = {
        type: 'FeatureCollection',
        features: [
            {
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: { spd: '7', dir: '270' },
            },
        ],
    }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await WindField.source.fetch(
            { name: 'WindField', variables: { speedProp: 'spd', directionProp: 'dir' } },
            { url: 'https://example.test/items', trigger: 'make' }
        )
        expect(result.features[0].properties).toMatchObject({
            windSpeed: 7,
            windDirection: 270,
            windCategory: 'moderate',
        })
    } finally {
        window.fetch = original
    }
})

test('the derived legend styles features by category @unit', () => {
    const layerObj = { name: 'WindField' }
    expect(WindField.legend.derive(layerObj)).toBe(true)
    expect(layerObj._legend.length).toBe(5)
    expect(layerObj._legend[0].propertyName).toBe('windCategory')
    expect(layerObj._legend[0].styleMatching).toBe(true)
})
