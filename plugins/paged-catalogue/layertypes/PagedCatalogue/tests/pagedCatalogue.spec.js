/**
 * PagedCatalogue layer type — unit tests.
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
import PagedCatalogue from '../pagedCatalogue.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('pagedcatalogue')
    // Inheritance is one level: 'vector' must be a type that does not
    // itself extend. Everything not declared here comes from it.
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    // A single `module` is keyed by surface — a `make` here would never run.
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(PagedCatalogue)) expect(SURFACES).toContain(key)
})

test('fetch pages, tags each feature with its page, and emits progressively @unit', async () => {
    const original = window.fetch
    let requested = 0
    // Two pages of one feature each; the server flags the last with next:false.
    window.fetch = async (url) => {
        const page = Number(new URL(url).searchParams.get('page'))
        requested++
        return {
            ok: true,
            json: async () => ({
                type: 'FeatureCollection',
                next: page < 1,
                features: [{ type: 'Feature', properties: { id: `f${page}` } }],
            }),
        }
    }
    const emits = []
    try {
        const result = await PagedCatalogue.source.fetch(
            { name: 'PagedCatalogue', variables: { pageSize: 1, maxPages: 8 } },
            {
                url: 'https://example.test/items',
                trigger: 'view',
                view: { minx: 0, miny: 0, maxx: 1, maxy: 1 },
                emit: (fc) => emits.push(fc),
            }
        )
        // Stopped at next:false — did not spin through all 8 maxPages.
        expect(requested).toBe(2)
        // Emitted once per page, each with everything so far (1 then 2).
        expect(emits.map((e) => e.features.length)).toEqual([1, 2])
        // Every feature carries the page it came from.
        expect(emits[1].features.map((f) => f.properties._page)).toEqual([0, 1])
        // Everything was emitted, so fetch returns null.
        expect(result).toBe(null)
    } finally {
        window.fetch = original
    }
})

test('config.normalize defaults dynamicExtent on and calls the inherited op @unit', () => {
    let inheritedCalled = false
    const layerObj = { name: 'x', variables: {} }
    PagedCatalogue.config.normalize(layerObj, () => {
        inheritedCalled = true
    })
    expect(inheritedCalled).toBe(true)
    expect(layerObj.variables.dynamicExtent).toBe(true)
})
