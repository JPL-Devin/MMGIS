/**
 * SampleDepot layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`.
 *
 * These test the *inheritance* contract as much as the plugin: each override is
 * composed with a stand-in parent through the same `mergeSurface` core uses, so
 * "did the parent run" is an assertion rather than something to squint at in a
 * browser.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import SampleDepot from '../sampleDepot.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'
import { mergeSurface } from '../../../../../src/essence/Basics/Layers_/registry/typeInheritance.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('sampledepot')
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(SampleDepot)) expect(SURFACES).toContain(key)
})

test('source.fetch stamps a fillRatio the mission style can name @unit', async () => {
    const collection = {
        type: 'FeatureCollection',
        features: [{ properties: { capacity: 10, stowed: 5 }, geometry: null }],
    }
    const original = window.fetch
    window.fetch = async () => ({ ok: true, json: async () => collection })
    try {
        const result = await SampleDepot.source.fetch(
            { name: 'Depots' },
            { url: 'https://example.test/depots', trigger: 'make' }
        )
        expect(result.features[0].properties.fillRatio).toBe(0.5)
    } finally {
        window.fetch = original
    }
})

test('config.normalize adds to the parent rather than replacing it @unit', () => {
    const parent = {
        normalize(layerObj) {
            layerObj.kind = 'none'
            layerObj.radius = 8
            return layerObj
        },
    }
    const merged = mergeSurface(parent, SampleDepot.config)

    const layerObj = merged.normalize({})
    // the parent's work survived...
    expect(layerObj.kind).toBe('none')
    expect(layerObj.radius).toBe(8)
    // ...and ours is on top
    expect(layerObj.variables.depot.capacityProp).toBe('capacity')
    expect(layerObj.variables.dynamicExtent).toBe(true)
})

test('config.expand awaits an async parent and keeps its sublayers @unit', async () => {
    const parent = {
        async expand(layerObj) {
            return [
                { ...layerObj, name: 'a' },
                { ...layerObj, name: 'b' },
            ]
        },
    }
    const merged = mergeSurface(parent, SampleDepot.config)

    const expanded = await merged.expand({ name: 'Depots' })
    expect(expanded.map((l) => l.name)).toEqual(['a', 'b'])
    expect(expanded.every((l) => l._isDepot === true)).toBe(true)
})

test('config.expand with no parent implementation still returns the layer @unit', async () => {
    const merged = mergeSurface({}, SampleDepot.config)
    const expanded = await merged.expand({ name: 'Depots' })
    expect(expanded.name).toBe('Depots')
    expect(expanded._isDepot).toBe(true)
})

test('map.timeChange runs before the parent and passes its result through @unit', () => {
    const calls = []
    const parent = {
        timeChange() {
            calls.push('parent')
            return 'reloaded'
        },
    }
    const merged = mergeSurface(parent, SampleDepot.map)

    const layerObj = {}
    const result = merged.timeChange(layerObj, {
        startTime: 'a',
        endTime: 'b',
    })
    expect(layerObj._depotWindow).toEqual({ start: 'a', end: 'b' })
    expect(calls).toEqual(['parent'])
    expect(result).toBe('reloaded')
})

test("map.make overrides only main and keeps the parent's phases @unit", async () => {
    const calls = []
    const parent = {
        make: {
            async main() {
                calls.push('parent.main')
            },
            after() {
                calls.push('parent.after')
            },
            afterCommit() {
                calls.push('parent.afterCommit')
            },
        },
    }
    const merged = mergeSurface(parent, SampleDepot.map)

    expect(typeof merged.make.after).toBe('function')
    expect(typeof merged.make.afterCommit).toBe('function')

    const layerObj = {}
    await merged.make.main(layerObj, {})
    merged.make.after(layerObj)
    merged.make.afterCommit(layerObj)

    expect(typeof layerObj._depotMadeAt).toBe('number')
    expect(calls).toEqual(['parent.main', 'parent.after', 'parent.afterCommit'])
})

test('filter.getAggregations replaces the parent outright @unit', async () => {
    let parentRan = false
    const parent = {
        async getAggregations() {
            parentRan = true
            return { somethingElse: [] }
        },
        async filter() {},
    }
    const merged = mergeSurface(parent, SampleDepot.filter)

    const aggs = await merged.getAggregations('Depots', {
        geojson: {
            features: [
                { properties: { fillRatio: 0 } },
                { properties: { fillRatio: 0.5 } },
                { properties: { fillRatio: 1 } },
            ],
        },
    })
    expect(parentRan).toBe(false)
    expect(aggs.fillState).toEqual([
        { value: 'empty', count: 1 },
        { value: 'partial', count: 1 },
        { value: 'full', count: 1 },
    ])
    // the operation we did not declare is still the parent's
    expect(typeof merged.filter).toBe('function')
})
