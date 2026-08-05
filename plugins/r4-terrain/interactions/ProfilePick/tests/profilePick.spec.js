/**
 * ProfilePick interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 * `use(ctx)` takes a plain object, so most of the interaction is testable here:
 * hand it a fake ctx and assert what it wrote to the shared store and ctx.state.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ProfilePick from '../ProfilePick.js'
import store from '../../../lib/profileStore.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('profile:pick')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(manifest.applicableLayerTypes).toContain('terrainprofile')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('use() tolerates an event with no feature @unit', () => {
    store.clear()
    const ctx = { eventType: 'click', feature: null, state: {}, stop: false }
    ProfilePick.use(ctx)
    expect(ctx.stop).toBe(false)
    expect(store.endpoints.length).toBe(0)
})

test('clicking two point features records two endpoints @unit', () => {
    store.clear()
    const click = (lng, lat) =>
        ProfilePick.use({
            eventType: 'click',
            feature: { geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} },
            layerName: 'pts',
            event: { latlng: { lat, lng } },
            state: {},
            stop: false,
        })
    click(1, 1)
    click(2, 2)
    expect(store.endpoints.length).toBe(2)
    expect(store.endpoints[0]).toMatchObject({ lat: 1, lng: 1 })
    expect(store.endpoints[1]).toMatchObject({ lat: 2, lng: 2 })
})

test('a third point pick keeps only the two most recent @unit', () => {
    store.clear()
    for (const [lng, lat] of [[1, 1], [2, 2], [3, 3]])
        ProfilePick.use({
            eventType: 'click',
            feature: { geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} },
            layerName: 'pts',
            event: { latlng: { lat, lng } },
            state: {},
            stop: false,
        })
    expect(store.endpoints.map((p) => p.lat)).toEqual([2, 3])
})

test('clicking a LineString feature shares the whole line @unit', () => {
    store.clear()
    const ctx = {
        eventType: 'click',
        feature: {
            geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
            properties: {},
        },
        layerName: 'profileLine',
        state: {},
        stop: false,
    }
    ProfilePick.use(ctx)
    expect(store.line).not.toBeNull()
    expect(store.line._layerName).toBe('profileLine')
    expect(ctx.state.terrainProfileLine).toBe('profileLine')
})
