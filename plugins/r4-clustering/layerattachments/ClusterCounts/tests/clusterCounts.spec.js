/**
 * ClusterCounts attachment — unit tests.
 *
 * The module reads Leaflet off the window per call, so a tiny fake Leaflet is
 * enough to test what it builds.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ClusterCounts, { labelsOf } from '../clusterCounts.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const fakeLeaflet = () => ({
    marker: (latlng, options) => ({ latlng, options }),
    divIcon: (options) => options,
    layerGroup: (layers) => ({
        layers,
        clearLayers() {
            this.layers = []
        },
        addLayer(l) {
            this.layers.push(l)
        },
    }),
})

const clusters = (...counts) => ({
    type: 'FeatureCollection',
    features: counts.map((count, i) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [i, i] },
        properties: { _clusterCount: count },
    })),
})

test.beforeEach(() => {
    window.L = fakeLeaflet()
})

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('cluster_counts')
    expect(manifest.configPath).toBe('variables.layerAttachments.clusterCounts')
    // The attachment only makes sense on its clustering host.
    expect(manifest.applicableLayerTypes).toEqual(['clusteredvector'])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof ClusterCounts.make).toBe('function')
})

test('only clusters at or above the minimum count are labelled @unit', () => {
    expect(labelsOf(clusters(1, 2, 9), {})).toHaveLength(2)
    expect(labelsOf(clusters(1, 2, 9), { minCount: 5 })).toHaveLength(1)
})

test('large counts are abbreviated unless told not to @unit', () => {
    const [abbreviated] = labelsOf(clusters(1200), {})
    expect(abbreviated.options.icon.html).toContain('1.2k')
    const [exact] = labelsOf(clusters(1200), { abbreviate: false })
    expect(exact.options.icon.html).toContain('1200')
})

test('make returns the four keys core dispatches from @unit', () => {
    const geojson = clusters(3, 4)
    const attachment = ClusterCounts.make({ geojson, config: {} })
    expect(attachment.type).toBe('cluster_counts')
    expect(attachment.on).toBe(true)
    expect(attachment.geojson).toBe(geojson)
    expect(attachment.layer.layers).toHaveLength(2)
})

test('syncData rebuilds the labels for the host re-clustered at a new zoom @unit', () => {
    const attachment = ClusterCounts.make({ geojson: clusters(3, 4), config: {} })
    ClusterCounts.syncData(attachment, { geojson: clusters(9) })
    expect(attachment.layer.layers).toHaveLength(1)
    ClusterCounts.syncData(attachment, { geojson: clusters(9), onlyClear: true })
    expect(attachment.layer.layers).toHaveLength(0)
})

test('onConfigChange retunes in place instead of rebuilding the host @unit', () => {
    const attachment = ClusterCounts.make({ geojson: clusters(2, 9), config: {} })
    ClusterCounts.onConfigChange({ attachment, config: { minCount: 5 } })
    expect(attachment.layer.layers).toHaveLength(1)
})
