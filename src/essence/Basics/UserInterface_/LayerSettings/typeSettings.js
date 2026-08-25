export function resolveColormap(value, fallback = 'viridis', data = {}) {
    let name = typeof value === 'string' && value ? value : fallback
    const reverse = name.toLowerCase().endsWith('_r')
    if (reverse) name = name.slice(0, -2)
    const key = Object.keys(data).find((candidate) => candidate.toLowerCase() === name.toLowerCase())
    return { name: key || name, reverse }
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
