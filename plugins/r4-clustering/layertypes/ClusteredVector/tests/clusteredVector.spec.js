/**
 * ClusteredVector layer type — unit tests.
 *
 * Run with `npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test
 * plugins/r4-clustering/layertypes/ClusteredVector/tests/`.
 *
 * lib/clustering.js is pure, so the aggregation itself is tested here; the
 * source/legend surfaces touch window and belong in a browser test.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import {
    cluster,
    decimate,
    bins,
    colorForCount,
    cellSizeForZoom,
    CLUSTER_PROPS,
} from '../lib/clustering.js'

const manifest = manifestOf(__dirname)

const grid = (n, spread = 0.02) => ({
    type: 'FeatureCollection',
    features: Array.from({ length: n }, (_, i) => ({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [(i % 100) * spread, Math.floor(i / 100) * spread],
        },
        properties: { i },
    })),
})

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('clusteredvector')
    // The map renderer is inherited: only the surfaces that differ are declared.
    expect(manifest.extends).toBe('vector')
    expect(Object.keys(manifest.modules).sort()).toEqual([
        'config',
        'legend',
        'source',
    ])
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('a coarser zoom yields fewer, larger clusters @unit', () => {
    const data = grid(2000)
    const far = cluster(data, 3)
    const near = cluster(data, 10)

    expect(cellSizeForZoom(3)).toBeGreaterThan(cellSizeForZoom(10))
    expect(far.geojson.features.length).toBeLessThan(
        near.geojson.features.length
    )
    expect(far.stats.sourceCount).toBe(2000)
    expect(far.stats.maxCount).toBeGreaterThan(near.stats.maxCount)
})

test('every source feature is accounted for exactly once @unit', () => {
    const { geojson } = cluster(grid(2000), 6)
    const total = geojson.features.reduce(
        (sum, f) => sum + f.properties[CLUSTER_PROPS.count],
        0
    )
    expect(total).toBe(2000)
})

test('a cluster carries the count, bounds and members its siblings read @unit', () => {
    const { geojson } = cluster(grid(500), 4)
    const multi = geojson.features.find(
        (f) => f.properties[CLUSTER_PROPS.count] > 1
    )
    expect(multi.properties[CLUSTER_PROPS.isCluster]).toBe(true)
    const [minLng, minLat, maxLng, maxLat] = multi.properties[
        CLUSTER_PROPS.bounds
    ]
    expect(maxLng).toBeGreaterThanOrEqual(minLng)
    expect(maxLat).toBeGreaterThanOrEqual(minLat)
    expect(multi.properties[CLUSTER_PROPS.members].length).toBe(
        multi.properties[CLUSTER_PROPS.count]
    )
})

test('a single-feature cell keeps its original properties @unit', () => {
    const { geojson } = cluster(grid(4, 40), 8)
    for (const f of geojson.features) {
        expect(f.properties[CLUSTER_PROPS.count]).toBe(1)
        expect(f.properties[CLUSTER_PROPS.isCluster]).toBe(false)
        expect(typeof f.properties.i).toBe('number')
    }
})

test('decimate caps the feature count and passes small sets through @unit', () => {
    expect(decimate(grid(1000), 100).features.length).toBeLessThanOrEqual(100)
    expect(decimate(grid(50), 100).features.length).toBe(50)
})

test('legend bins cover 1..maxCount and colour a count @unit', () => {
    const binList = bins(37)
    expect(binList[0].min).toBe(1)
    expect(binList[binList.length - 1].max).toBeGreaterThanOrEqual(37)
    expect(colorForCount(1, binList)).toBe(binList[0].color)
    expect(colorForCount(37, binList)).toBe(
        binList[binList.length - 1].color
    )
})
