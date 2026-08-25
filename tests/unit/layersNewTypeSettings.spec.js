import { test, expect } from '@playwright/test'

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

    test('query settings does not add non-parity controls', () => {
        const surface = require(
            '../../plugins/core/layertypes/Query/settings.js'
        ).default
        expect(surface.sections({ type: 'query' }, {})).toEqual([])
    })

    test('shared settings sections export reusable components', () => {
        const sections = require(
            '../../src/essence/Basics/UserInterface_/LayerSettings'
        )
        expect(typeof sections.DynamicStyleSection).toBe('function')
        expect(typeof sections.StatisticsSection).toBe('function')
        expect(typeof sections.CompositeLayersSection).toBe('function')
    })
})
