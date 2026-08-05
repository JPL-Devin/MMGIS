/**
 * SwathConflicts interaction — unit tests (`npm run test:plugins:unit`).
 *
 * These import `logic.js`, not the handler: the handler imports `L_` and so
 * cannot be imported in Node.
 */
import { test, expect } from '@playwright/test'
import { report } from '../logic.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const swath = (id, x, roll = 10) => ({
    type: 'Feature',
    properties: { swath_id: id, roll_deg: roll },
    geometry: {
        type: 'Polygon',
        coordinates: [
            [
                [x, 0],
                [x + 1, 0],
                [x + 1, 1],
                [x, 1],
                [x, 0],
            ],
        ],
    },
})

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('swath:conflicts')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableLayerTypes).toContain('swathcatalogue')
    manifest.config.rows.forEach((r) =>
        r.components.forEach((c) =>
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
        )
    )
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('an event with no feature reports nothing @unit', () => {
    expect(report(null, [], null)).toBe(null)
})

test('overlapping swaths in view are reported, disjoint ones are not @unit', () => {
    const a = swath('SW-1', 0)
    const b = swath('SW-2', 0.5, -20)
    const c = swath('SW-3', 10)
    const r = report(a, [a, b, c], null)
    expect(r.count).toBe(1)
    expect(r.conflicts[0].id).toBe('SW-2')
    expect(r.conflicts[0].rollDeg).toBe(-20)
    expect(r.message).toContain('SW-2')

    expect(report(c, [a, b, c], null).count).toBe(0)
})

test('property names are settings, defaulted where they are read @unit', () => {
    const a = { ...swath('SW-1', 0) }
    a.properties = { id: 'X', roll_deg: 5 }
    expect(report(a, [a], { idProp: 'id' }).id).toBe('X')
    expect(report(a, [a], null).id).toBe('this swath')
})
