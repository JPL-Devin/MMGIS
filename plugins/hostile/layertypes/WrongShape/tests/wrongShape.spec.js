/**
 * WrongShape layer type — unit tests.
 *
 * Documents what a source surface is *allowed* to return as far as anything
 * static can tell: nothing checks the shape, so this test only pins that the
 * module is a source surface and that fetch resolves to whatever it likes.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import WrongShape from '../wrongShape.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('wrongshape')
    expect(manifest.extends).toBe('vector')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('source.fetch may resolve to a non-FeatureCollection unchecked @unit', async () => {
    expect(typeof WrongShape.source.fetch).toBe('function')
    const out = await WrongShape.source.fetch()
    // Neither the manifest contract nor the module contract rejects this.
    expect(out.type).toBeUndefined()
    expect(Array.isArray(out.features)).toBe(false)
})
