/**
 * GroundTrack layer type — unit tests.
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
import GroundTrack from '../groundTrack.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('groundtrack')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(GroundTrack)) expect(SURFACES).toContain(key)
})

test('fetch clips the service track to the time window @unit', async () => {
    const times = [
        '2030-01-01T00:00:00Z',
        '2030-01-01T00:10:00Z',
        '2030-01-01T00:20:00Z',
        '2030-01-01T00:30:00Z',
    ]
    const collection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [0, 0],
                        [1, 1],
                        [2, 2],
                        [3, 3],
                    ],
                },
                properties: { times, altitude_m: 400000 },
            },
        ],
    }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await GroundTrack.source.fetch(
            { name: 'GroundTrack', variables: {} },
            {
                url: 'https://example.test/items',
                trigger: 'make',
                time: {
                    start: '2030-01-01T00:05:00Z',
                    end: '2030-01-01T00:25:00Z',
                },
            }
        )
        expect(result.features).toHaveLength(1)
        expect(result.features[0].geometry.coordinates).toEqual([
            [1, 1],
            [2, 2],
        ])
    } finally {
        window.fetch = original
    }
})

test('with no url the type propagates a track over the window @unit', async () => {
    const result = await GroundTrack.source.fetch(
        { name: 'Orbiter', variables: { stepSeconds: 60 } },
        {
            trigger: 'make',
            url: '',
            time: {
                start: '2030-01-01T00:00:00Z',
                end: '2030-01-01T02:00:00Z',
            },
        }
    )
    expect(result.features).toHaveLength(1)
    const f = result.features[0]
    expect(f.geometry.coordinates.length).toBeGreaterThan(60)
    expect(f.properties.times).toHaveLength(f.geometry.coordinates.length)
    expect(Date.parse(f.properties.end)).toBeLessThanOrEqual(
        Date.parse('2030-01-01T02:00:00Z')
    )
})
