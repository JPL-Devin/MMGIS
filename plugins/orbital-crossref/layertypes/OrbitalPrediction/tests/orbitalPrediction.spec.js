/**
 * OrbitalPrediction layer type — unit tests.
 */
import { test, expect } from '@playwright/test'
import '../../../../../tests/helpers/browser-globals.js'
import OrbitalPrediction, { stamp } from '../orbitalPrediction.js'
import { manifestOf, unresolvedModules } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('orbitalprediction')
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the type ships its attachment and its interaction @unit', () => {
    // The seam: the property name all three plugins agree on is declared once,
    // here, and core resolves it into each plugin's own configPath.
    expect(manifest.capabilities.defaultAttachments.truth_offset.matchProp).toBe(
        '_crossrefTruthId'
    )
    expect(
        manifest.capabilities.defaultInteractions.click['truth:open'].matchProp
    ).toBe('_crossrefTruthId')
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(OrbitalPrediction)) expect(SURFACES).toContain(key)
})

test('predictions are stamped with the match key the mission named @unit', () => {
    const collection = {
        type: 'FeatureCollection',
        features: [{ properties: { target: 'Crater-7' } }],
    }
    stamp(collection, { variables: { crossref: { truthIdProp: 'target' } } })
    expect(collection.features[0].properties._crossrefTruthId).toBe('Crater-7')
})

test('a prediction layer is dynamic-extent unless the mission says otherwise @unit', () => {
    expect(OrbitalPrediction.config.normalize({}).variables.dynamicExtent).toBe(true)
    expect(
        OrbitalPrediction.config.normalize({ variables: { dynamicExtent: false } })
            .variables.dynamicExtent
    ).toBe(false)
})

test('fetch parameterizes the service by view and time @unit', async () => {
    let requested = null
    const original = window.fetch
    window.fetch = async (u) => {
        requested = u
        return { ok: true, json: async () => ({ type: 'FeatureCollection', features: [] }) }
    }
    try {
        await OrbitalPrediction.source.fetch(
            { name: 'Predictions' },
            {
                url: 'https://example.test/items',
                trigger: 'view',
                view: { minx: -1, miny: -2, maxx: 3, maxy: 4 },
                time: { requery: true, start: 'A', end: 'B' },
            }
        )
    } finally {
        window.fetch = original
    }
    expect(requested).toContain('bbox=-1%2C-2%2C3%2C4')
    expect(requested).toContain('datetime=A%2FB')
})
