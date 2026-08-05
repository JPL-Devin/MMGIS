/**
 * ContactUnits interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * These import `logic.js`, not `ContactUnits.js`: as soon as the handler imports a
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
    expect(manifest.interactionId).toBe('contact:units')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    // The type ships this in its defaultInteractions, so it must accept it.
    expect(manifest.applicableLayerTypes).toContain('geologicunits')
    // Every configured field must sit under configPath, or it is written where
    // the runner never looks.
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature, or no named units, decides nothing @unit', () => {
    // The pipeline runs for events that carry no feature, so this is the case
    // that breaks an interaction in the field.
    expect(decide(null, null)).toBe(null)
    expect(decide({ properties: { other: 1 } }, null)).toBe(null)
})

test('it names both units, defaulting the property names @unit', () => {
    const feature = { properties: { unit_left: 'Jm', unit_right: 'Kb' } }
    expect(decide(feature, null)).toEqual({
        left: 'Jm',
        right: 'Kb',
        label: 'Contact between Jm and Kb',
    })
})

test('custom property names are honoured; one missing side is marked @unit', () => {
    const feature = { properties: { west: 'A' } }
    expect(decide(feature, { leftProp: 'west', rightProp: 'east' })).toEqual({
        left: 'A',
        right: null,
        label: 'Contact between A and ?',
    })
})
