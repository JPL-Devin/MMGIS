/**
 * ContactTicks attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ContactTicks from '../contactTicks.js'
import {
    contactRenderables,
    dashForCertainty,
    tickEndpoints,
} from '../lib/contactGeometry.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('contact_ticks')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.contactTicks')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof ContactTicks.make).toBe('function')
    // syncData is overridden because our layer is derived ticks, not the host's
    // own features re-added.
    expect(typeof ContactTicks.syncData).toBe('function')
})

test('a certainty value chooses a dash pattern; anything else is solid @unit', () => {
    expect(dashForCertainty('approximate')).toBeTruthy()
    expect(dashForCertainty('Inferred')).toBeTruthy()
    expect(dashForCertainty('certain')).toBe(null)
    expect(dashForCertainty(undefined)).toBe(null)
})

test('a tick is centred and perpendicular to strike @unit', () => {
    // A due-east contact (strike 90) gets a north-south tick through its
    // middle vertex at [0,0].
    const coords = [
        [-1, 0],
        [0, 0],
        [1, 0],
    ]
    const [a, b] = tickEndpoints(coords, 90, 0.02)
    // Symmetric about the midpoint...
    expect(a[0] + b[0]).toBeCloseTo(0)
    expect(a[1] + b[1]).toBeCloseTo(0)
    // ...and oriented north-south (lng ~ unchanged, lat spread).
    expect(Math.abs(a[1] - b[1])).toBeCloseTo(0)
    expect(Math.abs(a[0] - b[0])).toBeCloseTo(0.02)
})

test('only line features produce renderables; each yields a line + a tick @unit', () => {
    const geojson = {
        type: 'FeatureCollection',
        features: [
            {
                geometry: {
                    type: 'LineString',
                    coordinates: [
                        [0, 0],
                        [1, 1],
                    ],
                },
                properties: { strike: 45, dip: 30, certainty: 'inferred' },
            },
            // A unit polygon shares the layer but gets no tick.
            {
                geometry: {
                    type: 'Polygon',
                    coordinates: [
                        [
                            [0, 0],
                            [1, 0],
                            [1, 1],
                            [0, 0],
                        ],
                    ],
                },
                properties: { unit: 'Jm' },
            },
        ],
    }
    const out = contactRenderables(geojson, {})
    expect(out.map((r) => r.type)).toEqual(['line', 'tick'])
    expect(out[0].dashArray).toBeTruthy() // inferred → dashed
    expect(out[1].tooltip).toContain('strike 45')
})
