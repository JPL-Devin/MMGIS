/**
 * SampleTubes layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`. `source.fetch` is a plain async
 * function, so it is testable here with a stubbed `window.fetch`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import SampleTubes from '../sampleTubes.js'
import { tubesToGeoJSON, apiUrl } from '../../../lib/depotApi.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const ROW = {
    id: 4,
    depot_name: 'Three Forks',
    name: 'Amalik',
    sample_type: 'regolith',
    lng: 77.4,
    lat: 18.4,
    retrieved: false,
}

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('sampletubes')
    expect(manifest.extends).toBe('vector')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the type ships the interaction of its own container @unit', () => {
    // How the type → interaction seam is declared: the layer does not have to
    // name it, and the interaction's applicableLayerTypes names this typeId.
    expect(manifest.capabilities.defaultInteractions.click).toEqual([
        'tube:retrieve',
    ])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = [
        'source',
        'config',
        'filter',
        'time',
        'legend',
        'map',
        'globe',
    ]
    for (const key of Object.keys(SampleTubes)) expect(SURFACES).toContain(key)
})

test('tube rows become drawable point features @unit', () => {
    const gj = tubesToGeoJSON([ROW, { id: 5, lng: null, lat: 1 }])
    expect(gj.type).toBe('FeatureCollection')
    // The row with no location is dropped rather than drawn at 0,0.
    expect(gj.features.length).toBe(1)
    expect(gj.features[0].geometry.coordinates).toEqual([77.4, 18.4])
    // The properties the interaction reads and the legend styles by.
    expect(gj.features[0].properties.tube_id).toBe(4)
    expect(gj.features[0].properties.retrieved).toBe(false)
    expect(gj.features[0].properties.retrieved_state).toBe('onGround')
})

test('urls are built off ROOT_PATH, with no leading slash @unit', () => {
    const original = window.mmgisglobal
    window.mmgisglobal = { ROOT_PATH: '' }
    expect(apiUrl('tubes')).toBe('api/sampledepot/tubes')
    window.mmgisglobal = { ROOT_PATH: '/mmgis' }
    expect(apiUrl('tubes')).toBe('/mmgis/api/sampledepot/tubes')
    window.mmgisglobal = original
})

test('fetch returns the depot API rows as GeoJSON and derives a legend @unit', async () => {
    const original = window.fetch
    let requested = null
    window.fetch = async (url) => {
        requested = url
        return { ok: true, json: async () => ({ status: 'success', tubes: [ROW] }) }
    }
    try {
        const layerObj = { name: 'Tubes', variables: { depot: 'Three Forks' } }
        const result = await SampleTubes.source.fetch(layerObj, {
            url: '',
            trigger: 'make',
        })
        expect(requested).toContain('api/sampledepot/tubes?depot=Three%20Forks')
        expect(result.features.length).toBe(1)
        // The legend is derived from the data, in fetch, for derive() to report.
        expect(SampleTubes.legend.derive(layerObj)).toBe(true)
        expect(layerObj._legend.length).toBe(2)
    } finally {
        window.fetch = original
    }
})
