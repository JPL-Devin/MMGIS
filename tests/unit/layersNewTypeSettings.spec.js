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
        for (const type of ['Vector', 'VectorTile', 'Query']) {
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
