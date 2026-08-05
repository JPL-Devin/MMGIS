/**
 * HazardReport interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). `use(ctx)` takes a plain
 * object, so most of an interaction is testable here: hand it a fake ctx and
 * assert what it does to `ctx.state` / `ctx.stop`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
// NOT `../HazardReport.js`: it imports L_, which pulls jQuery and cannot be
// imported in Node (the scaffolded import fails the moment the handler needs a
// singleton). The logic it calls lives in the container's lib, tested here.
import { collectZones, reportLines } from '../../../lib/hazardReport.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('hazard:report')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every settings field sits inside configPath @unit', () => {
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

const zoneFeature = {
    type: 'Feature',
    properties: { name: 'Scarp', severity: 'high' },
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [0, 0],
                [1, 0],
                [1, 1],
                [0, 1],
                [0, 0],
            ],
        ],
    },
}

test('collectZones picks up hazardzone layers and their buffers @unit', () => {
    const layersData = {
        Hazards: { type: 'hazardzone', display_name: 'Hazards' },
        Rovers: { type: 'vector' },
        'Hidden Hazards': { type: 'hazardzone', visibility: false },
    }
    const attachments = {
        Hazards: { hazard_buffer: { _bufferedFeatures: ['buffered'] } },
    }

    const zones = collectZones(
        layersData,
        (name) => (name.includes('Hazard') ? [zoneFeature] : []),
        (name) => attachments[name],
        { onlyVisible: true }
    )

    expect(zones).toHaveLength(1)
    expect(zones[0].layerName).toBe('Hazards')
    expect(zones[0].buffered).toBe('buffered')
})

test('reportLines says so when a feature is clear @unit', () => {
    expect(reportLines([], 'Rover')).toEqual([
        'Rover is clear of all hazard zones.',
    ])
    const lines = reportLines(
        [{ name: 'Scarp', severity: 'high', within: 'buffer', layerName: 'Hazards' }],
        'Rover'
    )
    expect(lines[0]).toContain('1 hazard zone:')
    expect(lines[1]).toContain('exclusion buffer')
})
