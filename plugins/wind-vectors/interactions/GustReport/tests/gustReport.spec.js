/**
 * GustReport interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * These import `logic.js`, not `GustReport.js`: as soon as the handler imports a
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
    expect(manifest.interactionId).toBe('gust:report')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every dropdown of a property name asks Configure for the list @unit', () => {
    const propertyFields = ['speedProp', 'gustProp', 'stationIdProp']
    const components = manifest.config.rows.flatMap((r) => r.components)
    for (const field of propertyFields) {
        const com = components.find((c) =>
            c.field.endsWith(`.${field}`)
        )
        expect(com.optionsFrom).toBe('layerProperties')
        // A fallback for a layer Configure cannot sample.
        expect(com.options.length).toBeGreaterThan(0)
    }
    for (const com of components)
        expect(com.field.startsWith(manifest.configPath)).toBe(true)
})

test('an event with no feature decides nothing @unit', () => {
    // The pipeline runs for events that carry no feature, so this is the case
    // that breaks an interaction in the field.
    expect(decide(null, null)).toBe(null)
})

test('the configured property names are what is read @unit', () => {
    const feature = {
        properties: { spd: 12, gst: 31, sid: 'KSFO', wind_gust: 99 },
    }
    // Unconfigured, the container defaults are read — a different property.
    expect(decide(feature, null).gust).toBe(99)
    const config = {
        speedProp: 'spd',
        gustProp: 'gst',
        stationIdProp: 'sid',
    }
    expect(decide(feature, config)).toEqual({
        station: 'KSFO',
        gust: 31,
        message: 'Station KSFO: gusting 31 (sustained 12)',
    })
    // A threshold silences the quiet ones.
    expect(decide(feature, { ...config, gustThreshold: 40 })).toBe(null)
})

test('a field an admin cleared reaches the plugin as an empty string @unit', () => {
    const feature = { properties: { wind_speed: 5, wind_gust: 20, station_id: 'A' } }
    expect(decide(feature, { speedProp: '', gustProp: '', stationIdProp: '' })).toEqual({
        station: 'A',
        gust: 20,
        message: 'Station A: gusting 20 (sustained 5)',
    })
})
