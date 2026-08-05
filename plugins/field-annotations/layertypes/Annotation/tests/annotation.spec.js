/**
 * Annotation layer type — unit tests.
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
import '../../../../../tests/helpers/browser-globals.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { styleAnnotations } from '../lib/pure.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('annotation')
    // Everything but the data source is inherited from vector.
    expect(manifest.extends).toBe('vector')
    expect(manifest.module).toBeDefined()
})

test('every declared module resolves to a file @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('fetched annotations get a per-feature style @unit', () => {
    const out = styleAnnotations(
        { features: [{ properties: { note: 'a' } }] },
        '#ff0000'
    )
    expect(out.type).toBe('FeatureCollection')
    expect(out.features[0].properties.style.color).toBe('#ff0000')
    expect(out.features[0].properties.note).toBe('a')
    expect(styleAnnotations(null, '#fff').features).toEqual([])
})
