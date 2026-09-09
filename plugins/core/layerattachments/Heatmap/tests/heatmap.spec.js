/**
 * Heatmap attachment — unit tests. Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
// heatmap.js itself imports F_, which needs a real DOM — its logic does not.
import { pointsOf, settings, intensityRange, normalize } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const geojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { depth: 4 },
            geometry: { type: 'Point', coordinates: [10, 20] },
        },
        {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'MultiPoint',
                coordinates: [
                    [1, 2],
                    [3, 4],
                ],
            },
        },
        {
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [
                    [0, 0],
                    [1, 1],
                ],
            },
        },
    ],
}

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('heatmap')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.heatmap')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('only point geometries become weighted [lat, lng, weight] @unit', () => {
    expect(pointsOf(geojson, settings({}))).toEqual([
        [20, 10, 1],
        [2, 1, 1],
        [4, 3, 1],
    ])
    expect(pointsOf(geojson, settings({ weightProp: 'depth' }))[0]).toEqual([
        20, 10, 4,
    ])
})

test('settings default anything the host left out @unit', () => {
    const defaults = settings({})
    expect(defaults.radius).toBe(25)
    expect(defaults.gradient.length).toBeGreaterThan(1)
    expect(settings({ radius: 8 }).radius).toBe(8)
    // A single-color gradient has no ramp, so the default stands.
    expect(settings({ gradient: ['#fff'] }).gradient).toEqual(defaults.gradient)
})

test('intensities span the layer unless the host pinned them @unit', () => {
    const points = [
        [0, 0, 2],
        [0, 0, 6],
    ]
    expect(intensityRange(points, settings({}))).toEqual({
        min: 2,
        max: 6,
        span: 4,
    })
    const pinned = intensityRange(points, settings({ minIntensity: 0 }))
    expect(pinned.min).toBe(0)
    expect(normalize(6, pinned)).toBe(1)
    // Nothing is drawn fully transparent, so a floor stands in for zero.
    expect(normalize(0, pinned)).toBe(0.05)
})
