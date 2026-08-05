/**
 * DepotCapacity attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import DepotCapacity from '../depotCapacity.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('depot_capacity')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.depotCapacity')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof DepotCapacity.make).toBe('function')
})

test('it hosts only the depot type it was written for @unit', () => {
    expect(manifest.applicableLayerTypes).toEqual(['sampledepot'])
})

test('rings are sized by capacity and coloured by fill @unit', () => {
    const circles = []
    window.L = {
        circle: (latlng, options) => {
            circles.push({ latlng, options })
            return { latlng, options }
        },
        layerGroup: (layers) => ({ layers }),
    }

    const attachment = DepotCapacity.make({
        geojson: {
            features: [
                {
                    geometry: { type: 'Point', coordinates: [1, 2] },
                    properties: { capacity: 10, fillRatio: 0.1 },
                },
                {
                    geometry: { type: 'LineString', coordinates: [] },
                    properties: {},
                },
            ],
        },
        config: { metersPerTube: 5 },
    })

    expect(attachment.type).toBe('depot_capacity')
    expect(attachment.on).toBe(true)
    // only the point feature got a ring
    expect(circles).toHaveLength(1)
    expect(circles[0].latlng).toEqual([2, 1])
    expect(circles[0].options.radius).toBe(50)
    expect(circles[0].options.color).toBe('#d7191c')
})
