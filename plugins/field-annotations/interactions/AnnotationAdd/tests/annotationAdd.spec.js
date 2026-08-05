/**
 * AnnotationAdd interaction — unit tests.
 * Run with `npm run test:plugins:unit`.
 */
import { test, expect } from '@playwright/test'
// Stubs window/document so the module can be imported in Node. Must come first.
import '../../../../../tests/helpers/browser-globals.js'
import { buildAnnotationBody } from '../../../layertypes/Annotation/lib/pure.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('annotation:add')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    expect(manifest.applicableLayerTypes).toContain('annotation')
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('every config field sits inside configPath @unit', () => {
    for (const row of manifest.config.rows)
        for (const c of row.components)
            expect(c.field.startsWith(manifest.configPath)).toBe(true)
})

test('buildAnnotationBody carries the click point and note @unit', () => {
    const body = buildAnnotationBody(
        { lng: 1.5, lat: -2.5 },
        'ripple marks',
        'Test'
    )
    expect(body).toEqual({
        mission: 'Test',
        lng: 1.5,
        lat: -2.5,
        note: 'ripple marks',
    })
    expect(buildAnnotationBody(null, 'x').mission).toBe('')
})
