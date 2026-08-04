/**
 * ClipboardCopy interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ClipboardCopy, { render } from '../ClipboardCopy.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const feature = (properties, coordinates) => ({
    type: 'Feature',
    properties,
    geometry: { type: 'Point', coordinates },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('clipboard:copy')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(manifest.configPath).toBe('variables.interactions.clipboardCopy')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('use() tolerates an event with no feature @unit', () => {
    const ctx = { eventType: 'click', feature: null, state: {}, stop: false }
    ClipboardCopy.use(ctx)
    expect(ctx.stop).toBe(false)
})

test('use() is a no-op when the layer has no config subtree @unit', () => {
    const ctx = {
        eventType: 'click',
        feature: feature({ name: 'Bradbury' }, [1, 2]),
        layerName: 'Waypoints',
        state: {},
    }
    ClipboardCopy.use(ctx)
    expect(ctx.state.clipboardCopyText).toBeUndefined()
})

test('render() fills property tokens and coordinate built-ins @unit', () => {
    const ctx = {
        feature: feature({ name: 'Bradbury', meta: { sol: 42 } }, [
            137.441123, -4.5895,
        ]),
        layerName: 'Waypoints',
    }
    expect(render('{name} sol {meta.sol} @ {lat},{lng} [{layer}]', ctx, 3)).toBe(
        'Bradbury sol 42 @ -4.590,137.441 [Waypoints]'
    )
})

test('render() collapses unknown tokens to empty @unit', () => {
    const ctx = { feature: feature({ name: 'A' }, [0, 0]) }
    expect(render('{name}{nope}', ctx, 5)).toBe('A')
})

test('use() writes the rendered text to ctx.state @unit', () => {
    const ctx = {
        eventType: 'click',
        feature: feature({ id: 'W-7' }, [10, 20]),
        layerName: 'Waypoints',
        config: { template: '{id}', notify: false },
        state: {},
    }
    ClipboardCopy.use(ctx)
    expect(ctx.state.clipboardCopyText).toBe('W-7')
})

test('use() accumulates a selection when appendToSelection is set @unit', () => {
    const config = { template: '{id}', appendToSelection: true, notify: false }
    const state = {}
    ClipboardCopy.use({
        eventType: 'click',
        feature: feature({ id: 'A' }, [0, 0]),
        config,
        state,
    })
    ClipboardCopy.use({
        eventType: 'click',
        feature: feature({ id: 'B' }, [0, 0]),
        config,
        state,
    })
    expect(state.clipboardCopySelection).toEqual(['A', 'B'])
    expect(state.clipboardCopyText).toBe('A\nB')
})
