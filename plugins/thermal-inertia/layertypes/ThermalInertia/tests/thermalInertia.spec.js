/**
 * ThermalInertia layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 *
 * The point this file proves is the one the round asked for: overriding ONE
 * operation of the parent's `config` surface must not drop the parent's other
 * config operations. It exercises the real core merge function
 * (`typeInheritance.mergeSurfaces`, what LayerTypeRegistry.get uses), so it is a
 * genuine check rather than a re-implementation. A full runtime check needs the
 * browser (Vector's own config module imports jQuery) — see the report.
 */
import { test, expect } from '@playwright/test'
import '../../../../../tests/helpers/browser-globals.js'
import ThermalInertia from '../thermalInertia.js'
import { mergeSurfaces } from '../../../../../src/essence/Basics/Layers_/registry/typeInheritance.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('declares a one-level extending layertype whose modules resolve @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('thermalinertia')
    expect(manifest.extends).toBe('vector')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(ThermalInertia)) expect(SURFACES).toContain(key)
    // It overrides exactly one operation of exactly one surface.
    expect(Object.keys(ThermalInertia)).toEqual(['config'])
    expect(Object.keys(ThermalInertia.config)).toEqual(['normalize'])
    expect(typeof ThermalInertia.config.normalize).toBe('function')
})

test('overriding config.normalize keeps the parent config.expand @unit', () => {
    // Stand-ins for vector's two config operations.
    const parentExpand = () => 'parent-expand'
    const parentNormalize = () => 'parent-normalize'
    const parent = { config: { expand: parentExpand, normalize: parentNormalize } }

    const effective = mergeSurfaces(parent, ThermalInertia)

    // Our normalize won…
    expect(effective.config.normalize).toBe(ThermalInertia.config.normalize)
    expect(effective.config.normalize).not.toBe(parentNormalize)
    // …and the sibling we never declared survives untouched.
    expect(effective.config.expand).toBe(parentExpand)
})

test('normalize re-sets the vector defaults it replaces @unit', () => {
    // Overriding an operation replaces it wholesale (no super-call), so the
    // type must re-establish kind/radius that vector.normalize would have.
    const out = ThermalInertia.config.normalize({})
    expect(out.kind).toBe('none')
    expect(out.radius).toBe(6)
    expect(ThermalInertia.config.normalize({ radius: 20 }).radius).toBe(20)
})

test('the manifest hands the day/night props to its siblings @unit', () => {
    // The seam: the property names live once here, and core resolves them into
    // the attachment's / interaction's own configPath.
    const da = manifest.capabilities.defaultAttachments.thermal_shade
    expect(da.dayTempProp).toBe('temp_day')
    expect(da.nightTempProp).toBe('temp_night')
    const di = manifest.capabilities.defaultInteractions.click['thermal:explain']
    expect(di.dayTempProp).toBe('temp_day')
    expect(di.nightTempProp).toBe('temp_night')
})
