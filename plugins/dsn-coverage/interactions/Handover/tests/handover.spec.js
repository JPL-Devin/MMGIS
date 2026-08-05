/**
 * Handover interaction — unit tests (`npm run test:plugins:unit`).
 *
 * `Handover.js` imports L_ and so cannot be imported in Node; the decisions live
 * in `logic.js` and the shared math in `../../../lib/coverage.js`.
 */
import { test, expect } from '@playwright/test'
import { handoversFor, summarize } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const station = (name, lng, lat, band = 'X', diameter = 34, mask = 10) => ({
    type: 'Feature',
    properties: {
        name,
        band,
        antenna_diameter_m: diameter,
        mask_elevation_deg: mask,
    },
    geometry: { type: 'Point', coordinates: [lng, lat] },
})

// Goldstone / Madrid / Canberra-ish: one near neighbour, one across the world.
const goldstone = station('Goldstone', -116.89, 35.43)
const barstow = station('Barstow', -117.02, 34.9, 'S', 70)
const canberra = station('Canberra', 148.98, -35.4)
const geojson = { type: 'FeatureCollection', features: [goldstone, barstow, canberra] }

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('dsn:handover')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableLayerTypes).toEqual(['groundstation'])
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature decides nothing @unit', () => {
    expect(handoversFor(null, geojson, null)).toBe(null)
})

test('overlapping stations are candidates, antipodal ones are not @unit', () => {
    const result = handoversFor(goldstone, geojson, null)
    expect(result.station.name).toBe('Goldstone')
    expect(result.candidates.map((c) => c.name)).toEqual(['Barstow'])
    expect(result.candidates[0].distanceKm).toBeGreaterThan(0)
    expect(result.candidates[0].overlapKm).toBeGreaterThan(0)
    expect(summarize(result)).toContain('Barstow')
})

test('same-band filtering drops a station on another band @unit', () => {
    const result = handoversFor(goldstone, geojson, { requireSameBand: true })
    expect(result.candidates).toEqual([])
    expect(summarize(result)).toContain('no station overlaps')
})

test('the layer type\'s property names reach the math @unit', () => {
    // The layer type normalizes these onto the layer; the handler passes them in.
    const renamed = {
        type: 'Feature',
        properties: { id: 'DSS-14', minEl: 10, dish: 70, rf: 'X' },
        geometry: { type: 'Point', coordinates: [-116.89, 35.43] },
    }
    const props = {
        nameProp: 'id',
        maskElevationProp: 'minEl',
        diameterProp: 'dish',
        bandProp: 'rf',
    }
    const result = handoversFor(renamed, geojson, null, props)
    expect(result.station.name).toBe('DSS-14')
    expect(result.station.diameterM).toBe(70)
})
