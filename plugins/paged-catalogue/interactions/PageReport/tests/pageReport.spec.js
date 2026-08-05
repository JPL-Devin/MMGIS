/**
 * PageReport interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * These import `logic.js`, not `PageReport.js`: as soon as the handler imports a
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
    expect(manifest.interactionId).toBe('page:report')
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
    expect(decide(null)).toBe(null)
})

test('a feature without a page stamp decides nothing @unit', () => {
    // Only PagedCatalogue's source.fetch stamps _page, so a plain vector
    // feature has nothing to report.
    expect(decide({ properties: { name: 'Crater' } })).toBe(null)
})

test('reports the page the clicked feature streamed in on @unit', () => {
    const feature = { properties: { name: 'item', _page: 3 } }
    expect(decide(feature)).toEqual({ page: 3, label: 'From page 3' })
    // page 0 is a real page, not "nothing"
    expect(decide({ properties: { _page: 0 } })).toEqual({
        page: 0,
        label: 'From page 0',
    })
})
