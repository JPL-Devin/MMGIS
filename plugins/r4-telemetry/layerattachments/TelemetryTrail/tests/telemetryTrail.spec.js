/**
 * TelemetryTrail attachment — unit tests.
 *
 * The module imports cleanly (Leaflet and TimeControl are read off the window
 * per call, never imported), so the contract and the pure trail/fade helpers
 * are tested here. A live map / real fade over the playhead belongs in E2E.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import TelemetryTrail from '../telemetryTrail.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { timedPoints, fadeOpacity } from '../lib/fade.js'

const manifest = manifestOf(__dirname)

const fc = (times) => ({
    type: 'FeatureCollection',
    features: times.map((t) => ({
        type: 'Feature',
        properties: t == null ? {} : { t },
        geometry: { type: 'Point', coordinates: [t ? 1 : 0, 2] },
    })),
})

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('telemetry_trail')
    expect(manifest.configPath).toBe('variables.layerAttachments.telemetryTrail')
    expect(manifest.applicableLayerTypes).toContain('telemetry')
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof TelemetryTrail.make).toBe('function')
    expect(typeof TelemetryTrail.destroy).toBe('function')
})

test('timedPoints sorts point features ascending by time @unit', () => {
    const pts = timedPoints(
        fc(['2020-01-03T00:00:00Z', '2020-01-01T00:00:00Z', '2020-01-02T00:00:00Z']),
        null,
        't'
    )
    expect(pts.map((p) => p.feature.properties.t)).toEqual([
        '2020-01-01T00:00:00Z',
        '2020-01-02T00:00:00Z',
        '2020-01-03T00:00:00Z',
    ])
})

test('fadeOpacity fades linearly behind the playhead @unit', () => {
    const playhead = Date.parse('2020-01-01T01:00:00Z')
    const fadeMs = 3600 * 1000 // 1h
    // at the playhead => full opacity
    expect(fadeOpacity(playhead, playhead, fadeMs, 0.1)).toBe(1)
    // future of the playhead => full opacity
    expect(fadeOpacity(playhead + 1000, playhead, fadeMs, 0.1)).toBe(1)
    // half the fade window old => halfway to min
    const half = fadeOpacity(playhead - fadeMs / 2, playhead, fadeMs, 0.1)
    expect(half).toBeCloseTo(0.55, 5)
    // beyond the fade window => min opacity
    expect(fadeOpacity(playhead - 2 * fadeMs, playhead, fadeMs, 0.1)).toBe(0.1)
    // untimed => full opacity
    expect(fadeOpacity(null, playhead, fadeMs, 0.1)).toBe(1)
})
