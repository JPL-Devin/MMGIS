export function timestamp(value) {
    if (value == null || value === '') return null
    const result = typeof value === 'number' ? value : Date.parse(value)
    return Number.isFinite(result) ? result : null
}

export function createTimeAdapter(dependencies = {}) {
    const timeUI =
        dependencies.timeUI ||
        require('@basics/TimeControl_/TimeUI').default
    return {
        updateTimes: (start, end, current) =>
            timeUI.updateTimes(start, end, current),
        setGlobalFromExtent: (start, end) => {
            const parsedStart = timestamp(start)
            const parsedEnd = timestamp(end)
            if (parsedStart == null || parsedEnd == null) return false
            timeUI.updateTimes(parsedStart, parsedEnd, parsedEnd)
            return true
        },
    }
}

let defaultAdapter
const getDefaultAdapter = () => {
    if (!defaultAdapter) defaultAdapter = createTimeAdapter()
    return defaultAdapter
}

const timeAdapter = new Proxy(
    {},
    {
        get: (_, property) => (...args) =>
            getDefaultAdapter()[property](...args),
    }
)

export default timeAdapter
