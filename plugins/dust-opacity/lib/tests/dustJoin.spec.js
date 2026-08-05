/**
 * The shared join — the part of this container that has no MMGIS dependency and
 * is therefore unit testable (plugins/README.md, "One feature, several plugins").
 *
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
import { joinOpacity, deltaRange, indexBy } from '../dustJoin.js'

const point = (id, value, lng = 0, lat = 0) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: { site_id: id, opacity: value },
})

const fc = (...features) => ({ type: 'FeatureCollection', features })

test('joins observed onto predicted by the join property @unit', () => {
    const joined = joinOpacity(fc(point('A', 0.4), point('B', 0.2)), fc(point('B', 0.5), point('A', 0.6)), {
        joinProp: 'site_id',
    })

    const byId = Object.fromEntries(joined.features.map((f) => [f.properties.site_id, f.properties]))
    expect(byId.A.dust_predicted).toBe(0.4)
    expect(byId.A.dust_observed).toBe(0.6)
    expect(byId.A.dust_delta).toBeCloseTo(0.2)
    expect(byId.B.dust_delta).toBeCloseTo(0.3)
    expect(byId.A.dust_matched).toBe(true)
})

test('an unmatched prediction keeps a null delta rather than a zero @unit', () => {
    const joined = joinOpacity(fc(point('A', 0.4)), fc(point('Z', 0.9)), {})
    expect(joined.features).toHaveLength(1)
    expect(joined.features[0].properties.dust_observed).toBe(null)
    expect(joined.features[0].properties.dust_delta).toBe(null)
    expect(joined.features[0].properties.dust_matched).toBe(false)
})

test('keepUnmatched false drops predictions with no observation @unit', () => {
    const joined = joinOpacity(fc(point('A', 0.4)), fc(point('Z', 0.9)), { keepUnmatched: false })
    expect(joined.features).toHaveLength(0)
})

test('deltaRange is symmetric about zero @unit', () => {
    const joined = joinOpacity(fc(point('A', 0.4), point('B', 1.0)), fc(point('A', 0.1), point('B', 1.1)), {})
    expect(deltaRange(joined)).toEqual([-0.30000000000000004, 0.30000000000000004])
})

test('indexBy skips features with no key and keeps the last duplicate @unit', () => {
    const index = indexBy(fc(point('A', 1), point(undefined, 2), point('A', 3)), 'site_id')
    expect(index.size).toBe(1)
    expect(index.get('A').properties.opacity).toBe(3)
})
