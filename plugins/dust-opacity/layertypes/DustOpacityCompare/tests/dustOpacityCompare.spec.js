/**
 * DustOpacityCompare layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag is what selects these;
 * `npm run test:unit` only covers `tests/unit`). Behavior against a real map
 * belongs in an E2E spec — see plugins/core/layertypes/Vector/tests/.
 *
 * A type that extends declares surfaces rather than a renderer, and `fetch` is a
 * plain async function, so it is testable here with a stubbed `window.fetch`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import DustOpacityCompare from '../dustOpacityCompare.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('dustopacitycompare')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(DustOpacityCompare)) expect(SURFACES).toContain(key)
})

const point = (id, value) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [0, 0] },
    properties: { site_id: id, opacity: value },
})

const stubFetch = (byUrl) => {
    const original = window.fetch
    window.fetch = async (url) => ({
        ok: true,
        json: async () => byUrl[String(url)],
    })
    return () => {
        window.fetch = original
    }
}

test('fetch acquires both datasets itself and returns one joined collection @unit', async () => {
    const restore = stubFetch({
        'https://example.test/predicted': {
            type: 'FeatureCollection',
            features: [point('A', 0.4)],
        },
        'https://example.test/observed': {
            type: 'FeatureCollection',
            features: [point('A', 0.7)],
        },
    })
    try {
        const layerObj = {
            name: 'Dust',
            variables: { dustOpacity: { observedUrl: 'https://example.test/observed' } },
        }
        const result = await DustOpacityCompare.source.fetch(layerObj, {
            url: 'https://example.test/predicted',
            trigger: 'make',
        })
        expect(result.features).toHaveLength(1)
        expect(result.features[0].properties.dust_delta).toBeCloseTo(0.3)
        // The legend surface is handed the config, not the data, so fetch
        // stashes the scale on the layer for `derive` to read.
        expect(layerObj._dustDeltaRange[1]).toBeCloseTo(0.3)
    } finally {
        restore()
    }
})

test('fetch returns null rather than half a comparison when the observed url is missing @unit', async () => {
    const result = await DustOpacityCompare.source.fetch(
        { name: 'Dust', variables: {} },
        { url: 'https://example.test/predicted', trigger: 'make' }
    )
    expect(result).toBe(null)
})

test('the type ships its attachment rather than an admin configuring it twice @unit', () => {
    expect(manifest.capabilities.defaultAttachments.opacity_delta.deltaProp).toBe('dust_delta')
})

test('legend.derive reports nothing to derive before a fetch @unit', () => {
    expect(DustOpacityCompare.legend.derive({ name: 'Dust' })).toBe(false)
})
