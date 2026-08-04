/**
 * Overpass layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`. The module is imported directly: it
 * declares only `source`/`config`, so it pulls in no MMGIS singleton and needs
 * no browser.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { __test } from '../overpass.js'

const manifest = manifestOf(__dirname)
const { buildQuery, tileBBoxes, osmToGeoJSON, normalize, fetch } = __test

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('overpass')
    expect(manifest.extends).toBe('vector')
    // One file, no renderer of its own: everything drawn is inherited.
    expect(manifest.module).toBe('./overpass')
    expect(manifest.modules).toBeUndefined()
})

test('every declared module resolves to a file @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the POST body binds {{bbox}} and the settings line @unit', () => {
    const query = buildQuery(
        {
            variables: {
                overpass: {
                    query: 'nwr["amenity"="cafe"]({{bbox}});',
                    timeout: 90,
                },
            },
        },
        '1,2,3,4'
    )
    expect(query).toContain('[out:json][timeout:90];')
    expect(query).toContain('nwr["amenity"="cafe"](1,2,3,4);')
    expect(query).toContain('out tags geom qt;')
    expect(query).not.toContain('{{bbox}}')
})

test('the view becomes an Overpass south,west,north,east bbox @unit', () => {
    const [bbox] = tileBBoxes(
        { minx: -105.5, miny: 39.5, maxx: -104.5, maxy: 40.5 },
        1
    )
    expect(bbox).toBe('39.500000,-105.500000,40.500000,-104.500000')
})

test('tiles split the view into an NxN grid, no view means the world @unit', () => {
    expect(tileBBoxes({ minx: 0, miny: 0, maxx: 2, maxy: 2 }, 2).length).toBe(4)
    expect(tileBBoxes(null, 4)).toEqual(['-90,-180,90,180'])
})

test('OSM JSON becomes points, lines, polygons and relations @unit', () => {
    const features = osmToGeoJSON([
        { type: 'node', id: 1, lat: 40, lon: -105, tags: { natural: 'peak' } },
        {
            type: 'way',
            id: 2,
            tags: { highway: 'track' },
            geometry: [
                { lat: 0, lon: 0 },
                { lat: 1, lon: 1 },
            ],
        },
        {
            type: 'way',
            id: 3,
            tags: { building: 'yes' },
            geometry: [
                { lat: 0, lon: 0 },
                { lat: 0, lon: 1 },
                { lat: 1, lon: 1 },
                { lat: 0, lon: 0 },
            ],
        },
        {
            type: 'relation',
            id: 4,
            tags: { type: 'route' },
            members: [
                {
                    geometry: [
                        { lat: 0, lon: 0 },
                        { lat: 2, lon: 2 },
                    ],
                },
            ],
        },
    ])
    expect(features.map((f) => f.geometry.type)).toEqual([
        'Point',
        'LineString',
        'Polygon',
        'MultiLineString',
    ])
    expect(features[0].geometry.coordinates).toEqual([-105, 40])
    expect(features[0].properties).toEqual({
        osm_id: 1,
        osm_type: 'node',
        natural: 'peak',
    })
})

test('a closed way that is not area-tagged stays a line @unit', () => {
    const [feature] = osmToGeoJSON([
        {
            type: 'way',
            id: 5,
            tags: { highway: 'residential' },
            geometry: [
                { lat: 0, lon: 0 },
                { lat: 0, lon: 1 },
                { lat: 1, lon: 1 },
                { lat: 0, lon: 0 },
            ],
        },
    ])
    expect(feature.geometry.type).toBe('LineString')
})

test('fetch POSTs once per tile and dedupes shared features @unit', async () => {
    const calls = []
    const original = global.window
    global.window = {
        fetch: async (url, init) => {
            calls.push({ url, init })
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    elements: [
                        {
                            type: 'node',
                            id: 7,
                            lat: 1,
                            lon: 1,
                            tags: { natural: 'peak' },
                        },
                    ],
                }),
            }
        },
    }
    try {
        const geojson = await fetch(
            {
                url: 'https://overpass.example/api/interpreter',
                variables: { overpass: { query: 'nwr({{bbox}});', tiles: 2 } },
            },
            { view: { minx: 0, miny: 0, maxx: 2, maxy: 2 }, trigger: 'view' }
        )
        expect(calls.length).toBe(4)
        expect(calls[0].init.method).toBe('POST')
        expect(calls[0].init.headers['Content-Type']).toBe(
            'application/x-www-form-urlencoded'
        )
        expect(calls[0].init.body.startsWith('data=')).toBe(true)
        // The same node came back from all four tiles.
        expect(geojson.type).toBe('FeatureCollection')
        expect(geojson.features.length).toBe(1)
    } finally {
        global.window = original
    }
})

test('configured headers reach the request @unit', async () => {
    let seen = null
    const original = global.window
    global.window = {
        fetch: async (url, init) => {
            seen = init.headers
            return { ok: true, status: 200, json: async () => ({ elements: [] }) }
        },
    }
    try {
        await fetch(
            {
                variables: {
                    overpass: { headers: { Authorization: 'Bearer t' } },
                },
            },
            {}
        )
        expect(seen.Authorization).toBe('Bearer t')
    } finally {
        global.window = original
    }
})

test('a rate-limited Overpass throws a legible error @unit', async () => {
    const original = global.window
    global.window = {
        fetch: async () => ({ ok: false, status: 429, statusText: 'Too Many Requests' }),
    }
    try {
        await expect(fetch({}, {})).rejects.toThrow(/rate-limiting/)
    } finally {
        global.window = original
    }
})

test('normalize supplies a query and a visible style @unit', () => {
    const layerObj = normalize({ type: 'overpass' })
    expect(layerObj.variables.overpass.query).toContain('{{bbox}}')
    expect(layerObj.variables.overpass.tiles).toBe(1)
    expect(layerObj.style.color).toBe('#e8590c')
})
