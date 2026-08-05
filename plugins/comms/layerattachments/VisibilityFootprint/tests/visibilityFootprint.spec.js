/**
 * VisibilityFootprint attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import VisibilityFootprint, {
    resolveAltitudeMeters,
} from '../visibilityFootprint.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('visibility_footprint')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.visibilityFootprint')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof VisibilityFootprint.make).toBe('function')
    expect(typeof VisibilityFootprint.syncData).toBe('function')
})

test('the orbit altitude comes from the named track layer @unit', () => {
    const layersData = {
        'Orbiter Track': { variables: { altitudeMeters: 250000 } },
    }
    expect(
        resolveAltitudeMeters({ trackLayerName: 'Orbiter Track' }, layersData)
    ).toBe(250000)
    // Falls back to the attachment's own setting, then to a default.
    expect(resolveAltitudeMeters({ altitudeMeters: 300000 }, layersData)).toBe(
        300000
    )
    expect(resolveAltitudeMeters({}, undefined)).toBe(400000)
})
