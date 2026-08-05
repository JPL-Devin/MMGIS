/**
 * StereoPairs interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import StereoPairs, { indexFor } from '../StereoPairs.js'
import LookDirection from '../../../layerattachments/LookDirection/lookDirection.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const footprint = (id, x, y, emission, azimuth) => ({
    type: 'Feature',
    id,
    properties: {
        emission_angle: emission,
        sub_spacecraft_azimuth: azimuth,
        incidence_angle: 45,
    },
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [x, y],
                [x + 1, y],
                [x + 1, y + 1],
                [x, y + 1],
                [x, y],
            ],
        ],
    },
})

const geojson = {
    type: 'FeatureCollection',
    features: [
        footprint('left', 0, 0, 15, 90),
        footprint('right', 0.5, 0.2, 15, 270), // 30 deg convergence, overlaps
        footprint('same_look', 0.4, 0.4, 15, 90), // overlaps, no convergence
        footprint('far', 40, 40, 15, 270), // right geometry, no overlap
    ],
}

/** A minimal L_ with one vector layer holding features, as the app would. */
function fakeApp({ withAttachment }) {
    const eachFeatureLayer = (cb) =>
        geojson.features.forEach((feature) => cb({ feature }))
    window.L_ = {
        layers: {
            layer: { Footprints: { eachLayer: eachFeatureLayer } },
            attachments: {},
        },
    }
    if (withAttachment) {
        // Leaflet stub: make() only needs geoJson() to return something.
        window.L = { geoJson: () => ({ clearLayers() {}, addData() {} }) }
        window.L_.layers.attachments.Footprints = {
            look_direction: LookDirection.make({ geojson, config: {} }),
        }
    }
}

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('stereo:pairs')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(manifest.applicableLayerTypes).toContain('imagefootprints')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('use() tolerates an event with no feature @unit', () => {
    const ctx = { eventType: 'click', feature: null, state: {}, stop: false }
    StereoPairs.use(ctx)
    expect(ctx.stop).toBe(false)
})

test('clicking a footprint finds only overlapping, converging partners @unit', () => {
    fakeApp({ withAttachment: false })
    const ctx = {
        eventType: 'click',
        layerName: 'Footprints',
        feature: geojson.features[0],
        layerVar: {},
        config: null,
        state: {},
        stop: false,
    }
    StereoPairs.use(ctx)
    expect(ctx.state.stereoPairs.pairs.map((p) => p.id)).toEqual(['right'])
    expect(ctx.state.stereoPairs.pairs[0].convergence).toBeCloseTo(30, 4)
    // No attachment configured, so the interaction had to do the work itself.
    expect(ctx.state.stereoPairs.indexSource).toBe('recomputed')
})

test('the attachment’s index is reused when the attachment is built @unit', () => {
    fakeApp({ withAttachment: true })
    const { index, source } = indexFor('Footprints')
    expect(source).toBe('attachment')
    expect(index.length).toBe(4)

    const ctx = {
        eventType: 'click',
        layerName: 'Footprints',
        feature: geojson.features[0],
        layerVar: {},
        config: { minConvergence: 5, maxConvergence: 35 },
        state: {},
        stop: false,
    }
    StereoPairs.use(ctx)
    expect(ctx.state.stereoPairs.indexSource).toBe('attachment')
    expect(ctx.state.stereoPairs.pairs.map((p) => p.id)).toEqual(['right'])
})
