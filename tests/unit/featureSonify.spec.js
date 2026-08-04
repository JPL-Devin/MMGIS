import { test, expect } from '@playwright/test'
import FeatureSonify from '../../plugins/core/interactions/FeatureSonify/FeatureSonify.js'

/**
 * FeatureSonify interaction — unit tests for the pure value→pitch mapping.
 * The audio playback + DOM parts require a browser AudioContext and are
 * exercised manually; here we lock down the deterministic math.
 */
test.describe('FeatureSonify._valueToFrequency', () => {
    test('min value maps to the lowest pitch, max to the highest', () => {
        const lo = FeatureSonify._valueToFrequency(0, 0, 100, 'pentatonic')
        const hi = FeatureSonify._valueToFrequency(100, 0, 100, 'pentatonic')
        expect(hi).toBeGreaterThan(lo)
        // lowest pentatonic degree is A2 (110 Hz)
        expect(lo).toBeCloseTo(110, 1)
    })

    test('pitch increases monotonically with value', () => {
        const a = FeatureSonify._valueToFrequency(10, 0, 100, 'continuous')
        const b = FeatureSonify._valueToFrequency(50, 0, 100, 'continuous')
        const c = FeatureSonify._valueToFrequency(90, 0, 100, 'continuous')
        expect(b).toBeGreaterThan(a)
        expect(c).toBeGreaterThan(b)
    })

    test('values are clamped outside the [min,max] range', () => {
        const below = FeatureSonify._valueToFrequency(-50, 0, 100, 'continuous')
        const atMin = FeatureSonify._valueToFrequency(0, 0, 100, 'continuous')
        const above = FeatureSonify._valueToFrequency(500, 0, 100, 'continuous')
        const atMax = FeatureSonify._valueToFrequency(100, 0, 100, 'continuous')
        expect(below).toBeCloseTo(atMin, 5)
        expect(above).toBeCloseTo(atMax, 5)
    })

    test('degenerate range (max <= min) falls back to a mid pitch', () => {
        const f = FeatureSonify._valueToFrequency(42, 10, 10, 'pentatonic')
        expect(Number.isFinite(f)).toBe(true)
        expect(f).toBeGreaterThan(0)
    })

    test('use() is a no-op for features without properties', () => {
        expect(() => FeatureSonify.use({ feature: null })).not.toThrow()
        expect(() => FeatureSonify.use({ feature: {} })).not.toThrow()
    })
})
