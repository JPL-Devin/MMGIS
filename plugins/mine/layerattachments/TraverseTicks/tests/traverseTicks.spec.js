const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('TraverseTicks attachment', () => {
    test('plugin.json declares a valid layerattachment contract', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.type).toBe('layerattachment')
        expect(manifest.attachmentId).toBe('traverse_ticks')
        // Settings live on the host, so the form must write where the
        // manifest says this attachment is configured.
        expect(manifest.configPath).toBe(
            'variables.layerAttachments.traverseTicks'
        )
        for (const row of manifest.config.rows)
            for (const component of row.components)
                expect(component.field.startsWith(manifest.configPath)).toBe(
                    true
                )
    })

    test('module only declares known operations and returns its attachmentId', () => {
        const fs = require('fs')
        const src = fs.readFileSync(
            path.resolve(__dirname, '..', 'traverseTicks.js'),
            'utf8'
        )
        const exported = src
            .match(/export default \{([^}]*)\}/)[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        expect(exported).toEqual(['make', 'syncData'])
        expect(src).toContain("type: 'traverse_ticks'")
    })
})
