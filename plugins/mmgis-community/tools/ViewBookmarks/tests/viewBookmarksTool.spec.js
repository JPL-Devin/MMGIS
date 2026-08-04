const { test, expect } = require('@playwright/test')
const path = require('path')

const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))

test.describe('ViewBookmarksTool', () => {
    test('plugin.json is valid', () => {
        expect(manifest.name).toBe('ViewBookmarks')
        expect(manifest.type).toBe('tool')
        expect(manifest.paths['ViewBookmarksTool']).toBeDefined()
        expect(manifest.hasVars).toBe(true)
    })

    test('config metaconfig declares the authoring surface', () => {
        const components = manifest.config.rows.flatMap((r) => r.components)
        const fields = components.map((c) => c.field)

        expect(fields).toContain('variables.bookmarks')
        expect(fields).toContain('variables.defaultZoom')
        expect(fields).toContain('variables.showDescriptions')
        expect(fields).toContain('variables.groupBookmarks')
        expect(fields).toContain('variables.exclusiveLayers')

        const bookmarks = components.find(
            (c) => c.field === 'variables.bookmarks'
        )
        expect(bookmarks.type).toBe('objectarray')
        const subFields = bookmarks.object.map((o) => o.field)
        expect(subFields).toEqual(
            expect.arrayContaining([
                'name',
                'longitude',
                'latitude',
                'zoom',
                'layers',
            ])
        )
        // every component the Maker renders needs a type and a width
        components.concat(bookmarks.object).forEach((c) => {
            expect(typeof c.type).toBe('string')
            expect(typeof c.width).toBe('number')
        })
    })
})
