/**
 * Radargram layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`, or by path:
 *   npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test \
 *       plugins/r6-litho/layertypes/Radargram/tests/
 *
 * `globe/lithosphere.js` imports `L_`, so it cannot be imported here; the depth
 * maths it shares with the attachment and the interaction lives in
 * `lib/radargram.js`, which imports nothing, and that is what is covered.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import {
    depthFromTwoWayTime,
    depthToImageFraction,
    nearestTrace,
    probe,
    settingsOf,
} from '../lib/radargram.js'

const manifest = manifestOf(__dirname)

const track = {
    geometry: {
        type: 'LineString',
        coordinates: [
            [0, 0],
            [1, 0],
            [2, 0],
        ],
    },
    properties: { twt_ns: [100, 200, 300], radargram_url: 'a.png' },
}

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('radargram')
    expect(manifest.extends).toBe('vector')
    // Globe-first: the only renderer this type ships is LithoSphere's, and the
    // map/Cesium renderers come from the parent.
    expect(manifest.capabilities.renderers.globe.engines).toEqual([
        'lithosphere',
    ])
    expect(manifest.modules.globe.lithosphere).toBeDefined()
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the siblings it ships are declared, with their settings @unit', () => {
    // The seam: the property names and the depth are facts this type knows, so
    // it declares them rather than the attachment or interaction guessing.
    const attachment =
        manifest.capabilities.defaultAttachments.subsurface_interfaces
    expect(attachment.depthProp).toBe('depth_m')
    expect(attachment.maxDepthMeters).toBe(
        manifest.capabilities.defaultInteractions.click['radar:depth:probe']
            .maxDepthMeters
    )
})

test('depth from two-way travel time @unit', () => {
    // 100 ns two-way in ice (eps 3.15): 100 * 0.29979 / (2 * sqrt(3.15))
    expect(depthFromTwoWayTime(100, 3.15)).toBeCloseTo(8.4453, 3)
    // In vacuum it is exactly half the one-way distance.
    expect(depthFromTwoWayTime(100, 1)).toBeCloseTo(14.9896, 3)
    expect(Number.isNaN(depthFromTwoWayTime(100, 0))).toBe(true)
})

test('depth maps into the radargram image the curtain hangs @unit', () => {
    expect(depthToImageFraction(1500, 3000)).toBe(0.5)
    expect(depthToImageFraction(0, 3000)).toBe(0)
})

test('the nearest trace to a click @unit', () => {
    const t = nearestTrace(track.geometry.coordinates, { lng: 1.9, lat: 0.1 })
    expect(t.index).toBe(2)
    expect(t.alongTrack).toBe(1)
    expect(nearestTrace([], { lng: 0, lat: 0 })).toBe(null)
    expect(nearestTrace(track.geometry.coordinates, null)).toBe(null)
})

test('a probe reads the per-trace travel time @unit', () => {
    const result = probe(track, { lng: 1.1, lat: 0 }, { maxDepthMeters: 3000 })
    expect(result.traceIndex).toBe(1)
    expect(result.twtNs).toBe(200)
    expect(result.depthMeters).toBeCloseTo(16.89, 1)
    expect(result.estimated).toBe(false)
})

test('a probe with no travel time says so rather than lying @unit', () => {
    const bare = { geometry: track.geometry, properties: {} }
    const result = probe(bare, { lng: 0, lat: 0 }, { maxDepthMeters: 3000 })
    expect(result.estimated).toBe(true)
    expect(result.depthMeters).toBe(3000)
    expect(probe({ properties: {} }, { lng: 0, lat: 0 }, null)).toBe(null)
})

test('settings default where they are read, not in the form @unit', () => {
    expect(settingsOf({}).maxDepthMeters).toBe(3000)
    expect(settingsOf({ variables: { radargram: { maxDepthMeters: '50' } } }))
        .toMatchObject({ maxDepthMeters: 50, imageProp: 'radargram_url' })
})
