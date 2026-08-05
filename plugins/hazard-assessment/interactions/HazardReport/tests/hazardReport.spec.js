/**
 * HazardReport interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit`. These import `logic.js`, not
 * `HazardReport.js`: the handler imports `L_`, so it cannot be imported in Node.
 * Clicking a real point is an E2E test.
 */
import { test, expect } from '@playwright/test'
import { collectBuffers, pointOf, report } from '../logic.js'
import { bufferOf } from '../../../lib/hazardGeometry.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const hazard = (severity, hazardClass, center = [0, 0]) => ({
    type: 'Feature',
    properties: { severity, hazard_class: hazardClass, id: hazardClass },
    geometry: { type: 'Polygon', coordinates: [[center]] },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('hazard:report')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    // Every configured field must sit inside the declared configPath.
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature and no latlng reports nothing @unit', () => {
    expect(pointOf(null, undefined)).toBe(null)
    expect(report(null, [])).toBe(null)
})

test('buffers are read off what the attachment left on its host @unit', () => {
    const attachments = {
        Hazards: {
            hazard_buffer: {
                type: 'hazard_buffer',
                _buffers: [bufferOf(hazard(1, 'crater_rim'), {})],
            },
        },
        // A layer with no hazard buffers must be skipped, not crash.
        Basemap: { labels: {} },
    }
    const buffers = collectBuffers(attachments, [])
    expect(buffers).toHaveLength(1)
    expect(buffers[0].layerName).toBe('Hazards')

    expect(collectBuffers(attachments, ['Other'])).toEqual([])
})

test('a point inside a buffer is reported with its distance to the edge @unit', () => {
    const buffers = collectBuffers(
        {
            Hazards: {
                hazard_buffer: {
                    _buffers: [bufferOf(hazard(1, 'crater_rim'), {})],
                },
            },
        },
        []
    )
    // crater_rim at severity 1 is a 300 m keep-out around a degenerate polygon.
    const inside = report([0, 0.001], buffers)
    expect(inside.safe).toBe(false)
    expect(inside.inside).toHaveLength(1)
    expect(inside.nearest.distanceToEdgeMeters).toBeLessThan(0)
    expect(inside.text).toContain('crater_rim')

    const outside = report([0, 0.01], buffers)
    expect(outside.safe).toBe(true)
    expect(outside.inside).toEqual([])
    expect(Math.round(outside.nearest.distanceToEdgeMeters)).toBeGreaterThan(0)
})
