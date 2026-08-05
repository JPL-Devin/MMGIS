/**
 * StormMotion attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`). The module is imported for
 * real, so add tests for whatever `make` computes; anything needing a live map
 * belongs in an E2E spec.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import StormMotion, { arrowsOf } from '../stormMotion.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('storm_motion')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.stormMotion')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof StormMotion.make).toBe('function')
})

test('an arrow is drawn only for a feature with speed and heading @unit', () => {
    // A minimal Leaflet stand-in: the module reads window.L per call.
    const drawn = []
    window.L = {
        polyline: (latlngs, options) => ({ latlngs, options }),
        layerGroup: (layers) => ({ layers }),
    }
    const feature = (properties) => ({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
        properties,
    })
    const geojson = {
        features: [
            feature({ speed_kmh: 20, heading_deg: 45, intensity: 2 }),
            feature({}),
        ],
    }
    const arrows = arrowsOf(geojson, {
        props: {},
        scale: 1,
        color: '#fff',
        weight: 2,
    })
    // Two polylines (shaft + head) for the one feature that has a motion.
    expect(arrows.length).toBe(2)
    // Intensity thickens the arrow as well as lengthening it.
    expect(arrows[0].options.weight).toBe(4)
    void drawn
})
