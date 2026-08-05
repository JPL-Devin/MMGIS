/**
 * HazardBuffer attachment — unit tests. Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import HazardBuffer from '../hazardBuffer.js'
import { bufferMetersFor, buffersOf } from '../../../lib/hazardGeometry.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const geojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { severity: 1, hazard_class: 'crater_rim' },
            geometry: { type: 'Polygon', coordinates: [[[0, 0]]] },
        },
        {
            type: 'Feature',
            properties: { severity: 0.5, hazard_class: 'slope' },
            geometry: { type: 'Polygon', coordinates: [[[1, 1]]] },
        },
    ],
}

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('hazard_buffer')
    expect(manifest.configPath).toBe('variables.layerAttachments.hazardBuffer')
    // Only the hazard layer type can host it, which is also what lets that type
    // declare it in capabilities.defaultAttachments.
    expect(manifest.applicableLayerTypes).toEqual(['hazardzone'])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof HazardBuffer.make).toBe('function')
})

test('the keep-out distance scales with severity and hazard class @unit', () => {
    const slope = { properties: { severity: 1, hazard_class: 'slope' } }
    const crater = { properties: { severity: 1, hazard_class: 'crater_rim' } }
    expect(bufferMetersFor(slope, {})).toBe(150)
    expect(bufferMetersFor(crater, {})).toBe(300)
    // Half the severity, half the keep-out.
    expect(
        bufferMetersFor({ properties: { severity: 0.5, hazard_class: 'slope' } }, {})
    ).toBe(75)
    // The property names come from the layer type through ctx.config.
    expect(
        bufferMetersFor(
            { properties: { sev: 1, hclass: 'crater_rim' } },
            { severityProp: 'sev', classProp: 'hclass' }
        )
    ).toBe(300)
    // Unknown class falls back rather than producing NaN.
    expect(
        bufferMetersFor({ properties: { severity: 1, hazard_class: 'dust' } }, {})
    ).toBe(100)
})

test('a buffer is the hazard extent grown by its keep-out distance @unit', () => {
    const buffers = buffersOf(geojson, {})
    expect(buffers).toHaveLength(2)
    expect(buffers[0].radiusMeters).toBe(300)
    expect(buffers[1].radiusMeters).toBe(75)
    // Zero-severity hazards draw nothing at all.
    expect(
        buffersOf(
            {
                features: [
                    {
                        properties: { severity: 0, hazard_class: 'slope' },
                        geometry: { type: 'Polygon', coordinates: [[[0, 0]]] },
                    },
                ],
            },
            {}
        )
    ).toEqual([])
})
