const { test, expect } = require('@playwright/test')
const path = require('path')

test.describe('TimeMachineTool', () => {
    test('plugin.json is valid', () => {
        const manifest = require(path.resolve(__dirname, '..', 'plugin.json'))
        expect(manifest.name).toBe('TimeMachine')
        expect(manifest.type).toBe('tool')
        expect(manifest.paths).toBeDefined()
        expect(manifest.paths['TimeMachineTool']).toBeDefined()
    })
})
