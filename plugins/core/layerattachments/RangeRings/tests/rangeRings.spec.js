/**
 * RangeRings attachment — unit tests.
 *
 * Run with `npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test
 * plugins/core/layerattachments/RangeRings/tests/`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import RangeRings from '../rangeRings.js'
import { ringsOf, ringPolygons } from '../rings.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const fieldsOf = (component) =>
    component.type === 'objectarray'
        ? [component.field]
        : component.field
          ? [component.field]
          : []

const pointGeojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { range: 50 },
            geometry: { type: 'Point', coordinates: [0, 0, 0] },
        },
        {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        },
    ],
}

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('range_rings')
    expect(manifest.configPath).toBe('variables.layerAttachments.rangeRings')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            for (const field of fieldsOf(component))
                expect(field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof RangeRings.make).toBe('function')
    expect(typeof RangeRings.onConfigChange).toBe('function')
})

test('rings are normalized, sorted outward and zero-radius dropped @unit', () => {
    const rings = ringsOf({
        rings: [
            { radius: 300, color: '#ff0000' },
            { radius: '100' },
            { radius: 0 },
            { radius: 200, fill: true, label: 'Comm' },
        ],
    })
    expect(rings.map((r) => r.radius)).toEqual([100, 200, 300])
    expect(rings[1]).toMatchObject({ fill: true, label: 'Comm' })
    expect(rings[0].color).toBe('#4ad4ff')
})

test('a polygon is produced per ring per point feature only @unit', () => {
    const features = ringPolygons(pointGeojson, {
        rings: [{ radius: 100 }, { radius: 200 }],
    }).features
    expect(features.length).toBe(2)
    for (const f of features) expect(f.geometry.type).toBe('Polygon')
    expect(features.map((f) => f.properties._rangeRing.radius)).toEqual([
        100, 200,
    ])
})

test('kilometers and a radius property scale the radii @unit', () => {
    const km = ringPolygons(pointGeojson, {
        units: 'kilometers',
        rings: [{ radius: 2 }],
    })
    expect(km.features[0].properties._rangeRing.radius).toBe(2000)

    const scaled = ringPolygons(pointGeojson, {
        radiusProperty: 'range',
        rings: [{ radius: 2 }],
    })
    expect(scaled.features[0].properties._rangeRing.radius).toBe(100)
})

test('an explicitly disabled attachment makes nothing @unit', () => {
    expect(
        RangeRings.make({ geojson: pointGeojson, config: { enabled: false } })
    ).toBe(false)
})

test('a ring is a closed circle of the requested radius @unit', () => {
    const bodyRadius = 3396190 // Mars
    const ring = ringPolygons(
        pointGeojson,
        { rings: [{ radius: 1000 }] },
        bodyRadius
    ).features[0]
    const coordinates = ring.geometry.coordinates[0]
    expect(coordinates[0]).toEqual(coordinates[coordinates.length - 1])
    // At the equator, 1000 m north is 1000/bodyRadius radians of latitude.
    const north = Math.max(...coordinates.map((c) => c[1]))
    expect(north).toBeCloseTo(((1000 / bodyRadius) * 180) / Math.PI, 6)
})
