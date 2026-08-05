/**
 * Sonify interaction — unit tests. Run:
 *   npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/demo/interactions/Sonify/tests/
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import Sonify, { readProperty, normalize, toHz, toPan } from '../Sonify.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const feature = (properties, coordinates = [90, 10]) => ({
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('sonify')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every config field sits under configPath @unit', () => {
    const fields = manifest.config.rows.flatMap((r) =>
        r.components.map((c) => c.field)
    )
    expect(fields.length).toBeGreaterThan(0)
    fields.forEach((f) => expect(f.startsWith(manifest.configPath)).toBe(true))
})

test('readProperty resolves dot paths and numeric strings @unit', () => {
    expect(readProperty(feature({ sol: 42 }), 'sol')).toBe(42)
    expect(readProperty(feature({ a: { b: '3.5' } }), 'a.b')).toBe(3.5)
    expect(readProperty(feature({ sol: 'abc' }), 'sol')).toBe(null)
    expect(readProperty(feature({ sol: 1 }), 'missing')).toBe(null)
    expect(readProperty(null, 'sol')).toBe(null)
})

test('normalize clamps and supports a log scale @unit', () => {
    expect(normalize(5, 0, 10, 'linear')).toBeCloseTo(0.5)
    expect(normalize(-5, 0, 10, 'linear')).toBe(0)
    expect(normalize(50, 0, 10, 'linear')).toBe(1)
    expect(normalize(1, 1, 1, 'linear')).toBe(0)
    expect(normalize(10, 1, 100, 'log')).toBeCloseTo(0.5)
})

test('toHz quantizes to the scale and rises monotonically @unit', () => {
    const base = 100
    expect(toHz(0, base)).toBeCloseTo(base)
    expect(toHz(1, base)).toBeCloseTo(base * 4) // two octaves up
    expect(toHz(0.5, base)).toBeGreaterThan(toHz(0.25, base))
    expect(toHz(null, base)).toBe(null)
})

test('toPan maps longitude into -1..1 and tolerates odd geometry @unit', () => {
    expect(toPan(feature({}, [0, 0]))).toBeCloseTo(0)
    expect(toPan(feature({}, [-180, 0]))).toBeCloseTo(-1)
    expect(toPan(feature({}, [[[10, 0]]]))).toBeCloseTo(0.0556, 3)
    expect(toPan({})).toBe(0)
})

test('use() records what it would play @unit', () => {
    const ctx = {
        eventType: 'click',
        feature: feature({ elevation: 500 }),
        config: { property: 'elevation', min: 0, max: 1000 },
        state: {},
        stop: false,
    }
    Sonify.use(ctx)
    expect(ctx.state.sonify.value).toBe(500)
    expect(ctx.state.sonify.hz).toBeGreaterThan(0)
    expect(ctx.stop).toBe(false)
})

test('use() tolerates an event with no feature or no config @unit', () => {
    const ctx = { eventType: 'click', feature: null, state: {}, stop: false }
    Sonify.use(ctx)
    expect(ctx.state.sonify).toBeUndefined()

    const ctx2 = {
        eventType: 'click',
        feature: feature({ elevation: 1 }),
        config: null,
        state: {},
        stop: false,
    }
    Sonify.use(ctx2)
    expect(ctx2.state.sonify).toBeUndefined()
    expect(ctx2.stop).toBe(false)
})
