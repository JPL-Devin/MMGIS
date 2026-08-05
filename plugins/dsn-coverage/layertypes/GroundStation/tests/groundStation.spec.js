/**
 * GroundStation layer type — unit tests (`npm run test:plugins:unit`).
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import GroundStation from '../groundStation.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('groundstation')
    expect(manifest.extends).toBe('vector')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the type declares the attachment and interaction it comes with @unit', () => {
    // This is the only seam carrying the property names to the attachment.
    const attachment = manifest.capabilities.defaultAttachments.horizon_mask
    expect(attachment.maskElevationProp).toBe('mask_elevation_deg')
    expect(manifest.capabilities.defaultInteractions.click).toContain(
        'dsn:handover'
    )
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(GroundStation)) expect(SURFACES).toContain(key)
})

test('normalize defaults the station property names @unit', () => {
    const layerObj = GroundStation.config.normalize({ name: 'Stations' })
    expect(layerObj.variables.groundStation.diameterProp).toBe(
        'antenna_diameter_m'
    )
    // An admin's own value is kept.
    const custom = GroundStation.config.normalize({
        variables: { groundStation: { diameterProp: 'dish' } },
    })
    expect(custom.variables.groundStation.diameterProp).toBe('dish')
    expect(custom.variables.groundStation.bandProp).toBe('band')
})
