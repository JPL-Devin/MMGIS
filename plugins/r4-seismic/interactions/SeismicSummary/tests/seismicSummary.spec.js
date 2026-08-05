/**
 * SeismicSummary interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 *
 * The handler itself is NOT imported here: it imports `L_` through the `@basics`
 * webpack alias, which Node cannot resolve (the scaffolded spec, which does
 * import the handler, only works for an interaction that touches no singleton).
 * The logic worth testing therefore lives in `lib/summary.js`.
 */
import { test, expect } from '@playwright/test'
import { temporalNeighbors, summaryHtml, eventId } from '../lib/summary.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const at = (minutes, id) => ({
    properties: { id, time: Date.parse('2026-01-01T00:00:00Z') + minutes * 60000 },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('seismic:summary')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(manifest.applicableLayerTypes).toContain('seismic')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    // Every settings field must sit inside configPath or the runner never reads it.
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
})

test('temporal neighbours are windowed, self-excluded and nearest-first @unit', () => {
    const target = at(0, 'a')
    const features = [target, at(5, 'b'), at(-30, 'c'), at(600, 'd'), { properties: {} }]

    const neighbors = temporalNeighbors(features, target, 60)

    expect(neighbors.map((n) => eventId(n.feature))).toEqual(['b', 'c'])
    expect(neighbors[0].dtMinutes).toBeCloseTo(5)
})

test('a summary reports magnitude, depth and the neighbour count @unit', () => {
    const feature = {
        properties: {
            id: 'a',
            title: 'M 5.2 - somewhere',
            magnitude: 5.21,
            depth_km: 12.34,
            time: Date.parse('2026-01-01T00:00:00Z'),
        },
    }
    const html = summaryHtml(feature, temporalNeighbors([feature, at(5, 'b')], feature, 60), 60)

    expect(html).toContain('5.2')
    expect(html).toContain('12.3 km')
    expect(html).toContain('1 other event')
})
