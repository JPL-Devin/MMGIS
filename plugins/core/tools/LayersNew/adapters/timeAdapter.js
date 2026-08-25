export function timestamp(value) {
    if (value == null || value === '') return null
    const result = typeof value === 'number' ? value : Date.parse(value)
    return Number.isFinite(result) ? result : null
}

export function createTimeAdapter({ timeUI, toast }) {
    const notifier = toast || { error: () => {}, info: () => {} }
    return {
        getData: (layer) => layer.time || {},
        updateTimes: (start, end, current) =>
            timeUI.updateTimes(start, end, current),
        setGlobalFromExtent: (layerOrStart, end) => {
            const time =
                layerOrStart && typeof layerOrStart === 'object'
                    ? layerOrStart.time || {}
                    : null
            const parsedStart = timestamp(
                time ? time.dataStartTime : layerOrStart
            )
            const parsedEnd = timestamp(time ? time.dataEndTime : end)
            if (parsedStart == null || parsedEnd == null) {
                notifier.error('Layer data extent not configured!', 3000)
                return false
            }
            timeUI.updateTimes(parsedStart, parsedEnd, parsedEnd)
            notifier.info('Global time set to layer extent.', 3000)
            return true
        },
    }
}
