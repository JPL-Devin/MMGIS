import { resolveJsColormap } from '@basics/Layers_/render/rampUtils'
import { data as colormapData } from '@external/js-colormaps/js-colormaps.js'

export function resolveColormap(
    value,
    fallback = 'viridis',
    data = colormapData
) {
    return resolveJsColormap(value, fallback, data)
}

export function rangeTicks(min, max) {
    const low = Number(min)
    const high = Number(max)
    if (!Number.isFinite(low) || !Number.isFinite(high)) return []
    return [low, low + (high - low) / 2, high]
}

export function formatRangeTick(value, units = '') {
    const number = Number(value)
    if (!Number.isFinite(number)) return ''
    const text =
        number === 0
            ? '0'
            : Math.abs(number) >= 100 || Math.abs(number) < 0.01
              ? number.toPrecision(3)
              : String(Number(number.toFixed(2)))
    return `${text}${units}`
}

export function safeRange(min, max) {
    let low = Number(min)
    let high = Number(max)
    if (!Number.isFinite(low)) low = 0
    if (!Number.isFinite(high)) high = 1
    if (low > high) [low, high] = [high, low]
    return { min: low, max: high }
}

export function velocityRange(currentMin, currentMax, nextMin, nextMax) {
    const current = safeRange(currentMin, currentMax)
    const min = Number.isFinite(Number(nextMin)) ? Number(nextMin) : current.min
    const max = Number.isFinite(Number(nextMax)) ? Number(nextMax) : current.max
    return {
        min: Math.min(min, max),
        max: Math.max(min, max),
    }
}

export function orderedRange(_currentMin, _currentMax, nextMin, nextMax) {
    return safeRange(nextMin, nextMax)
}

export function commitRange(
    currentMin,
    currentMax,
    nextMin,
    nextMax,
    normalize = orderedRange
) {
    if (
        String(nextMin).trim() === '' ||
        String(nextMax).trim() === '' ||
        !Number.isFinite(Number(nextMin)) ||
        !Number.isFinite(Number(nextMax))
    )
        return null
    return normalize(currentMin, currentMax, nextMin, nextMax)
}

export function resolveCogExpression(configured, current) {
    return current != null ? current : configured || ''
}

export function nextCogExpression(value, configured = '') {
    return value == null ? null : String(value || configured || '')
}

export function formatVideoTime(seconds) {
    if (!Number.isFinite(Number(seconds)) || Number(seconds) < 0) return '0:00'
    const value = Number(seconds)
    return `${Math.floor(value / 60)}:${Math.floor(value % 60).toString().padStart(2, '0')}`
}
