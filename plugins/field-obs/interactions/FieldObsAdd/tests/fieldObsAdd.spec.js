/**
 * FieldObsAdd interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 */
import { test, expect } from '@playwright/test'
import { observationFor, resolveApiUrl } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('field:obs:add')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the endpoint resolves behind ROOT_PATH @unit', () => {
    expect(resolveApiUrl('/api/fieldObs/observations', '')).toBe(
        '/api/fieldObs/observations'
    )
    expect(resolveApiUrl('/api/fieldObs/observations', '/mmgis')).toBe(
        '/mmgis/api/fieldObs/observations'
    )
    expect(resolveApiUrl('/api/fieldObs/observations', '/mmgis/')).toBe(
        '/mmgis/api/fieldObs/observations'
    )
    expect(resolveApiUrl(undefined, '/mmgis')).toBe(
        '/mmgis/api/fieldObs/observations'
    )
    expect(resolveApiUrl('https://elsewhere/obs', '/mmgis')).toBe(
        'https://elsewhere/obs'
    )
})

test('a click with no latlng writes nothing @unit', () => {
    expect(observationFor({})).toBe(null)
    expect(observationFor({ event: {} })).toBe(null)
})

test('settings are defaulted where they are read @unit', () => {
    const event = { latlng: { lat: 1.5, lng: -2.5 } }
    const feature = { properties: { name: 'Crater', id: 7 } }

    expect(observationFor({ event, feature, config: null })).toEqual({
        note: 'Observed: Crater',
        lat: 1.5,
        lng: -2.5,
        payload: { source: feature.properties },
    })
    expect(
        observationFor({
            event,
            feature,
            config: { noteProperty: 'id', notePrefix: 'Sample' },
        }).note
    ).toBe('Sample: 7')
    expect(observationFor({ event, config: null }).note).toBe('Observed')
})
