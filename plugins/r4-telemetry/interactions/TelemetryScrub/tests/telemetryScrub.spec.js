/**
 * TelemetryScrub interaction — unit tests.
 *
 * `use(ctx)` touches TimeControl and F_ (browser singletons), so the testable
 * logic lives in lib/scrub.js and is exercised directly. A no-feature call is
 * asserted safe via the module itself.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import TelemetryScrub from '../TelemetryScrub.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { readFeatureTime, computeScrubWindow } from '../lib/scrub.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('telemetry:scrub')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableLayerTypes).toContain('telemetry')
    // Every config field must sit inside the declared configPath.
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('use() tolerates an event with no feature @unit', () => {
    const ctx = { eventType: 'click', feature: null, state: {}, stop: false }
    TelemetryScrub.use(ctx)
    expect(ctx.stop).toBe(false)
    expect(ctx.state.telemetryScrubbedTo).toBeUndefined()
})

test('readFeatureTime reads the configured timestamp property @unit', () => {
    const f = { properties: { t: '2021-06-01T12:00:00Z' } }
    expect(readFeatureTime(f, null, 't')).toBe(Date.parse('2021-06-01T12:00:00Z'))
    expect(readFeatureTime({ properties: {} }, null, 't')).toBeNull()
})

test('computeScrubWindow centers the window on the timestamp @unit', () => {
    const ts = Date.parse('2021-06-01T12:00:00Z')
    const w = computeScrubWindow(
        '2021-06-01T00:00:00Z', // 24h window
        '2021-06-02T00:00:00Z',
        ts,
        'center'
    )
    expect(w.currentTime).toBe('2021-06-01T12:00:00Z')
    // 24h window centered on noon => 06-01 00:00 .. 06-02 00:00
    expect(w.start).toBe('2021-06-01T00:00:00Z')
    expect(w.end).toBe('2021-06-02T00:00:00Z')
})

test('computeScrubWindow endAt mode makes a trailing window @unit', () => {
    const ts = Date.parse('2021-06-01T12:00:00Z')
    const w = computeScrubWindow(
        '2021-06-01T11:00:00Z', // 1h window
        '2021-06-01T12:00:00Z',
        ts,
        'endAt'
    )
    expect(w.end).toBe('2021-06-01T12:00:00Z')
    expect(w.start).toBe('2021-06-01T11:00:00Z')
})
