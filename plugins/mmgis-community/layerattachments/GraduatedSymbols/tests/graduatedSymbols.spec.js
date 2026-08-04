/**
 * GraduatedSymbols attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import GraduatedSymbols from '../graduatedSymbols.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('graduated_symbols')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.graduatedSymbols')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof GraduatedSymbols.make).toBe('function')
})

// browser-globals leaves window.L undefined on purpose, so stand up just enough
// of Leaflet's circleMarker/layerGroup to assert on what make() computes.
window.L = {
    circleMarker: (latlng, options) => ({
        latlng,
        options,
        bindTooltip(content) {
            this.tooltip = content
            return this
        },
        setTooltipContent(content) {
            this.tooltip = content
        },
        setStyle(style) {
            Object.assign(this.options, style)
        },
        setRadius(radius) {
            this.options.radius = radius
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
        addLayer(layer) {
            this._layers.push(layer)
        },
        eachLayer(fn) {
            this._layers.forEach(fn)
        },
    }),
}

const geojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { depth_m: 0 },
            geometry: { type: 'Point', coordinates: [0, 0] },
        },
        {
            type: 'Feature',
            properties: { depth_m: 100 },
            geometry: { type: 'Point', coordinates: [1, 1] },
        },
        {
            type: 'Feature',
            properties: { depth_m: 'not a number' },
            geometry: { type: 'Point', coordinates: [2, 2] },
        },
        {
            type: 'Feature',
            properties: { depth_m: 50 },
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
        },
    ],
}

const config = {
    enabled: true,
    property: 'depth_m',
    scale: 'linear',
    autoDomain: true,
    minRadius: 4,
    maxRadius: 20,
    breaks: [
        { value: 0, color: '#2c7bb6' },
        { value: 50, color: '#d7191c', label: 'deep' },
    ],
}

test('make symbolizes only point features with numeric values @unit', () => {
    const attachment = GraduatedSymbols.make({ geojson, config })

    expect(attachment.type).toBe('graduated_symbols')
    expect(attachment.on).toBe(true)
    // The non-numeric point and the LineString are skipped.
    expect(attachment.layer.getLayers().length).toBe(2)

    const radii = attachment.layer
        .getLayers()
        .map((m) => m.options.radius)
        .sort((a, b) => a - b)
    expect(radii).toEqual([4, 20])

    const fills = attachment.layer.getLayers().map((m) => m.options.fillColor)
    expect(fills).toEqual(['#2c7bb6', '#d7191c'])
})

test('make returns nothing to draw when the property is unset @unit', () => {
    const attachment = GraduatedSymbols.make({
        geojson,
        config: { ...config, property: undefined },
    })
    expect(attachment.layer.getLayers().length).toBe(0)
})

test('onConfigChange restyles in place instead of rebuilding @unit', () => {
    const attachment = GraduatedSymbols.make({ geojson, config })
    const markers = attachment.layer.getLayers()

    GraduatedSymbols.onConfigChange({
        attachment,
        config: { ...config, minRadius: 10, maxRadius: 30 },
        prevConfig: config,
    })

    // Same marker instances, new radii.
    expect(attachment.layer.getLayers()).toEqual(markers)
    const radii = markers.map((m) => m.options.radius).sort((a, b) => a - b)
    expect(radii).toEqual([10, 30])
})

test('syncData rebuilds from the new data @unit', () => {
    const attachment = GraduatedSymbols.make({ geojson, config })
    GraduatedSymbols.syncData(attachment, {
        geojson: { type: 'FeatureCollection', features: [geojson.features[0]] },
    })
    expect(attachment.layer.getLayers().length).toBe(1)
})
