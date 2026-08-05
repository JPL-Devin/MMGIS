/**
 * fov-planner shared geometry — unit tests.
 *
 * Run with `npm run test:plugins:unit`. `lib/fov.js` imports nothing, which is
 * exactly why the interesting logic of all four plugins lives there.
 */
import { test, expect } from '@playwright/test'
import {
    destination,
    fovRing,
    footprintFor,
    footprintCollection,
    overlapping,
    summarize,
    EARTH_RADIUS_M,
} from '../lib/fov.js'

const obs = (id, lng, lat, azimuth, fov = 30, range = 1000) => ({
    type: 'Feature',
    properties: { obs_id: id, azimuth, fov, range },
    geometry: { type: 'Point', coordinates: [lng, lat] },
})

test('destination walks the right way on the right body @unit', () => {
    const [lng, lat] = destination(0, 0, 0, 111320, EARTH_RADIUS_M)
    expect(lat).toBeCloseTo(1, 2)
    expect(lng).toBeCloseTo(0, 6)

    // Mars is smaller, so the same distance is a bigger angle.
    const [, marsLat] = destination(0, 0, 0, 111320, 3396190)
    expect(marsLat).toBeGreaterThan(lat)
})

test('a wedge is closed, apexed at the sensor and centred on the azimuth @unit', () => {
    const ring = fovRing(0, 0, 90, 60, 1000, { steps: 8 })
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(ring[0]).toEqual([0, 0])
    // Due east of the sensor, so every arc vertex has a greater longitude.
    for (const [lng] of ring.slice(1, -1)) expect(lng).toBeGreaterThan(0)
})

test('a 360-degree FOV is a disc, not a pac-man @unit', () => {
    const ring = fovRing(0, 0, 0, 360, 1000, { steps: 12 })
    expect(ring[0]).toEqual(ring[ring.length - 1])
    // No apex vertex at the sensor.
    expect(ring.some(([lng, lat]) => lng === 0 && lat === 0)).toBe(false)
})

test('a feature with no azimuth has no footprint @unit', () => {
    expect(footprintFor({ properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } })).toBe(
        null
    )
    expect(footprintFor(obs('a', 0, 0, undefined))).toBe(null)
    // A non-point observation is skipped rather than throwing.
    expect(
        footprintFor({
            properties: { azimuth: 10 },
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        })
    ).toBe(null)
})

test('property names are configurable and defaults apply per feature @unit', () => {
    const feature = {
        type: 'Feature',
        properties: { boresight: 45 },
        geometry: { type: 'Point', coordinates: [10, 10] },
    }
    const fp = footprintFor(feature, {
        azimuthProp: 'boresight',
        defaultFovDeg: 90,
        defaultRangeMeters: 250,
    })
    expect(fp.properties._fovAzimuth).toBe(45)
    expect(fp.properties._fovDeg).toBe(90)
    expect(fp.properties._fovRangeM).toBe(250)
    expect(fp.geometry.type).toBe('Polygon')
})

test('a collection drops what it cannot draw @unit', () => {
    const fc = footprintCollection({
        features: [obs('a', 0, 0, 0), { properties: {}, geometry: null }],
    })
    expect(fc.features).toHaveLength(1)
})

test('overlaps are reported by id, excluding the observation itself @unit', () => {
    const target = obs('OBS-1', 0, 0, 90, 60, 5000)
    const near = obs('OBS-2', 0.01, 0, 270, 60, 5000)
    const far = obs('OBS-3', 40, 40, 90, 10, 100)

    const hits = overlapping(target, [target, near, far], { idProp: 'obs_id' })
    expect(hits.map((h) => h.id)).toEqual(['OBS-2'])
    expect(hits[0].overlapKind).toBe('bounds')
})

test('summarize is what the coverage bar renders @unit', () => {
    const target = obs('OBS-1', 0, 0, 90, 60, 5000)
    const report = summarize(target, [obs('OBS-2', 0.01, 0, 270, 60, 5000)], {
        idProp: 'obs_id',
    })
    expect(report).toMatchObject({
        id: 'OBS-1',
        azimuth: 90,
        fov: 60,
        range: 5000,
        conflictCount: 1,
    })
})
