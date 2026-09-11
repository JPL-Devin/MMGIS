/**
 * A heatmap layer has no url of its own; it needs `variables.sourceLayer`.
 * Both config validators must accept the url-less type and reject a missing source.
 */

import { test, expect } from '@playwright/test'

import { validateLayer } from '../../configure/src/core/validators'

const backend = require('../../plugins/core/backend/Config/validate')

const REGISTRY = {
    vector: { manifest: { typeId: 'vector' } },
    heatmap: { manifest: { typeId: 'heatmap' } },
}

const ROCK_DENSITY = {
    name: 'Rock Density',
    type: 'heatmap',
    visibility: true,
    initialOpacity: 0.8,
    variables: {
        sourceLayer: 'Rocks',
        weightProperty: 'size',
        radius: 25,
        blur: 15,
        maxIntensity: 10,
        gradient: { 0.4: 'blue', 0.65: 'lime', 1: 'red' },
        lineSampleSpacingMeters: 5,
        radiusUnits: 'px',
    },
}

const config = (layer) => ({
    msv: { view: [0, 0, 5] },
    tools: {},
    layers: [layer],
})

test.describe('heatmap backend config validation', () => {
    test('heatmap is a checked built-in type', () => {
        expect(backend.checkedTypeOf('heatmap', REGISTRY)).toBe('heatmap')
    })

    test('the documented Rock Density config is valid without a url', () => {
        const result = backend(config(ROCK_DENSITY))
        expect(result.valid).toBe(true)
        expect(result.errors ?? []).toEqual([])
    })

    test('a missing sourceLayer is rejected', () => {
        const noSource = { ...ROCK_DENSITY, variables: { radius: 25 } }
        const result = backend(config(noSource))
        expect(result.valid).toBe(false)
        expect(
            result.errors.some((e) => /sourceLayer/.test(e.message ?? e.reason))
        ).toBe(true)

        const blank = { ...ROCK_DENSITY, variables: { sourceLayer: '  ' } }
        expect(backend(config(blank)).valid).toBe(false)
    })
})

test.describe('heatmap Configure layer validation', () => {
    test('accepts the Rock Density config', () => {
        expect(validateLayer(ROCK_DENSITY, REGISTRY)).toEqual([])
    })

    test('flags variables.sourceLayer when missing', () => {
        const errors = validateLayer(
            { name: 'Bare', type: 'heatmap', variables: {} },
            REGISTRY
        )
        expect(errors.map((e) => e.field)).toContain('variables.sourceLayer')
        expect(errors.map((e) => e.field)).not.toContain('url')
    })
})
