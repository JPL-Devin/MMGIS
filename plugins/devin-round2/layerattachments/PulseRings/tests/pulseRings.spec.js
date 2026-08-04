/**
 * PulseRings attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import PulseRings, {
    pointsOf,
    normalizeConfig,
    ringFrame,
} from '../pulseRings.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('pulse_rings')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.pulseRings')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports the operations it overrides @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof PulseRings.make).toBe('function')
    expect(typeof PulseRings.syncData).toBe('function')
    expect(typeof PulseRings.onConfigChange).toBe('function')
    expect(typeof PulseRings.destroy).toBe('function')
})

test('pointsOf keeps only Point features and flips [lng,lat] to [lat,lng] @unit', () => {
    const geojson = {
        features: [
            { geometry: { type: 'Point', coordinates: [10, 20] } },
            { geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
            { geometry: { type: 'Point', coordinates: [-5, 42] } },
        ],
    }
    expect(pointsOf(geojson)).toEqual([[20, 10], [42, -5]])
    expect(pointsOf(null)).toEqual([])
})

test('normalizeConfig fills sane defaults and rejects bad values @unit', () => {
    expect(normalizeConfig(null)).toEqual({
        color: '#4fd0ff',
        maxRadiusMeters: 30000,
        periodMs: 2500,
        count: 3,
    })
    const custom = normalizeConfig({
        color: '#f00',
        maxRadiusMeters: -1, // invalid → default
        periodMs: 1000,
        count: 2.9, // floored
    })
    expect(custom.color).toBe('#f00')
    expect(custom.maxRadiusMeters).toBe(30000)
    expect(custom.periodMs).toBe(1000)
    expect(custom.count).toBe(2)
})

test('ringFrame expands radius and fades opacity across the period @unit', () => {
    const tuned = { periodMs: 1000, maxRadiusMeters: 100 }
    const start = ringFrame(0, 0, tuned)
    const mid = ringFrame(500, 0, tuned)
    const nearEnd = ringFrame(999, 0, tuned)
    expect(start.radius).toBeCloseTo(0, 5)
    expect(start.opacity).toBeCloseTo(1, 5)
    expect(mid.radius).toBeCloseTo(50, 5)
    expect(mid.opacity).toBeCloseTo(0.5, 5)
    expect(nearEnd.radius).toBeGreaterThan(mid.radius)
    expect(nearEnd.opacity).toBeLessThan(mid.opacity)
    // The stagger offset shifts phase; the loop wraps cleanly.
    expect(ringFrame(0, 0.5, tuned).radius).toBeCloseTo(50, 5)
})
