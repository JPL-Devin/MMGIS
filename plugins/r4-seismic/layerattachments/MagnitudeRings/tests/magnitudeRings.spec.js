/**
 * MagnitudeRings attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these). The
 * module is imported for real; `window.L` is faked so `make`/`syncData` can be
 * driven without Leaflet.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import MagnitudeRings from '../magnitudeRings.js'
import { ringRadiusMeters, depthColor } from '../lib/rings.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

/** The bare minimum of Leaflet these two operations touch. */
function fakeLeaflet() {
    return {
        circle: (latlng, options) => ({ latlng, options, setStyle: () => {} }),
        layerGroup: (layers) => ({
            _layers: [...layers],
            addLayer(l) {
                this._layers.push(l)
            },
            clearLayers() {
                this._layers = []
            },
            eachLayer(cb) {
                this._layers.forEach(cb)
            },
        }),
    }
}

const geojsonOf = (...events) => ({
    type: 'FeatureCollection',
    features: events.map(([id, magnitude, depth_km]) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [-122, 37, depth_km] },
        properties: { id, magnitude, depth_km },
    })),
})

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('magnitude_rings')
    expect(manifest.configPath).toBe('variables.layerAttachments.magnitudeRings')
    expect(manifest.applicableLayerTypes).toContain('seismic')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('a bigger magnitude gets a bigger ring, a deeper event a cooler colour @unit', () => {
    expect(ringRadiusMeters(6, 1000)).toBeGreaterThan(ringRadiusMeters(4, 1000))
    expect(depthColor(5)).not.toBe(depthColor(500))
})

test('make builds one tagged ring per point event @unit', () => {
    window.L = fakeLeaflet()

    const attachment = MagnitudeRings.make({
        geojson: geojsonOf(['a', 4, 5], ['b', 6, 400]),
        config: { enabled: true, scaleMeters: 1000 },
    })

    expect(attachment.type).toBe('magnitude_rings')
    expect(attachment.on).toBe(true)
    expect(attachment.layer._layers).toHaveLength(2)
    // The interaction finds a ring by the event id the attachment tagged it with.
    expect(attachment.layer._layers.map((r) => r._seismicFeatureId)).toEqual(['a', 'b'])
    expect(attachment.layer._layers[1].options.radius).toBeGreaterThan(
        attachment.layer._layers[0].options.radius
    )
})

test('syncData rebuilds the derived rings for new host data @unit', () => {
    window.L = fakeLeaflet()
    const attachment = MagnitudeRings.make({ geojson: geojsonOf(['a', 4, 5]), config: {} })

    MagnitudeRings.syncData(attachment, { geojson: geojsonOf(['b', 5, 5], ['c', 5, 5]) })
    expect(attachment.layer._layers.map((r) => r._seismicFeatureId)).toEqual(['b', 'c'])

    MagnitudeRings.syncData(attachment, { geojson: geojsonOf(['d', 5, 5]), onlyClear: true })
    expect(attachment.layer._layers).toHaveLength(0)
})
