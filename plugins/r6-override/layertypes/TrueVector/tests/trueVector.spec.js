/**
 * TrueVector layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`, or by path:
 *   npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test \
 *     plugins/r6-override/layertypes/TrueVector/tests/
 *
 * The module declares surfaces rather than a renderer, and its only operation is
 * `map.make.after`, which is a plain function of a layer object — so it is
 * testable here. Drawing on a real map is E2E.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import TrueVector from '../trueVector.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { VERTEX_COUNT_PROP } from '../../../lib/vertices.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    // NOT 'vector': two plugins cannot claim one typeId, and core's Vector is
    // overridable:false. See README-FINDINGS.md in this container.
    expect(manifest.typeId).toBe('truevector')
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = [
        'source',
        'config',
        'filter',
        'time',
        'legend',
        'map',
        'globe',
    ]
    for (const key of Object.keys(TrueVector)) expect(SURFACES).toContain(key)
})

test("make's after phase wraps core rather than replacing it @unit", () => {
    // `after` with no `main` means vector's own make still builds the layer.
    expect(TrueVector.map.make.main).toBeUndefined()
    expect(typeof TrueVector.map.make.after).toBe('function')
})

test('make stamps every feature with its vertex count @unit', () => {
    const layerObj = {
        name: 'Traverses',
        geojson: {
            type: 'FeatureCollection',
            features: [
                {
                    properties: { name: 'A' },
                    geometry: { type: 'Point', coordinates: [1, 2] },
                },
                {
                    geometry: {
                        type: 'Polygon',
                        coordinates: [
                            [
                                [0, 0],
                                [1, 0],
                                [1, 1],
                                [0, 0],
                            ],
                        ],
                    },
                },
            ],
        },
    }
    TrueVector.map.make.after(layerObj)
    expect(
        layerObj.geojson.features.map((f) => f.properties[VERTEX_COUNT_PROP])
    ).toEqual([1, 4])
})

test('a layer with no data is not a crash @unit', () => {
    expect(() => TrueVector.map.make.after({ name: 'Empty' })).not.toThrow()
})

test('the property name the interaction needs is declared, not shared in code @unit', () => {
    // The seam between the two families: the type declares the interaction's
    // settings, core resolves them into the interaction's configPath.
    const declared = manifest.capabilities.defaultInteractions.click
    expect(Object.keys(declared)).toEqual(['vertex:probe'])
    expect(declared['vertex:probe'].vertexCountProp).toBe(VERTEX_COUNT_PROP)
})
