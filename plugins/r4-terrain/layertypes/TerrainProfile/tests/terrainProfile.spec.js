/**
 * TerrainProfile layer type — unit tests.
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

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('terrainprofile')
    // TerrainProfile `extends` vector, so the map renderer and the Cesium globe
    // renderer are inherited and are NOT in this manifest — only the LithoSphere
    // globe module is overridden here. `npm run plugins -- validate` cross-checks
    // the *effective* (merged) type; this test only asserts what this plugin
    // declares itself. (The scaffolded version of this test does not understand
    // `extends` and fails for an inheriting type — see the report.)
    expect(manifest.extends).toBe('vector')
    const modules = manifest.modules || (manifest.module ? { map: manifest.module } : {})
    expect(modules.globe?.lithosphere).toBeDefined()
})

test('every declared module resolves to a file @unit', () => {
    // Fails after renaming a module file or adding a `modules` key without
    // re-running `npm run plugins -- activate`.
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})
