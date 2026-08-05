/**
 * RadarDepthProbe interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * These import `logic.js`, not `RadarDepthProbe.js`: as soon as the handler imports a
 * singleton (`@basics/Layers_/Layers_`, jQuery, Leaflet) it can no longer be
 * imported in Node, so the decisions live in a module that imports nothing and
 * the handler stays too thin to be worth testing here. Clicking a real feature
 * is an E2E test (`tests/e2e/`).
 */
import { test, expect } from '@playwright/test'
import { decide } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('radar:depth:probe')
    // Every form field must sit inside configPath or it is written where the
    // runner never looks.
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

const track = {
    geometry: {
        type: 'LineString',
        coordinates: [
            [0, 0],
            [1, 0],
        ],
    },
    properties: { twt_ns: [100, 400] },
}

test('an event with no feature decides nothing @unit', () => {
    // The pipeline runs for events that carry no feature, so this is the case
    // that breaks an interaction in the field.
    expect(decide(null, null, null)).toBe(null)
    expect(decide(track, null, null)).toBe(null)
})

test('a click reports the depth at the nearest trace @unit', () => {
    const result = decide(track, { lng: 0.9, lat: 0 }, null)
    expect(result.probe.traceIndex).toBe(1)
    expect(result.probe.depthMeters).toBeCloseTo(33.78, 1)
    expect(result.message).toContain('400 ns two-way')
})

test('settings are defaulted where they are read @unit', () => {
    // No config at all is the normal case until an admin opens the form, and
    // the layer type's defaultInteractions settings arrive the same way.
    const vacuum = decide(track, { lng: 0, lat: 0 }, { dielectric: 1 })
    expect(vacuum.probe.depthMeters).toBeCloseTo(14.99, 2)
    const ice = decide(track, { lng: 0, lat: 0 }, null)
    expect(ice.probe.depthMeters).toBeLessThan(vacuum.probe.depthMeters)
})
