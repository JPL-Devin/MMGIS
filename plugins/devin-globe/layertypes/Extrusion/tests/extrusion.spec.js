const { test, expect } = require('@playwright/test')
const path = require('path')
const fs = require('fs')

const PLUGIN_DIR = path.resolve(__dirname, '..')

test.describe('Extrusion layer type', () => {
    test('plugin.json declares a valid layertype contract', () => {
        const manifest = require(path.join(PLUGIN_DIR, 'plugin.json'))
        expect(manifest.type).toBe('layertype')
        expect(manifest.typeId).toBe('extrusion')
        // Globe-only: no map module, and every declared engine ships a module.
        expect(manifest.capabilities.renderers.map).toBe(false)
        expect(manifest.modules.map).toBeUndefined()
        for (const engine of manifest.capabilities.renderers.globe.engines) {
            const modulePath = manifest.modules.globe[engine]
            expect(modulePath).toBeDefined()
            expect(
                fs.existsSync(path.join(PLUGIN_DIR, `${modulePath}.js`))
            ).toBe(true)
        }
    })

    test('the cesium module implements the ops it claims', () => {
        const source = fs.readFileSync(
            path.join(PLUGIN_DIR, 'globe', 'cesium.js'),
            'utf8'
        )
        for (const op of ['make', 'render', 'destroy', 'setVisibility', 'setOpacity'])
            expect(source).toContain(`${op},`)
    })
})

// The scaling/ramp math is pure, so it is exercised directly. The module is ESM
// with no Cesium or MMGIS imports; transpile it in-place for the test.
function loadLayerConfig() {
    const src = fs
        .readFileSync(path.join(PLUGIN_DIR, 'globe', 'layerConfig.js'), 'utf8')
        .replace(/^import[^\n]*\n/gm, '')
        .replace(/^export (const|function)/gm, '$1')
        .concat(
            '\nmodule.exports = { DEFAULT_RAMP, propertyDomain, normalize, extrudedHeight, rampColor }\n'
        )
    const module = { exports: {} }
    new Function('module', 'exports', src)(module, module.exports)
    return module.exports
}

test.describe('Extrusion scaling math', () => {
    const geojson = {
        features: [
            { properties: { depth: 10 } },
            { properties: { depth: 50 } },
            { properties: { depth: 'nope' } },
        ],
    }

    test('propertyDomain ignores non-numeric values', () => {
        const { propertyDomain } = loadLayerConfig()
        expect(propertyDomain(geojson, 'depth')).toEqual({ min: 10, max: 50 })
        expect(propertyDomain(geojson, 'missing')).toBe(null)
    })

    test('normalize clamps and handles a flat domain', () => {
        const { normalize } = loadLayerConfig()
        const domain = { min: 10, max: 50 }
        expect(normalize(30, domain)).toBe(0.5)
        expect(normalize(-5, domain)).toBe(0)
        expect(normalize(500, domain)).toBe(1)
        expect(normalize(7, { min: 7, max: 7 })).toBe(0)
    })

    test('extrudedHeight uses maxHeight when set, else heightScale', () => {
        const { extrudedHeight } = loadLayerConfig()
        const domain = { min: 10, max: 50 }
        expect(
            extrudedHeight(50, domain, {
                maxHeight: 1000,
                baseHeight: 0,
                heightScale: 1,
            })
        ).toBe(1000)
        expect(
            extrudedHeight(30, domain, {
                maxHeight: 0,
                baseHeight: 100,
                heightScale: 2,
            })
        ).toBe(160)
        // A non-numeric value collapses to the base height rather than NaN.
        expect(
            extrudedHeight(NaN, domain, {
                maxHeight: 1000,
                baseHeight: 5,
                heightScale: 1,
            })
        ).toBe(5)
    })

    test('rampColor interpolates between ramp stops', () => {
        const { rampColor, DEFAULT_RAMP } = loadLayerConfig()
        expect(rampColor(0, DEFAULT_RAMP)).toBe(DEFAULT_RAMP[0])
        expect(rampColor(1, DEFAULT_RAMP)).toBe(
            DEFAULT_RAMP[DEFAULT_RAMP.length - 1]
        )
        expect(rampColor(0.5, ['#000000', '#ffffff'])).toBe('#808080')
        expect(rampColor(2, ['#123456'])).toBe('#123456')
    })
})
