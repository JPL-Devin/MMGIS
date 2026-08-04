const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('FeatureSonify interaction', () => {
    test('plugin.json is valid', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.name).toBe('FeatureSonify')
        expect(manifest.type).toBe('interaction')
        expect(manifest.interactionId).toBeDefined()
        expect(manifest.paths).toBeDefined()
        expect(manifest.paths['FeatureSonify']).toBeDefined()
    })
})
