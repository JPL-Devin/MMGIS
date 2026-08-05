/**
 * HazardZone layer type — unit tests. Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import HazardZone from '../hazardZone.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid extending layertype contract @unit', () => {
    expect(manifest.type).toBe('layertype')
    expect(manifest.typeId).toBe('hazardzone')
    expect(manifest.extends).toBe('vector')
    expect(typeof manifest.module).toBe('string')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('the module declares surfaces, not renderer operations @unit', () => {
    const SURFACES = ['source', 'config', 'filter', 'time', 'legend', 'map', 'globe']
    for (const key of Object.keys(HazardZone)) expect(SURFACES).toContain(key)
})

test('the type declares the attachment and interaction the feature needs @unit', () => {
    // This is the whole seam: the property names the buffer attachment needs are
    // the type's fact, declared here rather than written into the attachment's
    // own config subtree.
    const declared = manifest.capabilities.defaultAttachments.hazard_buffer
    expect(declared.severityProp).toBe('severity')
    expect(declared.classProp).toBe('hazard_class')
    expect(manifest.capabilities.defaultInteractions.click).toContain(
        'hazard:report'
    )
})

test('normalize colours by severity when the mission configured no style @unit', () => {
    const layerObj = { name: 'Hazards', variables: {} }
    expect(HazardZone.config.normalize(layerObj).style.fillColor).toBe(
        'prop-severity'
    )
    // A configured style is left alone.
    const styled = { name: 'H', style: { fillColor: '#f00' }, variables: {} }
    expect(HazardZone.config.normalize(styled).style.fillColor).toBe('#f00')
    // A layer that renamed the property is honoured.
    const renamed = { name: 'H', variables: { hazard: { severityProp: 'sev' } } }
    expect(HazardZone.config.normalize(renamed).style.fillColor).toBe('prop-sev')
})

test('legend.derive writes a severity ramp onto the layer @unit', () => {
    const layerObj = { name: 'Hazards', variables: {} }
    expect(HazardZone.legend.derive(layerObj)).toBe(true)
    expect(layerObj._legend).toHaveLength(2)
    expect(layerObj._legend[0].propertyName).toBe('severity')
    expect(layerObj._legend[0].styleMatching).toBe(true)
})
