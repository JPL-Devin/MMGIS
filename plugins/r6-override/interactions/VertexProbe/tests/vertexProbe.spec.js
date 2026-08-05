/**
 * VertexProbe interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit`, or by path:
 *   npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test \
 *     plugins/r6-override/interactions/VertexProbe/tests/
 *
 * These import `logic.js`, not the handler — clicking a real feature is E2E.
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
    expect(manifest.interactionId).toBe('vertex:probe')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner drops this on any other type. TrueVector
    // is the only host, because the stamped vertex count is what it is for.
    expect(manifest.applicableLayerTypes).toEqual(['truevector'])
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every config field sits inside configPath @unit', () => {
    // A field outside configPath is written where the runner never looks.
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('an event with no feature decides nothing @unit', () => {
    expect(decide(null, null)).toBe(null)
})

test('the vertex count TrueVector stamped is used as-is @unit', () => {
    const feature = {
        properties: { name: 'Rim', trueVectorVertexCount: 41 },
        geometry: { type: 'Point', coordinates: [0, 0] },
    }
    expect(decide(feature, null)).toEqual({
        label: 'Rim',
        vertices: 41,
        counted: true,
    })
})

test('an unstamped feature is counted here rather than reported as 0 @unit', () => {
    const feature = {
        properties: { name: 'Traverse' },
        geometry: {
            type: 'LineString',
            coordinates: [
                [0, 0],
                [1, 1],
                [2, 2],
            ],
        },
    }
    expect(decide(feature, null)).toEqual({
        label: 'Traverse',
        vertices: 3,
        counted: false,
    })
})

test("the layer type's declared settings arrive as this interaction's config @unit", () => {
    // What TrueVector's capabilities.defaultInteractions declares reaches the
    // handler as ctx.config — indistinguishable from an admin's answer.
    const declared =
        require('../../../layertypes/TrueVector/plugin.json').capabilities
            .defaultInteractions.click['vertex:probe']
    const feature = { properties: { name: 'Crater', myCount: 9 } }
    expect(decide(feature, declared)).toEqual({
        label: 'Crater',
        vertices: 0,
        counted: false,
    })
    expect(decide({ properties: { name: 'Crater', myCount: 9 } }, {
        ...declared,
        vertexCountProp: 'myCount',
    })).toEqual({ label: 'Crater', vertices: 9, counted: true })
})
