import { test, expect } from '@playwright/test'
const fs = require('fs')

test.describe('LayersNew type settings surfaces', () => {
    test('vector settings composes shared vector sections', () => {
        const surface = require(
            '../../plugins/core/layertypes/Vector/settings.js'
        ).default
        expect(surface.sections({ type: 'vector' }, {})).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ id: 'dynamic-style' }),
                expect.objectContaining({ id: 'statistics' }),
                expect.objectContaining({ id: 'attachments' }),
            ])
        )
    })

    test('vector tile settings composes shared vector sections', () => {
        const surface = require(
            '../../plugins/core/layertypes/VectorTile/settings.js'
        ).default
        expect(surface.sections({ type: 'vectortile' }, {})).toHaveLength(3)
    })

    test('query uses the core fallback rather than an empty module', () => {
        const manifest = require(
            '../../plugins/core/layertypes/Query/plugin.json'
        )
        expect(manifest.modules.settings).toBeUndefined()
    })

    test('shared settings sections export reusable components', () => {
        const sections = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings'
        )
        expect(typeof sections.DynamicStyleSection).toBe('function')
        expect(typeof sections.StatisticsSection).toBe('function')
        expect(typeof sections.CompositeLayersSection).toBe('function')
    })

    test('uses one JavaScript settings module per type', () => {
        for (const type of [
            'Vector',
            'VectorTile',
            'Tile',
            'Data',
            'Image',
            'Velocity',
            'Video',
            'Query',
        ]) {
            expect(
                fs.existsSync(
                    `plugins/core/layertypes/${type}/settings.jsx`
                )
            ).toBe(false)
            expect(
                fs.existsSync(
                    `plugins/core/layertypes/${type}/settings.js`
                )
                ).toBe(type !== 'Query')
        }
    })

    test('remaining manifests expose settings surfaces', () => {
        for (const type of ['Tile', 'Data', 'Image', 'Velocity', 'Video']) {
            const manifest = require(
                `../../plugins/core/layertypes/${type}/plugin.json`
            )
            expect(manifest.modules.settings).toBe('./settings')
        }
    })

    test('colormap lookup and reversal are normalized', () => {
        const { resolveColormap } = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings/typeSettings'
        )
        expect(resolveColormap('Viridis_r', 'binary', { Viridis: true })).toEqual(
            { name: 'Viridis', reverse: true }
        )
        expect(resolveColormap('', 'binary')).toEqual({
            name: 'binary',
            reverse: false,
        })
    })

    test('range helper orders finite bounds', () => {
        const { safeRange } = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings/typeSettings'
        )
        expect(safeRange(8, 2)).toEqual({ min: 2, max: 8 })
        expect(safeRange('bad', 4)).toEqual({ min: 0, max: 4 })
    })

    test('velocity range math keeps bounds ordered', () => {
        const { velocityRange } = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings/typeSettings'
        )
        expect(velocityRange(1, 9, 12, 4)).toEqual({ min: 4, max: 12 })
    })

    test('COG expression helpers preserve configured and reset values', () => {
        const { nextCogExpression, resolveCogExpression } = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings/typeSettings'
        )
        expect(resolveCogExpression('b1', null)).toBe('b1')
        expect(resolveCogExpression('b1', 'b2')).toBe('b2')
        expect(nextCogExpression(null, 'b1')).toBeNull()
        expect(nextCogExpression('b3', 'b1')).toBe('b3')
    })

    test('video time formatting handles invalid and minute values', () => {
        const { formatVideoTime } = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings/typeSettings'
        )
        expect(formatVideoTime(65.4)).toBe('1:05')
        expect(formatVideoTime(Infinity)).toBe('0:00')
    })

    test('dynamic style controls preserve imported ramps and custom arrays', () => {
        const source = fs.readFileSync(
            'src/essence/Basics/UserInterface_/LayerSettings/DynamicStyleSection.jsx',
            'utf8'
        )
        expect(source).toContain(
            "data as colormapData,\n    evaluate_cmap"
        )
        expect(source).not.toContain(
            "require('@external/js-colormaps/js-colormaps.js')"
        )
        expect(source).not.toContain(
            "plugins/core/tools/Layers/components/DynamicStyleRamp"
        )
        expect(source).toContain("Array.isArray(rule.ramp)")
        expect(source).toContain("? CUSTOM_RAMP")
        expect(source).toContain('value !== CUSTOM_RAMP')
    })

    test('computes numeric ramp ticks from finite statistics', () => {
        const { rampTicks } = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings/DynamicStyleSection'
        )
        expect(rampTicks({ min: 2, max: 10 })).toEqual([2, 6, 10])
        expect(rampTicks({ min: 2 })).toEqual([])
    })

    test('statistics omit absent values', () => {
        const source = fs.readFileSync(
            'src/essence/Basics/UserInterface_/LayerSettings/StatisticsSection.jsx',
            'utf8'
        )
        expect(source).toContain('value != null')
        expect(source).toContain('Number.isFinite(Number(value))')
    })

    test('attachment controls stay in sync with runtime attachments', () => {
        const source = fs.readFileSync(
            'src/essence/Basics/UserInterface_/LayerSettings/CompositeLayersSection.jsx',
            'utf8'
        )
        expect(source).toContain(
            'value={attachment.layer?.dropdownValue || dropdown[0] || \'\'}'
        )
        expect(source).not.toContain('DynamicStyleSection')
        expect(source).not.toContain('StatisticsSection')
    })
})
