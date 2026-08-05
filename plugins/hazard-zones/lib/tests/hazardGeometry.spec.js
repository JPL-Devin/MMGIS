/**
 * The container's shared geometry — the one part of this feature all three
 * plugins depend on, and the only part that is pure enough to unit test.
 *
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'

import {
    bufferPolygonFeature,
    centroidOf,
    pointInPolygonFeature,
    zonesContaining,
} from '../hazardGeometry.js'

const square = (cx, cy, half, properties = {}) => ({
    type: 'Feature',
    properties,
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [cx - half, cy - half],
                [cx + half, cy - half],
                [cx + half, cy + half],
                [cx - half, cy + half],
                [cx - half, cy - half],
            ],
        ],
    },
})

test('centroidOf averages a polygon ring @unit', () => {
    const [lng, lat] = centroidOf(square(10, 20, 1))
    expect(lng).toBeCloseTo(10, 6)
    expect(lat).toBeCloseTo(20, 6)
})

test('pointInPolygonFeature respects holes @unit', () => {
    const withHole = square(0, 0, 10)
    withHole.geometry.coordinates.push(square(0, 0, 1).geometry.coordinates[0])
    expect(pointInPolygonFeature([5, 5], withHole)).toBe(true)
    expect(pointInPolygonFeature([0, 0], withHole)).toBe(false)
    expect(pointInPolygonFeature([50, 50], withHole)).toBe(false)
})

test('bufferPolygonFeature grows a polygon outward @unit', () => {
    const zone = square(0, 0, 0.001)
    const buffered = bufferPolygonFeature(zone, 500)
    expect(pointInPolygonFeature([0.003, 0], zone)).toBe(false)
    expect(pointInPolygonFeature([0.003, 0], buffered)).toBe(true)
})

test('bufferPolygonFeature ignores non-polygons and non-buffers @unit', () => {
    const point = { type: 'Feature', geometry: { type: 'Point', coordinates: [0, 0] } }
    expect(bufferPolygonFeature(point, 100)).toBe(null)
    expect(bufferPolygonFeature(square(0, 0, 1), 0)).toBe(null)
})

test('zonesContaining separates a zone hit from a buffer hit @unit', () => {
    const zone = square(0, 0, 0.001, { name: 'Crater rim', severity: 'high' })
    const zones = [
        {
            layerName: 'Hazards',
            feature: zone,
            buffered: bufferPolygonFeature(zone, 500),
        },
    ]

    expect(zonesContaining([0, 0], zones)).toEqual([
        {
            layerName: 'Hazards',
            name: 'Crater rim',
            severity: 'high',
            within: 'zone',
        },
    ])
    expect(zonesContaining([0.003, 0], zones)[0].within).toBe('buffer')
    expect(zonesContaining([10, 10], zones)).toEqual([])
})
