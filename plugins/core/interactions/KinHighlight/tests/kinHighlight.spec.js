const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('KinHighlight interaction', () => {
    test('plugin.json is valid', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.name).toBe('KinHighlight')
        expect(manifest.type).toBe('interaction')
        expect(manifest.interactionId).toBeDefined()
        expect(manifest.paths).toBeDefined()
        expect(manifest.paths['KinHighlight']).toBeDefined()
        expect(manifest.applicableEvents).toEqual(['hover', 'mouseout'])
    })

    test('is registered in the generated hover/mouseout pipelines', () => {
        const src = require('fs').readFileSync(
            path.resolve(__dirname, '..', '..', '..', '..', '..', 'src', 'pre', 'interactions.js'),
            'utf8'
        )
        expect(src).toContain('kin:highlight')
    })
})
