const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('GeodatasetStats backend', () => {
    test('plugin.json is valid', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.name).toBe('GeodatasetStats')
        expect(manifest.type).toBe('backend')
    })

    test('route module exports an express router with /summary', () => {
        const router = require(path.resolve(__dirname, '..', 'routes', 'geodatasetStats.js'))
        expect(typeof router).toBe('function')
        const paths = router.stack
            .filter((l) => l.route)
            .map((l) => l.route.path)
        expect(paths).toContain('/summary/:layer')
        expect(paths).toContain('/summary')
    })
})
