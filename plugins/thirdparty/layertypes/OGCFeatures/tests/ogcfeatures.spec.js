import { test, expect } from '@playwright/test'

import manifest from '../plugin.json'
import { __test } from '../ogcfeatures'

const { itemsUrl, normalize, resolveUrl, expand } = __test

test.describe('OGCFeatures layer type', () => {
    test('manifest inherits vector and declares one module', () => {
        expect(manifest.type).toBe('layertype')
        expect(manifest.typeId).toBe('ogcfeatures')
        expect(manifest.extends).toBe('vector')
        expect(manifest.module).toBe('./ogcfeatures')
        expect(manifest.modules).toBeUndefined()
    })

    test('a collection url becomes a GeoJSON items request', () => {
        const url = itemsUrl('https://demo.pygeoapi.io/master/collections/lakes', {
            variables: { ogcapi: { limit: 50 } },
        })
        expect(url).toBe(
            'https://demo.pygeoapi.io/master/collections/lakes/items?f=json&limit=50'
        )
    })

    test('limit/bbox/datetime/filter are passed through, author params win', () => {
        const url = itemsUrl(
            'https://host/ogcapi/collections/x/items?limit=5&sortby=id',
            {
                variables: {
                    ogcapi: {
                        limit: 1000,
                        bbox: '-10,-10,10,10',
                        datetime: '2020-01-01/2021-01-01',
                        filter: "name='a'",
                    },
                },
            }
        )
        expect(url).toContain('limit=5')
        expect(url).not.toContain('limit=1000')
        expect(url).toContain('sortby=id')
        expect(url).toContain('bbox=-10%2C-10%2C10%2C10')
        expect(url).toContain('datetime=2020-01-01%2F2021-01-01')
        expect(url).toContain("filter=name%3D'a'")
    })

    test('normalize defaults the page size', () => {
        const layerObj = normalize({ type: 'ogcfeatures' })
        expect(layerObj.variables.ogcapi.limit).toBe(1000)
    })

    test('resolveUrl is idempotent on an items url', () => {
        const once = resolveUrl('https://host/ogcapi/collections/x', {})
        expect(resolveUrl(once, {})).toBe(once)
    })

    test('expand turns a landing page into a header of collections', async () => {
        const original = globalThis.fetch
        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: async () => ({
                collections: [
                    { id: 'lakes', title: 'Large Lakes' },
                    { id: 'obs', title: 'Observations' },
                ],
            }),
        })
        try {
            const expanded = await expand({
                type: 'ogcfeatures',
                url: 'https://host/ogcapi',
                uuid: 'u',
                name: 'u',
            })
            expect(expanded.type).toBe('header')
            expect(expanded.sublayers.length).toBe(2)
            expect(expanded.sublayers[0].url).toBe(
                'https://host/ogcapi/collections/lakes'
            )
            expect(expanded.sublayers[0].type).toBe('ogcfeatures')
            expect(expanded.sublayers[1].display_name).toBe('Observations')
        } finally {
            globalThis.fetch = original
        }
    })

    test('a collection url is not expanded', async () => {
        const layerObj = {
            type: 'ogcfeatures',
            url: 'https://host/ogcapi/collections/lakes',
        }
        expect(await expand(layerObj)).toBe(layerObj)
    })
})
