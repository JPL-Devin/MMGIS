/**
 * Seismic layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 * `seismic.js` itself is importable in Node (it touches only `window.fetch`),
 * but the query building and FDSN normalisation live in `lib/usgs.js`, which is
 * what is asserted here.
 */
import { test, expect } from '@playwright/test'
import { buildQueryUrl, normalizeEvents } from '../lib/usgs.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('seismic')
    // Everything but the data source is inherited from vector.
    expect(manifest.extends).toBe('vector')
    expect(manifest.module).toBeDefined()
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the query is bounded by the view and the time window @unit', () => {
    const url = new URL(
        buildQueryUrl({
            view: { minx: -122.5, miny: 37.1, maxx: -121.5, maxy: 38.1 },
            time: { start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z' },
            minMagnitude: 3,
            limit: 250,
        })
    )
    expect(url.searchParams.get('format')).toBe('geojson')
    expect(url.searchParams.get('minlongitude')).toBe('-122.5')
    expect(url.searchParams.get('maxlatitude')).toBe('38.1')
    expect(url.searchParams.get('starttime')).toBe('2026-01-01T00:00:00Z')
    expect(url.searchParams.get('minmagnitude')).toBe('3')
    expect(url.searchParams.get('limit')).toBe('250')
})

test('a world-spanning view is clamped to valid FDSN bounds @unit', () => {
    const url = new URL(buildQueryUrl({ view: { minx: -400, miny: -200, maxx: 400, maxy: 200 } }))
    expect(url.searchParams.get('minlongitude')).toBe('-180')
    expect(url.searchParams.get('maxlatitude')).toBe('90')
})

test('FDSN events gain magnitude, depth and time properties @unit', () => {
    const out = normalizeEvents({
        features: [
            {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [-122, 37, 8.4] },
                properties: { mag: 4.2, place: 'somewhere', time: 1767225600000 },
            },
            { type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: {} },
        ],
    })

    expect(out.type).toBe('FeatureCollection')
    // Non-point events are dropped — the attachment and the rings are point-only.
    expect(out.features).toHaveLength(1)
    expect(out.features[0].properties.magnitude).toBe(4.2)
    expect(out.features[0].properties.depth_km).toBe(8.4)
    expect(out.features[0].properties.time_iso).toBe('2026-01-01T00:00:00.000Z')
})
