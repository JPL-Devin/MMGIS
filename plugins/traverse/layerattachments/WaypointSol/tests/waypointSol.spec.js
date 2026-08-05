/**
 * WaypointSol attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import WaypointSol, { orderWaypoints, bearing } from '../waypointSol.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('waypoint_sol')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.waypointSol')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof WaypointSol.make).toBe('function')
})

test('orderWaypoints sorts by the order property, not file order @unit', () => {
    const geojson = {
        features: [
            { geometry: { type: 'Point', coordinates: [0, 0] }, properties: { sol: 3 } },
            { geometry: { type: 'Point', coordinates: [1, 1] }, properties: { sol: 1 } },
            { geometry: { type: 'LineString', coordinates: [] }, properties: { sol: 2 } },
            { geometry: { type: 'Point', coordinates: [2, 2] }, properties: { sol: 2 } },
        ],
    }
    const ordered = orderWaypoints(geojson, 'sol')
    // Non-point dropped; points ascending by sol.
    expect(ordered.map((w) => w.feature.properties.sol)).toEqual([1, 2, 3])
})

test('bearing is ~0 due north and ~90 due east @unit', () => {
    expect(Math.round(bearing([0, 0], [0, 1]))).toBe(0)
    expect(Math.round(bearing([0, 0], [1, 0]))).toBe(90)
})
