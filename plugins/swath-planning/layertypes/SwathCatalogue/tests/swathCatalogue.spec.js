/**
 * SwathCatalogue layer type — unit tests (`npm run test:plugins:unit`).
 *
 * `source.fetch` is a plain async function, so the paged POST is testable here
 * with a stubbed `window.fetch`. Drawing is Vector's and is an E2E concern.
 */
import { test, expect } from '@playwright/test'
import '../../../../../tests/helpers/browser-globals.js'
import SwathCatalogue from '../swathCatalogue.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const polygon = (x) => ({
    type: 'Feature',
    properties: { swath_id: `SW-${x}` },
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [x, 0],
                [x + 1, 0],
                [x + 1, 1],
                [x, 1],
                [x, 0],
            ],
        ],
    },
})

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('swathcatalogue')
    expect(manifest.extends).toBe('vector')
    expect(manifest.capabilities.defaultAttachments.swath_look).toBeTruthy()
    expect(
        manifest.capabilities.defaultInteractions.click['swath:conflicts']
    ).toBeTruthy()
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(SwathCatalogue)) expect(SURFACES).toContain(key)
})

test('fetch POSTs the viewport bbox and follows every page @unit', async () => {
    const calls = []
    const original = window.fetch
    window.fetch = async (url, opts) => {
        const body = JSON.parse(opts.body)
        calls.push({ url, method: opts.method, body })
        return {
            ok: true,
            json: async () => ({
                pages: 3,
                features: [polygon(body.page)],
            }),
        }
    }
    try {
        const result = await SwathCatalogue.source.fetch(
            { name: 'Swaths', variables: { swathCatalogue: { pageSize: 25 } } },
            {
                trigger: 'view',
                dynamicExtent: true,
                view: { minx: -10, miny: -5, maxx: 10, maxy: 5 },
            }
        )
        expect(calls.length).toBe(3)
        expect(calls[0].method).toBe('POST')
        expect(calls[0].body.bbox).toEqual([-10, -5, 10, 5])
        expect(calls[0].body.pageSize).toBe(25)
        expect(calls.map((c) => c.body.page)).toEqual([0, 1, 2])
        expect(result.features.length).toBe(3)
        // The seam: the conflict count the interaction and styling read.
        expect(result.features[0].properties.conflicts).toBe(1)
    } finally {
        window.fetch = original
    }
})

test('the type defaults dynamicExtent on, since its source is viewport-bound @unit', async () => {
    const layerObj = await SwathCatalogue.config.expand({ name: 'Swaths' })
    expect(layerObj.variables.dynamicExtent).toBe(true)
    const opted = await SwathCatalogue.config.expand({
        name: 'Swaths',
        variables: { dynamicExtent: false },
    })
    expect(opted.variables.dynamicExtent).toBe(false)
})
