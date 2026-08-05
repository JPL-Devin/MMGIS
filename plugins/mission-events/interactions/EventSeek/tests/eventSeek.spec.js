/**
 * EventSeek interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * These import `logic.js`, not `EventSeek.js`: as soon as the handler imports a
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
    expect(manifest.interactionId).toBe('event:seek')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature decides nothing @unit', () => {
    // The pipeline runs for events that carry no feature, so this is the case
    // that breaks an interaction in the field.
    expect(decide(null, null, null)).toBe(null)
})

test('the seek window comes from the layer-configured time properties @unit', () => {
    const feature = {
        properties: { t0: '2024-01-01T00:10:00Z', t1: '2024-01-01T00:20:00Z' },
    }
    const layerData = { time: { startProp: 't0', endProp: 't1' } }

    expect(decide(feature, layerData, { padSec: 60 })).toEqual({
        startTime: '2024-01-01T00:09:00.000Z',
        endTime: '2024-01-01T00:21:00.000Z',
        currentTime: '2024-01-01T00:10:00.000Z',
    })

    // An unconfigured layer has no time props, and an untouched form has no
    // padSec — both default in the plugin, not in the manifest.
    expect(decide(feature, null, null)).toBe(null)
})
