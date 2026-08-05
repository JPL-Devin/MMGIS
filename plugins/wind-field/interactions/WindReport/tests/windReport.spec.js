/**
 * WindReport interaction — unit tests (`npm run test:plugins:unit`).
 * These import `logic.js`, not the handler, which touches Leaflet.
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
    expect(manifest.interactionId).toBe('wind:report')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(manifest.applicableLayerTypes).toContain('windfield')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every config field sits inside configPath @unit', () => {
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
})

test('an event with no feature decides nothing @unit', () => {
    expect(decide(null, null)).toBe(null)
})

test('a feature with no wind properties decides nothing @unit', () => {
    expect(decide({ properties: { name: 'Crater' } }, null)).toBe(null)
})

test('settings are defaulted where they are read @unit', () => {
    const feature = { properties: { windSpeed: 14, windDirection: 90 } }
    expect(decide(feature, null)).toEqual({
        speed: 14,
        direction: 90,
        category: 'strong',
        text: '14.0 m/s from E (strong)',
    })
    const raw = { properties: { spd: 1, dir: 180 } }
    expect(decide(raw, { speedProp: 'spd', directionProp: 'dir' }).category).toBe(
        'calm'
    )
})
