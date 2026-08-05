/**
 * NextCommWindow interaction — unit tests (`npm run test:plugins:unit`).
 * These import `logic.js`, not the handler, which imports L_/TimeControl.
 */
import { test, expect } from '@playwright/test'
import { decide, nearestAsset } from '../logic.js'
import { syntheticTrack, footprintRadiusMeters } from '../../../shared/comms.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('comms:next_window')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(manifest.applicableLayerTypes).toEqual(['groundtrack'])
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature or no asset decides nothing @unit', () => {
    expect(decide(null, null, { name: 'a', coord: [0, 0] })).toBe(null)
    expect(decide({ properties: {} }, null, null)).toBe(null)
})

test('the footprint radius grows as the elevation mask relaxes @unit', () => {
    expect(footprintRadiusMeters(400000, 5)).toBeGreaterThan(
        footprintRadiusMeters(400000, 30)
    )
    expect(footprintRadiusMeters(0, 10)).toBe(0)
})

test('nearestAsset picks the closest point @unit', () => {
    const assets = [
        { name: 'A', coord: [0, 0] },
        { name: 'B', coord: [10, 10] },
    ]
    expect(nearestAsset(assets, { lng: 9, lat: 9 }).name).toBe('B')
    expect(nearestAsset([], { lng: 0, lat: 0 })).toBe(null)
})

test('a pass over an asset under the track yields a window @unit', () => {
    const startMs = Date.parse('2030-01-01T00:00:00Z')
    const track = syntheticTrack({ startMs, durationSec: 7000, stepSec: 30 })
    const feature = track.features[0]
    // Put the asset directly under one of the track's own samples.
    const i = Math.floor(feature.geometry.coordinates.length / 2)
    const asset = { name: 'Lander', coord: feature.geometry.coordinates[i] }

    const result = decide(feature, { elevationMaskDeg: 10 }, asset, {
        nowMs: startMs,
        altitudeMeters: 400000,
    })
    expect(result).not.toBe(null)
    expect(result.assetName).toBe('Lander')
    expect(result.endMs).toBeGreaterThan(result.startMs)
    expect(result.durationSec).toBeGreaterThan(0)
    expect(result.radiusMeters).toBeGreaterThan(0)
})

test('a window already finished is skipped @unit', () => {
    const startMs = Date.parse('2030-01-01T00:00:00Z')
    const track = syntheticTrack({ startMs, durationSec: 7000, stepSec: 30 })
    const feature = track.features[0]
    const i = 5
    const asset = { name: 'Lander', coord: feature.geometry.coordinates[i] }
    const late = decide(feature, { elevationMaskDeg: 10 }, asset, {
        nowMs: startMs + 6000 * 1000,
        altitudeMeters: 400000,
    })
    // Either the next pass, or nothing — but never the one that already ended.
    if (late != null) expect(late.endMs).toBeGreaterThanOrEqual(startMs + 6000 * 1000)
})
