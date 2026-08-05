/**
 * StormTrack interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 *
 * These import `logic.js` and the container's `lib/storms.js`, not
 * `StormTrack.js`: the handler imports `TimeControl`/`L_` and so cannot be
 * imported in Node. Clicking a real storm is an E2E test.
 */
import { test, expect } from '@playwright/test'
import { nextExtent } from '../logic.js'
import { motionVectorOf, trackOf } from '../../../lib/storms.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const obs = (id, time, lng = 0, extra = {}) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, 0] },
    properties: { storm_id: id, observed: time, ...extra },
})

const ARCHIVE = [
    obs('A', '2026-01-01T00:00:00Z', 0),
    obs('A', '2026-01-02T00:00:00Z', 1),
    obs('A', '2026-01-03T00:00:00Z', 2),
    obs('B', '2026-01-02T00:00:00Z', 9),
]

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('storm:track')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // The runner drops the interaction on any other type, so the layer type it
    // was written for must be listed.
    expect(manifest.applicableLayerTypes).toContain('duststormfronts')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature, or no archive, decides nothing @unit', () => {
    // The pipeline runs for events that carry no feature.
    expect(nextExtent(null, null, { all: ARCHIVE })).toBe(null)
    // The layer type had not fetched yet, so there is nothing left on the layer.
    expect(nextExtent(ARCHIVE[0], null, null)).toBe(null)
})

test('forward is the default direction, backward is configurable @unit', () => {
    const clicked = ARCHIVE[1]
    expect(nextExtent(clicked, null, { all: ARCHIVE }).feature).toBe(ARCHIVE[2])
    expect(
        nextExtent(clicked, { direction: 'backward' }, { all: ARCHIVE }).feature
    ).toBe(ARCHIVE[0])
})

test('either end of a track is the end @unit', () => {
    expect(nextExtent(ARCHIVE[2], null, { all: ARCHIVE })).toBe(null)
    expect(
        nextExtent(ARCHIVE[0], { direction: 'backward' }, { all: ARCHIVE })
    ).toBe(null)
})

test('a track is one storm only, oldest first @unit', () => {
    expect(trackOf(ARCHIVE, 'A')).toEqual([ARCHIVE[0], ARCHIVE[1], ARCHIVE[2]])
    expect(trackOf(ARCHIVE, 'B')).toEqual([ARCHIVE[3]])
})

test('motion vectors scale with intensity and point along the heading @unit', () => {
    const east = obs('A', '2026-01-01T00:00:00Z', 0, {
        speed_kmh: 111,
        heading_deg: 90,
        intensity: 1,
    })
    const v = motionVectorOf(east, {}, 1)
    expect(v.to[1]).toBeCloseTo(0, 6) // due east: no change in latitude
    expect(v.to[0]).toBeCloseTo(1, 3) // ~111 km ≈ 1 degree
    // Twice the intensity, twice the arrow.
    const strong = { ...east, properties: { ...east.properties, intensity: 2 } }
    expect(motionVectorOf(strong, {}, 1).to[0]).toBeCloseTo(2, 3)
    // A feature with no speed/heading gets no arrow at all.
    expect(motionVectorOf(obs('A', '2026-01-01T00:00:00Z'), {}, 1)).toBe(null)
})
