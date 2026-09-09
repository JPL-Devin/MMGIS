/**
 * Proximity interaction — unit tests. Run with `npm run test:plugins:unit`.
 * Imports `logic.js`, not the handler, so it stays importable in Node.
 */
import { test, expect } from '@playwright/test'
import { decide, resolveConfig, centroid } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

// Flat-plane distance is enough to exercise the ranking.
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
const pt = (name, x, y) => ({
    type: 'Feature',
    properties: { name },
    geometry: { type: 'Point', coordinates: [x, y] },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('proximity')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature decides nothing @unit', () => {
    expect(decide(null, [], null, dist)).toBe(null)
})

test('settings are defaulted and coerced @unit', () => {
    expect(resolveConfig(null)).toMatchObject({ radius: 500, maxResults: 25 })
    expect(resolveConfig({ radius: '10', layers: 'A, B' })).toMatchObject({
        radius: 10,
        layers: ['A', 'B'],
    })
})

test('centroid handles nested geometries @unit', () => {
    expect(
        centroid({
            type: 'Polygon',
            coordinates: [
                [
                    [0, 0],
                    [2, 0],
                    [2, 2],
                    [0, 2],
                ],
            ],
        })
    ).toEqual([1, 1])
})

test('ranks by distance, excludes origin, respects radius/max/layers @unit', () => {
    const origin = pt('O', 0, 0)
    const candidates = [
        { layerName: 'A', feature: origin },
        { layerName: 'A', feature: pt('far', 100, 0) },
        { layerName: 'A', feature: pt('mid', 5, 0) },
        { layerName: 'B', feature: pt('near', 1, 0) },
        { layerName: 'B', feature: pt('nearer', 0.5, 0) },
    ]
    const r = decide(origin, candidates, { radius: 10 }, dist)
    expect(r.results.map((x) => x.name)).toEqual(['nearer', 'near', 'mid'])
    expect(
        decide(origin, candidates, { radius: 10, maxResults: 1 }, dist).results
    ).toHaveLength(1)
    expect(
        decide(origin, candidates, { radius: 10, layers: 'A' }, dist).results.map(
            (x) => x.name
        )
    ).toEqual(['mid'])
})
