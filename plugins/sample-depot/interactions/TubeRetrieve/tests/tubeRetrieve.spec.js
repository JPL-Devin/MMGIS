/**
 * TubeRetrieve interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit`. These import `logic.js`, not
 * `TubeRetrieve.js`: the handler imports `L_`, so it cannot be imported in Node.
 */
import { test, expect } from '@playwright/test'
import { decide } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('tube:retrieve')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents).toContain('click')
    // The layer type this interaction knows the properties of.
    expect(manifest.applicableLayerTypes).toEqual(['sampletubes'])
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every config field sits inside configPath @unit', () => {
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
})

test('an event with no feature and no add permission decides nothing @unit', () => {
    expect(decide(null, null, { lat: 1, lng: 2 }, { depot: 'Three Forks' })).toBe(
        null
    )
})

test('a click on an un-retrieved tube retrieves it @unit', () => {
    const feature = { properties: { tube_id: 12, retrieved: false } }
    expect(decide(feature, null, null, {})).toEqual({
        action: 'retrieve',
        id: 12,
    })
})

test('a click on an already-retrieved tube writes nothing @unit', () => {
    const feature = { properties: { tube_id: 12, retrieved: true } }
    expect(decide(feature, null, null, {})).toBe(null)
})

test('an empty-map click adds a tube when the admin allowed it @unit', () => {
    const result = decide(
        null,
        { allowAdd: true },
        { lat: 18.4, lng: 77.4 },
        { depot: 'Three Forks' }
    )
    expect(result).toEqual({
        action: 'add',
        tube: {
            depot_name: 'Three Forks',
            // Defaulted here, not in the manifest: nothing is written to the
            // layer config until an admin touches the field.
            sample_type: 'regolith',
            lng: 77.4,
            lat: 18.4,
        },
    })
})

test('adding needs a depot on the layer @unit', () => {
    expect(decide(null, { allowAdd: true }, { lat: 1, lng: 2 }, {})).toBe(null)
})
