/**
 * PropertyBubbles attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import PropertyBubbles from '../propertyBubbles.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('property_bubbles')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.propertyBubbles')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof PropertyBubbles.make).toBe('function')
})

// browser-globals deliberately leaves window.L undefined; a unit test that
// exercises make has to bring its own.
window.L = {
    circleMarker: (latlng, options) => ({
        latlng,
        options,
        bindTooltip() {},
        setStyle(s) {
            Object.assign(this.options, s)
        },
        setRadius(r) {
            this.options.radius = r
        },
    }),
    layerGroup: (layers) => ({
        _layers: [...layers],
        getLayers() {
            return this._layers
        },
        clearLayers() {
            this._layers = []
        },
        addLayer(l) {
            this._layers.push(l)
        },
        eachLayer(fn) {
            this._layers.forEach(fn)
        },
    }),
}

const geojson = {
    features: [
        { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { abundance: 0 } },
        { geometry: { type: 'Point', coordinates: [1, 1] }, properties: { abundance: 10 } },
        { geometry: { type: 'Point', coordinates: [2, 2] }, properties: { abundance: 'n/a' } },
    ],
}

const config = { property: 'abundance', minRadius: 4, maxRadius: 20 }

test('make bubbles only features with a numeric value, scaled across the range @unit', () => {
    const attachment = PropertyBubbles.make({ geojson, config })
    const radii = attachment.layer.getLayers().map((l) => l.options.radius)
    expect(radii).toEqual([4, 20])
    expect(attachment.type).toBe('property_bubbles')
})

test('onConfigChange retunes in place without rebuilding @unit', () => {
    const attachment = PropertyBubbles.make({ geojson, config })
    const before = attachment.layer.getLayers()
    PropertyBubbles.onConfigChange({
        attachment,
        prevConfig: config,
        config: { ...config, maxRadius: 40 },
    })
    const after = attachment.layer.getLayers()
    // Same marker objects — restyled, not recreated.
    expect(after[0]).toBe(before[0])
    expect(after.map((l) => l.options.radius)).toEqual([4, 40])
})

test('onConfigChange rebuilds its own layer when the property changes @unit', () => {
    const attachment = PropertyBubbles.make({ geojson, config })
    PropertyBubbles.onConfigChange({
        attachment,
        prevConfig: config,
        config: { ...config, property: 'missing' },
    })
    expect(attachment.layer.getLayers()).toEqual([])
})
