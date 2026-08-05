/**
 * SwathLook attachment — unit tests (`npm run test:plugins:unit`).
 *
 * The module reads `window.L` per call, so a tiny Leaflet stub is enough to
 * exercise `make`/`syncData` in Node.
 */
import { test, expect } from '@playwright/test'
import '../../../../../tests/helpers/browser-globals.js'
import SwathLook from '../swathLook.js'
import { lookVector } from '../../../lib/swathGeometry.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const stubLeaflet = () => {
    const made = []
    window.L = {
        polyline: (latlngs, opts) => {
            const l = { latlngs, opts, bindTooltip: () => l }
            made.push(l)
            return l
        },
        layerGroup: (layers) => ({
            layers,
            clearLayers() {
                this.layers = []
            },
            addLayer(l) {
                this.layers.push(l)
            },
        }),
    }
    return made
}

const geojson = {
    type: 'FeatureCollection',
    features: [
        {
            type: 'Feature',
            properties: { look_azimuth: 0, roll_deg: -12, look_direction: 'left' },
            geometry: {
                type: 'Polygon',
                coordinates: [
                    [
                        [0, 0],
                        [2, 0],
                        [2, 2],
                        [0, 2],
                        [0, 0],
                    ],
                ],
            },
        },
    ],
}

test('plugin.json declares a valid attachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('swath_look')
    expect(manifest.configPath.startsWith('variables.')).toBe(true)
    expect(manifest.applicableLayerTypes).toContain('swathcatalogue')
    manifest.config.rows.forEach((r) =>
        r.components.forEach((c) =>
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
        )
    )
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('make draws one look arrow per swath @unit', () => {
    const made = stubLeaflet()
    const attachment = SwathLook.make({ geojson, config: {} })
    expect(attachment.type).toBe('swath_look')
    expect(attachment.on).toBe(true)
    expect(made.length).toBe(1)
    // Azimuth 0 looking left ⇒ the arrow points west of the swath centre.
    expect(made[0].latlngs[1][1]).toBeLessThan(made[0].latlngs[0][1])
})

test('syncData rebuilds the derived arrows rather than re-adding GeoJSON @unit', () => {
    stubLeaflet()
    const attachment = SwathLook.make({ geojson, config: {} })
    SwathLook.syncData(attachment, { geojson, config: {} })
    expect(attachment.layer.layers.length).toBe(1)
    SwathLook.syncData(attachment, { geojson, onlyClear: true })
    expect(attachment.layer.layers.length).toBe(0)
})

test('lookVector offsets 90° from the along-track azimuth @unit', () => {
    const right = lookVector([0, 0], 0, 1, 'right')
    const left = lookVector([0, 0], 0, 1, 'left')
    expect(right[0]).toBeGreaterThan(0)
    expect(left[0]).toBeLessThan(0)
})
