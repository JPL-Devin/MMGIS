/**
 * HorizonMask attachment — unit tests (`npm run test:plugins:unit`).
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import HorizonMask from '../horizonMask.js'
import { maskRadiusMeters } from '../../../lib/coverage.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('horizon_mask')
    expect(manifest.configPath).toBe('variables.layerAttachments.horizonMask')
    expect(manifest.applicableLayerTypes).toEqual(['groundstation'])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the declared module resolves and exports make @unit', () => {
    expect(typeof HorizonMask.make).toBe('function')
})

test('a lower mask elevation sees further, and scale multiplies @unit', () => {
    const low = maskRadiusMeters({ maskElevationDeg: 5, diameterM: 34 }, {})
    const high = maskRadiusMeters({ maskElevationDeg: 20, diameterM: 34 }, {})
    expect(low).toBeGreaterThan(high)
    const scaled = maskRadiusMeters(
        { maskElevationDeg: 5, diameterM: 34 },
        { scale: 2 }
    )
    expect(scaled).toBeCloseTo(low * 2, 3)
})

test('make draws one ring per station from the type\'s property names @unit', () => {
    const circles = []
    window.L = {
        circle: (latlng, options) => {
            circles.push({ latlng, options })
            return { latlng, options }
        },
        layerGroup: (layers) => ({ layers, clearLayers() {}, addLayer() {} }),
    }
    const geojson = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: { name: 'DSS-14', dish: 70, minEl: 8 },
                geometry: { type: 'Point', coordinates: [-116.89, 35.43] },
            },
        ],
    }
    // Exactly what the layer type declares in capabilities.defaultAttachments.
    const config = { diameterProp: 'dish', maskElevationProp: 'minEl', scale: 1 }
    const attachment = HorizonMask.make({
        geojson,
        config,
        layerObj: { name: 'Stations' },
    })

    expect(attachment.type).toBe('horizon_mask')
    expect(circles.length).toBe(1)
    expect(circles[0].options.radius).toBeGreaterThan(0)
    // The globe half: a clamped polygon surface of the same rings.
    expect(attachment.clampedOptions.geojson.features[0].geometry.type).toBe(
        'Polygon'
    )
})
