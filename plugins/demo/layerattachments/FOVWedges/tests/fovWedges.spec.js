/**
 * FOV Wedges attachment — unit tests. Pure geometry, so it runs in Node.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import FOVWedges, { settingsOf, wedgeRing, wedgesOf } from '../fovWedges.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const stops = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { name: 'Sol 100', azimuth: 90, range_m: 40 },
            geometry: { type: 'Point', coordinates: [10, 0] },
        },
        // No azimuth: skipped rather than drawn pointing north.
        {
            type: 'Feature',
            properties: { name: 'Sol 101' },
            geometry: { type: 'Point', coordinates: [10.001, 0] },
        },
        // Not a point: skipped.
        {
            type: 'Feature',
            properties: { azimuth: 10 },
            geometry: { type: 'LineString', coordinates: [[10, 0], [11, 0]] },
        },
    ],
}

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('fov_wedges')
    expect(manifest.configPath).toBe('variables.markerAttachments.fovWedges')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports its operations @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof FOVWedges.make).toBe('function')
    expect(typeof FOVWedges.syncData).toBe('function')
    expect(typeof FOVWedges.onConfigChange).toBe('function')
})

test('an unconfigured host still gets usable settings @unit', () => {
    const s = settingsOf(null)
    expect(s.azimuthProp).toBe('azimuth')
    expect(s.fovDegrees).toBe(60)
    expect(s.segments).toBeGreaterThan(1)
})

test('only point features with a finite azimuth become wedges @unit', () => {
    const out = wedgesOf(stops, settingsOf({}))
    expect(out.features.length).toBe(1)
    expect(out.features[0].geometry.type).toBe('Polygon')
    expect(out.features[0].properties.name).toBe('Sol 100')
    expect(out.features[0].properties._fovAzimuth).toBe(90)
})

test('a wedge is a closed ring apexed on its feature @unit', () => {
    const s = settingsOf({ segments: 8 })
    const ring = wedgeRing(10, 0, 90, 60, 1000, s)
    expect(ring[0]).toEqual([10, 0])
    expect(ring[ring.length - 1]).toEqual([10, 0])
    // apex + (segments + 1) arc points + closing apex
    expect(ring.length).toBe(11)
})

test('a 360° wedge is a circle with no apex spokes @unit', () => {
    const s = settingsOf({ segments: 8 })
    const ring = wedgeRing(10, 0, 0, 360, 1000, s)
    expect(ring[0]).not.toEqual([10, 0])
    expect(ring[ring.length - 1]).toEqual(ring[0])
})

test('the wedge points where the azimuth says, and reaches its range @unit', () => {
    const s = settingsOf({ segments: 2, bodyRadius: 3396190 })
    // Due east, a narrow wedge: every arc point is east of the apex.
    const east = wedgeRing(10, 0, 90, 20, 5000, s)
    for (const [lng, lat] of east.slice(1, -1)) {
        expect(lng).toBeGreaterThan(10)
        expect(Math.abs(lat)).toBeLessThan(0.02)
    }
    // The centre arc point sits one range away: 5 km on Mars ≈ 0.0843°.
    const centre = east[2]
    expect(centre[0] - 10).toBeCloseTo((5000 / 3396190) * (180 / Math.PI), 4)
})

test('per-feature properties override the layer-wide range @unit', () => {
    const wide = wedgesOf(stops, settingsOf({ rangeProp: 'range_m', rangeMeters: 1 }))
    expect(wide.features[0].properties._fovRangeMeters).toBe(40)
})

test('radian azimuths are converted, and the offset applied @unit', () => {
    const out = wedgesOf(
        {
            type: 'FeatureCollection',
            features: [
                {
                    type: 'Feature',
                    properties: { yaw: Math.PI / 2 },
                    geometry: { type: 'Point', coordinates: [0, 0] },
                },
            ],
        },
        settingsOf({ azimuthProp: 'yaw', azimuthUnit: 'rad', azimuthOffset: 10 })
    )
    expect(out.features[0].properties._fovAzimuth).toBeCloseTo(100, 6)
})
