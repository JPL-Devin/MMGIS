/**
 * EventHalo attachment — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these;
 * `npm run test:unit` only covers `tests/unit`).
 *
 * `eventHalo.js` is NOT imported here. It follows the attachment README's own
 * playhead example and imports `@basics/TimeControl_/TimeControl`, which pulls
 * jQuery in and throws on import in Node even with `browser-globals.js`
 * (`Cannot read properties of undefined (reading 'createElement')`). So the
 * manifest is checked here and the halo geometry it computes is tested through
 * `lib/eventTime.js`.
 */
import { test, expect } from '@playwright/test'
import { eventProgress } from '../../../lib/eventTime.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid layerattachment contract @unit', () => {
    expect(manifest.type).toBe('layerattachment')
    expect(manifest.attachmentId).toBe('event_halo')
    // Settings live on the host, so the form must write where the manifest says
    // this attachment is configured.
    expect(manifest.configPath).toBe('variables.layerAttachments.eventHalo')
    for (const row of manifest.config.rows)
        for (const component of row.components)
            expect(component.field.startsWith(manifest.configPath)).toBe(true)
})

test('the declared module resolves @unit', () => {
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('a halo grows with the event, and does not exist before it @unit', () => {
    const start = '2024-01-01T00:00:00Z'
    const end = '2024-01-01T00:10:00Z'
    expect(eventProgress(start, end, '2023-12-31T23:00:00Z')).toBe(null)
    expect(eventProgress(start, end, '2024-01-01T00:05:00Z')).toBeCloseTo(0.5)
    expect(eventProgress(start, end, '2024-01-02T00:00:00Z')).toBe(1)
    // An instantaneous event is fully drawn as soon as it has happened.
    expect(eventProgress(start, null, '2024-01-01T00:00:01Z')).toBe(1)
})
