/**
 * WindStation layer type — unit tests.
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
import WindStation, { annotate } from '../windStation.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('windstation')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(WindStation)) expect(SURFACES).toContain(key)
})

test('the property dropdowns ask Configure for the layer\'s property names @unit', () => {
    const components = manifest.config.tabs
        .flatMap((t) => t.rows)
        .flatMap((r) => r.components)
    for (const field of ['speedProp', 'directionProp', 'stationIdProp']) {
        const com = components.find((c) => c.field === `variables.windStation.${field}`)
        expect(com.type).toBe('dropdown')
        expect(com.optionsFrom).toBe('layerProperties')
        // Shown until (and if) the provider answers.
        expect(com.options.length).toBeGreaterThan(0)
    }
})

test('the type ships its attachment and interaction with settings @unit', () => {
    expect(manifest.capabilities.defaultAttachments.wind_barb).toBeTruthy()
    expect(
        manifest.capabilities.defaultInteractions.click['gust:report']
    ).toBeTruthy()
})

test('fetch annotates features with a normalized speed in knots @unit', async () => {
    const collection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [0, 0] },
                properties: { spd_ms: 10, dir: 90 },
            },
        ],
    }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await WindStation.source.fetch(
            {
                name: 'WindStation',
                variables: {
                    windStation: { speedProp: 'spd_ms', speedUnits: 'm/s' },
                },
            },
            { url: 'https://example.test/items', trigger: 'make' }
        )
        expect(result.features[0].properties.wv_speed_knots).toBeCloseTo(19.4384, 3)
    } finally {
        window.fetch = original
    }
})

test('annotate leaves a feature whose speed property is absent alone @unit', () => {
    const collection = {
        type: 'FeatureCollection',
        features: [{ properties: { other: 1 } }],
    }
    annotate(collection, { speedProp: 'wind_speed' })
    expect(collection.features[0].properties.wv_speed_knots).toBe(undefined)
})

test('normalize keeps the parent\'s work and adds the type\'s defaults @unit', () => {
    let inheritedRan = false
    const layerObj = { name: 'Stations', variables: {} }
    WindStation.config.normalize(layerObj, {}, () => {
        inheritedRan = true
    })
    expect(inheritedRan).toBe(true)
    expect(layerObj.variables.windStation.speedProp).toBe('wind_speed')
    expect(layerObj.variables.windStation.speedUnits).toBe('knots')
})
