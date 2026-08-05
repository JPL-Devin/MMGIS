/**
 * TraverseStep interaction — unit tests.
 *
 * Run with `npm run test:plugins:unit` (the `@unit` tag selects these).
 *
 * `TraverseStep.js` imports `L_`, so — per the README's Testing section — it
 * cannot be imported in Node. The stepping logic therefore lives in the pure,
 * browser-free `stepIndex.js`, which is what this test drives. The handler's
 * DOM/selection behaviour is verified by clicking a feature (E2E), not here.
 */
import { test, expect } from '@playwright/test'
import { stepIndex } from '../stepIndex.js'
import {
    manifestOf,
    unresolvedModules,
} from '../../../../../tests/helpers/plugin-contract.js'

const manifest = manifestOf(__dirname)

test('plugin.json declares a valid interaction contract @unit', () => {
    expect(manifest.type).toBe('interaction')
    expect(manifest.interactionId).toBe('traverse:step')
    expect(['preamble', 'main', 'postamble']).toContain(manifest.phase)
    expect(manifest.applicableEvents.length).toBeGreaterThan(0)
    // Enforced at runtime: the runner skips this interaction on a layer whose
    // type (or the type it extends) isn't listed.
    expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true)
    expect(unresolvedModules(__dirname, manifest)).toEqual([])
})

test('stepIndex steps forward and back @unit', () => {
    expect(stepIndex(5, 0, 1, true)).toBe(1)
    expect(stepIndex(5, 2, -1, true)).toBe(1)
})

test('stepIndex with no anchor starts at an end @unit', () => {
    expect(stepIndex(5, -1, 1, true)).toBe(0)
    expect(stepIndex(5, -1, -1, true)).toBe(4)
})

test('stepIndex wraps or clamps at the ends @unit', () => {
    expect(stepIndex(5, 4, 1, true)).toBe(0) // wrap
    expect(stepIndex(5, 4, 1, false)).toBe(4) // clamp
    expect(stepIndex(5, 0, -1, true)).toBe(4) // wrap
    expect(stepIndex(5, 0, -1, false)).toBe(0) // clamp
})

test('stepIndex handles an empty traverse @unit', () => {
    expect(stepIndex(0, -1, 1, true)).toBe(-1)
})
