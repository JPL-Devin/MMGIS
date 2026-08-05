/**
 * LookDirection attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import LookDirection, { lookDirectionGeojson } from '../lookDirection.js'
import {
    convergenceAngle,
    stereoMetrics,
    indexFeatures,
    pairsFor,
    bboxesOverlap,
} from '../stereoGeometry.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const footprint = (id, ring, props) => ({
    type: 'Feature',
    id,
    properties: props,
    geometry: { type: 'Polygon', coordinates: [ring] },
})

const square = (x, y, s = 1) => [
    [x, y],
    [x + s, y],
    [x + s, y + s],
    [x, y + s],
    [x, y],
]

const view = (emission, azimuth, incidence = 45) => ({
    emission_angle: emission,
    sub_spacecraft_azimuth: azimuth,
    incidence_angle: incidence,
})

const collection = (...features) => ({ type: 'FeatureCollection', features })

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('look_direction')
    expect(manifest.configPath).toBe('variables.layerAttachments.lookDirection')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves and exports make @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
    expect(typeof LookDirection.make).toBe('function')
    expect(typeof LookDirection.syncData).toBe('function')
})

test('a look direction is derived per footprint with geometry @unit', () => {
    const { collection: out, index } = lookDirectionGeojson(
        collection(
            footprint('a', square(0, 0), view(20, 90)),
            footprint('b', square(0, 0), view(20, 270)),
            footprint('nogeom', square(5, 5), { name: 'no angles' })
        ),
        {}
    )
    expect(out.features.length).toBe(2)
    expect(index.length).toBe(2)
    expect(out.features[0].geometry.type).toBe('Polygon') // wedge
    expect(out.features[0].properties._lookAzimuth).toBe(90)
})

test('style: line draws a bearing line instead of a wedge @unit', () => {
    const { collection: out } = lookDirectionGeojson(
        collection(footprint('a', square(0, 0), view(20, 45))),
        { style: 'line', lengthDeg: 0.5 }
    )
    expect(out.features[0].geometry.type).toBe('LineString')
    const [start, end] = out.features[0].geometry.coordinates
    expect(end[0]).toBeGreaterThan(start[0]) // NE bearing
    expect(end[1]).toBeGreaterThan(start[1])
})

test('convergence angle is the separation of the two look directions @unit', () => {
    // Same emission, opposite azimuths → 2x the emission angle.
    expect(
        convergenceAngle({ emission: 20, azimuth: 90 }, { emission: 20, azimuth: 270 })
    ).toBeCloseTo(40, 6)
    // Identical geometry → no convergence, so no stereo.
    expect(
        convergenceAngle({ emission: 20, azimuth: 90 }, { emission: 20, azimuth: 90 })
    ).toBeCloseTo(0, 6)
})

test('a usable pair needs convergence in range and comparable illumination @unit', () => {
    const a = { emission: 10, azimuth: 90, incidence: 45 }
    const b = { emission: 10, azimuth: 270, incidence: 45 }
    expect(stereoMetrics(a, b).usable).toBe(true) // 20 deg convergence
    // Too little convergence.
    expect(stereoMetrics(a, { ...a }).usable).toBe(false)
    // Convergence fine, illumination wildly different.
    expect(stereoMetrics(a, { ...b, incidence: 85 }).usable).toBe(false)
})

test('pairsFor only returns overlapping footprints @unit', () => {
    const features = collection(
        footprint('origin', square(0, 0), view(10, 90)),
        footprint('overlapping', square(0.5, 0.5), view(10, 270)),
        footprint('elsewhere', square(40, 40), view(10, 270))
    )
    const index = indexFeatures(features)
    const origin = index[0]
    const pairs = pairsFor(origin, index)
    expect(pairs.map((p) => p.record.id)).toEqual(['overlapping'])
    expect(bboxesOverlap(index[0].bbox, index[2].bbox)).toBe(false)
})
