/**
 * ThermalExplain — unit tests.
 *
 * The handler (`ThermalExplain.js`) touches Leaflet, so the tests cover the pure
 * `logic.js` (and, through it, the shared inertia lib). Run with
 * `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
import { explain } from '../logic.js'
import { manifestOf } from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

const feature = (props) => ({ type: 'Feature', properties: props })

test('manifest declares the interaction id, phase and configPath @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('thermal:explain')
    expect(manifest.phase).toBe('main')
    expect(manifest.configPath).toMatch(/^variables\./)
})

test('no feature, or a non-physical pair, explains nothing @unit', () => {
    expect(explain(null, {})).toBeNull()
    // night warmer than day => amplitude <= 0
    expect(explain(feature({ temp_day: 100, temp_night: 200 }), {})).toBeNull()
})

test('explains with the default day/night props and the shared model @unit', () => {
    const result = explain(feature({ temp_day: 300, temp_night: 100 }), {})
    expect(result).not.toBeNull()
    expect(result.amplitude).toBe(200)
    expect(result.inertia).toBe(1000 / 200) // DEFAULTS.scale / ΔT
    expect(result.text).toContain('Thermal inertia')
})

test('honours the property names and scale the layer type handed it @unit', () => {
    const result = explain(
        feature({ tmax: 250, tmin: 150 }),
        { dayTempProp: 'tmax', nightTempProp: 'tmin', scale: 500 }
    )
    expect(result.amplitude).toBe(100)
    expect(result.inertia).toBe(500 / 100)
})
