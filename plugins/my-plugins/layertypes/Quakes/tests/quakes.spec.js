/**
 * Quakes layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * Quakes is a thin `extends: vector` type: it ships no render module of its own
 * (it inherits Vector's `map`), and declares a single `module` exporting only
 * the non-render surfaces it differs on (source/time/legend). So the contract
 * to assert here is the manifest identity + that its declared `module` resolves.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extends-vector layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('quakes')
    expect(manifest.extends).toBe('vector')
    // The renderer is inherited, so no own render module is declared.
    expect(manifest.module).toBe('./quakes')
    expect(manifest.capabilities.time).toBe(true)
})

test('every declared module resolves to a file @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})
