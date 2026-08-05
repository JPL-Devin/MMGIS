/**
 * ThermalShade attachment — unit tests.
 *
 * The module imports the shared inertia lib but nothing from `src/essence`, and
 * reads Leaflet from `window.L` per call, so it is importable in Node with a
 * tiny Leaflet stub. Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
import '../../../../../tests/helpers/browser-globals.js'
import ThermalShade, { styleForFeature } from '../thermalShade.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const feature = (day, night) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { temp_day: day, temp_night: night },
})

test('manifest declares a resolvable attachment with configPath @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('thermal_shade')
    expect(manifest.configPath).toMatch(/^variables\./)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('warmer diurnal swing shades redder than a small swing @unit', () => {
    const bigSwing = styleForFeature(feature(300, 100), {}).fillColor // low inertia
    const smallSwing = styleForFeature(feature(300, 290), {}).fillColor // high inertia
    // Red channel is higher for the low-inertia (big swing) feature.
    const red = (hex) => parseInt(hex.slice(1, 3), 16)
    expect(red(bigSwing)).toBeGreaterThan(red(smallSwing))
})

test('a feature missing temps gets the neutral grey @unit', () => {
    expect(styleForFeature({ properties: {} }, {}).fillColor).toBe('#888888')
})

test('make returns the attachment shape and honours initialVisibility @unit', () => {
    const original = window.L
    const added = []
    window.L = {
        geoJson: (geojson, opts) => {
            // Exercise the point styler through the stub.
            if (geojson.features)
                geojson.features.forEach((f) =>
                    added.push(opts.pointToLayer(f, [0, 0]))
                )
            return { _geojson: geojson, eachLayer() {}, clearLayers() {}, addData() {} }
        },
        circleMarker: (latlng, style) => ({ latlng, style }),
    }
    try {
        const geojson = { type: 'FeatureCollection', features: [feature(300, 150)] }
        const att = ThermalShade.make({ geojson, config: { initialVisibility: false } })
        expect(att.type).toBe('thermal_shade')
        expect(att.on).toBe(false)
        expect(att.geojson).toBe(geojson)
        expect(att.layer).toBeTruthy()
        // The point was styled with a derived (non-grey) colour.
        expect(added[0].style.fillColor).not.toBe('#888888')
    } finally {
        window.L = original
    }
})
