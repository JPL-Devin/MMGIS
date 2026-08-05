/**
 * RoverTraverse layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag is what selects these;
 * `npm run test:unit` only covers `tests/unit`). Behavior against a real map
 * belongs in an E2E spec — see plugins/core/layertypes/Vector/tests/.
 *
 * A layertype module imports MMGIS singletons, which need a browser, so these
 * tests assert the contract rather than importing `map.js`.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import traverse from '../traverse.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('traverse')
    // It draws like vector; that is the whole point of extending.
    expect(manifest.extends).toBe('vector')
    // The click behaviour is wired through a default interaction.
    expect(manifest.capabilities.defaultInteractions.click).toContain(
        'traverse:step'
    )
    // Extending vector, it ships only the surface it differs on: config.
    expect(manifest.module).toBe('./traverse')
})

test('config.normalize fills traverse defaults and pre-wires the attachment @unit', () => {
    const out = traverse.normalize({ type: 'traverse' })
    expect(out.variables.traverse.solProp).toBe('sol')
    // orderProp defaults to the sol property when blank.
    expect(out.variables.traverse.orderProp).toBe('sol')
    // The companion attachment is turned on so the type is useful immediately.
    expect(out.variables.layerAttachments.waypointSol.enabled).toBe(true)
})

test('config.normalize respects author overrides and opt-out @unit', () => {
    const out = traverse.normalize({
        type: 'traverse',
        variables: {
            traverse: { solProp: 'sol_number', orderProp: 'seq' },
            layerAttachments: { waypointSol: { enabled: false } },
        },
    })
    expect(out.variables.traverse.solProp).toBe('sol_number')
    expect(out.variables.traverse.orderProp).toBe('seq')
    expect(out.variables.layerAttachments.waypointSol.enabled).toBe(false)
})

test('every declared module resolves to a file @unit', () => {
    // Fails after renaming a module file or adding a `modules` key without
    // re-running `npm run plugins -- activate`.
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})
