import { test, expect } from '@playwright/test'
import {
    resolveConfig,
    geometryCenter,
    findNeighbors,
    bearingToCompass,
} from '../logic'

const dist = (lng1, lat1, lng2, lat2) =>
    Math.hypot(lng2 - lng1, lat2 - lat1) * 1000
const bearing = () => 90

test('resolveConfig applies defaults', () => {
    expect(resolveConfig(null)).toEqual({
        radius: 500,
        includeOtherLayers: false,
        maxResults: 25,
        color: '#ffdd00',
    })
    expect(resolveConfig({ radius: '20', includeOtherLayers: 'true' }).radius).toBe(20)
    expect(resolveConfig({ includeOtherLayers: 'true' }).includeOtherLayers).toBe(true)
})

test('geometryCenter handles points and polygons', () => {
    expect(geometryCenter({ type: 'Point', coordinates: [1, 2] })).toEqual([1, 2])
    expect(
        geometryCenter({
            type: 'Polygon',
            coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2]]],
        })
    ).toEqual([1, 1])
    expect(geometryCenter(null)).toBeNull()
})

test('findNeighbors filters by radius, sorts and caps', () => {
    const candidates = [
        { id: 'far', center: [10, 0] },
        { id: 'near', center: [0.1, 0] },
        { id: 'mid', center: [0.3, 0] },
        { id: 'self', center: [0, 0] },
        { id: 'nocenter', center: null },
    ]
    const res = findNeighbors([0, 0], candidates, { radius: 500, maxResults: 1 }, dist, bearing)
    expect(res.map((r) => r.id)).toEqual(['near'])
    const all = findNeighbors([0, 0], candidates, { radius: 500, maxResults: 25 }, dist, bearing)
    expect(all.map((r) => r.id)).toEqual(['near', 'mid'])
    expect(all[0].bearing).toBe(90)
})

test('bearingToCompass', () => {
    expect(bearingToCompass(0)).toBe('N')
    expect(bearingToCompass(93)).toBe('E')
    expect(bearingToCompass(359)).toBe('N')
})
