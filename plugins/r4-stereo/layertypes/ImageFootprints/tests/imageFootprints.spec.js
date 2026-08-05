/**
 * ImageFootprints layer type — unit tests.
 *
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import ImageFootprints from '../imageFootprints.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('imagefootprints')
    // Draws like a vector layer, so only the config surface is implemented.
    expect(manifest.extends).toBe('vector')
    expect(manifest.capabilities.defaultInteractions.click).toContain(
        'stereo:pairs'
    )
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('normalize defaults the viewing-geometry property names @unit', () => {
    const layerObj = ImageFootprints.config.normalize({ name: 'Footprints' })
    expect(layerObj.variables.stereo).toEqual({
        emissionProp: 'emission_angle',
        incidenceProp: 'incidence_angle',
        azimuthProp: 'sub_spacecraft_azimuth',
    })
})

test('normalize pushes the layer-level names into the two consumers @unit', () => {
    const layerObj = ImageFootprints.config.normalize({
        variables: {
            stereo: { emissionProp: 'emi', azimuthProp: 'az' },
            layerAttachments: { lookDirection: { enabled: true } },
            interactions: { stereoPairs: { minConvergence: 8 } },
        },
    })
    const { lookDirection } = layerObj.variables.layerAttachments
    expect(lookDirection.emissionProp).toBe('emi')
    expect(lookDirection.azimuthProp).toBe('az')
    expect(lookDirection.incidenceProp).toBe('incidence_angle')
    expect(layerObj.variables.interactions.stereoPairs.emissionProp).toBe('emi')
    // Values an admin set are left alone.
    expect(layerObj.variables.interactions.stereoPairs.minConvergence).toBe(8)
})
