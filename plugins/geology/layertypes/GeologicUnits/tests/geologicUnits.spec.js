/**
 * GeologicUnits layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 * Behavior against a real map — the derived legend actually colouring polygons —
 * belongs in an E2E spec; here we cover the manifest contract and the pure
 * legend derivation in lib/unitLegend.js.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import GeologicUnits from '../geologicUnits.js'
import { buildUnitLegend, colorForCode } from '../lib/unitLegend.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('geologicunits')
    // Inheritance is one level: 'vector' must be a type that does not itself
    // extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the type ships its sibling plugins as capability defaults @unit', () => {
    // The seam: the type is the plugin that knows what its attachment/interaction
    // should be, so it declares them rather than an admin wiring three plugins.
    expect(manifest.capabilities.defaultInteractions.click).toContain(
        'contact:units'
    )
    expect(manifest.capabilities.defaultAttachments).toHaveProperty(
        'contact_ticks'
    )
    // ...and hands the attachment the property names it needs, once.
    expect(manifest.capabilities.defaultAttachments.contact_ticks.strikeProp).toBe(
        'strike'
    )
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(GeologicUnits)) expect(SURFACES).toContain(key)
    expect(typeof GeologicUnits.legend.derive).toBe('function')
})

test('the legend is derived from the distinct unit codes in the data @unit', () => {
    const features = [
        { properties: { unit: 'Jm' } },
        { properties: { unit: 'Jm' } },
        { properties: { unit: 'Kb' } },
        { properties: {} },
        { properties: { unit: '' } },
    ]
    const legend = buildUnitLegend(features, { unitProp: 'unit' })
    expect(legend.map((e) => e.value)).toEqual(['Jm', 'Kb'])
    // styleMatching is what lets the legend colour features with no configured
    // style — each entry names the property it matches on.
    expect(legend[0]).toMatchObject({
        styleMatching: true,
        propertyName: 'unit',
        propertyValue: 'Jm',
    })
    // Deterministic: same code, same colour.
    expect(legend[0].color).toBe(colorForCode('Jm'))
})

test('a custom unit property is honoured, and no codes means no legend @unit', () => {
    expect(
        buildUnitLegend([{ properties: { code: 'A' } }], { unitProp: 'code' }).map(
            (e) => e.value
        )
    ).toEqual(['A'])
    expect(buildUnitLegend([], { unitProp: 'unit' })).toEqual([])
})
