/**
 * Curtain layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`. The renderer module can't be imported
 * without a browser, so the contract is asserted from the manifest and the pure
 * geometry helpers are exercised directly.
 */
import { test, expect } from '@playwright/test'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import {
    curtainConfig,
    heightRails,
    trackCoordinates,
    trackLength,
} from '../globe/curtain.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('curtainwall')
    expect(manifest.capabilities.renderers.map).toBe(false)
    for (const engine of manifest.capabilities.renderers.globe.engines)
        expect(manifest.modules.globe?.[engine]).toBeDefined()
})

test('every declared module resolves to a file @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('trackCoordinates accepts a collection, feature or geometry @unit', () => {
    const line = { type: 'LineString', coordinates: [[0, 0], [1, 1]] }
    expect(trackCoordinates(line)).toEqual([[0, 0], [1, 1]])
    expect(trackCoordinates({ type: 'Feature', geometry: line })).toHaveLength(2)
    expect(
        trackCoordinates({
            type: 'FeatureCollection',
            features: [
                { geometry: { type: 'Point', coordinates: [0, 0] } },
                { type: 'Feature', geometry: line },
            ],
        })
    ).toHaveLength(2)
    expect(trackCoordinates({ type: 'FeatureCollection', features: [] })).toEqual([])
})

test('trackCoordinates drops repeated and non-finite vertices @unit', () => {
    expect(
        trackCoordinates({
            type: 'LineString',
            coordinates: [[0, 0], [0, 0], [1, 1], [null, 2]],
        })
    ).toEqual([[0, 0], [1, 1]])
})

test('heightRails follows per-vertex surface heights @unit', () => {
    const coords = [[0, 0], [1, 1], [2, 2]]
    const config = { top: 10, bottom: -90, perVertex: [1000, 2000, null] }
    expect(heightRails(coords, config)).toEqual({
        maximumHeights: [1010, 2010, 10],
        minimumHeights: [910, 1910, -90],
    })
    // Falls back to the coordinate's own Z when no heights array is given.
    expect(
        heightRails([[0, 0, 500]], { top: 0, bottom: -100, perVertex: null })
    ).toEqual({ maximumHeights: [500], minimumHeights: [400] })
})

test('trackLength is a real along-track distance @unit', () => {
    // One degree of latitude on Mars is ~59.3 km.
    const km = trackLength([[0, 0], [0, 1]]) / 1000
    expect(km).toBeGreaterThan(58)
    expect(km).toBeLessThan(61)
    expect(trackLength([[0, 0]])).toBe(0)
})

test('curtainConfig defaults hang the curtain below the surface @unit', () => {
    const config = curtainConfig({})
    expect(config.top).toBe(0)
    expect(config.bottom).toBe(-1000)
    expect(config.transparent).toBe(true)
    expect(config.image).toBe(null)
    expect(
        curtainConfig({ variables: { curtain: { top: '25', bottom: 'x' } } })
    ).toMatchObject({ top: 25, bottom: -1000 })
})
