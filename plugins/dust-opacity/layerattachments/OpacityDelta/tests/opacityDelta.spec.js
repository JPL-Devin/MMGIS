/**
 * OpacityDelta attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import OpacityDelta, { deltaColor } from '../opacityDelta.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('opacity_delta')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.opacityDelta')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof OpacityDelta.make).toBe('function')
})

test('it only offers itself to the layer type that produces the delta @unit', () => {
    expect(manifest.applicableLayerTypes).toEqual(['dustopacitycompare'])
})

test('the ramp diverges about zero and greys an unmatched site @unit', () => {
    expect(deltaColor(0, 1)).toBe('rgb(247,247,247)')
    expect(deltaColor(1, 1)).toBe('rgb(178,24,43)')
    expect(deltaColor(-1, 1)).toBe('rgb(33,102,172)')
    expect(deltaColor(null, 1)).toBe('#888888')
})

test('make draws one marker per point feature and is not shown when told not to be @unit', () => {
    const geojson = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [1, 2] },
                properties: { dust_delta: 0.3 },
            },
            {
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [] },
                properties: {},
            },
        ],
    }
    const markers = []
    window.L = {
        circleMarker: (latlng, options) => {
            markers.push({ latlng, options })
            return { latlng, options }
        },
        layerGroup: (layers) => ({ layers }),
    }

    const attachment = OpacityDelta.make({
        geojson,
        config: { initialVisibility: false, deltaProp: 'dust_delta', scale: 10 },
    })
    expect(attachment.type).toBe('opacity_delta')
    expect(attachment.on).toBe(false)
    expect(markers).toHaveLength(1)
    expect(markers[0].latlng).toEqual([2, 1])
    // The largest delta gets the full extra radius.
    expect(markers[0].options.radius).toBeCloseTo(13)
})
