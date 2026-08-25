import { test, expect } from '@playwright/test'

const fs = require('fs')
const path = require('path')
const {
    SETTINGS_OPS,
    SURFACES,
    validateLayerTypeModuleShape,
    flattenLayerModules,
} = require('../../API/pluginValidation')
const { mergeSurfaces } = require('../../src/essence/Basics/Layers_/registry/typeInheritance')

const generatedPath = path.resolve(
    __dirname,
    '../../src/pre/layertypes.js'
)
const registrySource = fs.readFileSync(
    path.resolve(
        __dirname,
        '../../src/essence/Basics/Layers_/registry/LayerTypeRegistry.js'
    ),
    'utf8'
)
const settingsHookSource = fs.readFileSync(
    path.resolve(
        __dirname,
        '../../plugins/core/tools/LayersNew/hooks/useLayerSettings.js'
    ),
    'utf8'
)

test.describe('LayersNew settings surface', () => {
    test('defines the fixed settings operation contract', () => {
        expect(SETTINGS_OPS).toEqual([
            'sections',
            'tabs',
            'rowExtras',
            'thumbnail',
            'actions',
            'summary',
        ])
        expect(SURFACES.settings).toEqual({
            ops: SETTINGS_OPS,
            requiresMake: false,
        })
    })

    test('accepts settings operations and rejects typos', () => {
        expect(
            validateLayerTypeModuleShape(
                'export default { sections() {}, summary() {} }',
                'vector settings',
                'settings'
            )
        ).toEqual([])
        expect(
            validateLayerTypeModuleShape(
                'export default { sectionz() {} }',
                'vector settings',
                'settings'
            ).join(' ')
        ).toContain("unknown operation 'sectionz'")
    })

    test('merges settings modules through the generic inheritance path', () => {
        const merged = mergeSurfaces(
            { settings: { sections: ['parent'], summary: ['parent'] } },
            { settings: { sections: ['child'] } }
        )
        expect(merged.settings).toEqual({
            sections: ['child'],
            summary: ['parent'],
        })
    })

    test('supports the single-module declaration shape', () => {
        expect(flattenLayerModules({ module: './type' })).toEqual({
            module: './type',
        })
        expect(registrySource).toContain('if (mods.module == null) return mods')
    })

    test('missing settings modules are safe and registry exposes settings', () => {
        expect(flattenLayerModules({ modules: { map: './map' } })).toEqual({
            map: './map',
        })
        if (fs.existsSync(generatedPath))
            expect(fs.readFileSync(generatedPath, 'utf8')).not.toContain(
                'layertypes/Vector/settings'
            )
        expect(registrySource).toContain('hasSettings(typeId)')
        expect(settingsHookSource).toContain(
            'settings?.sections?.(layer, ctx) || []'
        )
    })

    test('a type without settings uses the core fallback', () => {
        const registry = require(
            '../../src/essence/Basics/Layers_/registry/LayerTypeRegistry'
        ).default
        expect(registry.getSettings('vector')).toBeUndefined()
        expect(registry.hasSettings('vector')).toBe(false)
        expect(registry.getSettings('vector')?.sections || []).toEqual([])
    })
})
