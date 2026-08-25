export function getChildCounts(row, allRows, visibleRows) {
    const visibleNames = new Set(visibleRows.map((value) => value.name))
    const byName = new Map(allRows.map((value) => [value.name, value]))
    const descendants = allRows.filter((value) => {
        if (value.structural) return false
        let parent = value.parent
        while (parent) {
            if (parent === row.name) return true
            parent = byName.get(parent)?.parent
        }
        return false
    })
    const matching = descendants.filter((value) => visibleNames.has(value.name))
    return {
        on: matching.filter((value) => value.on === true).length,
        total: matching.length,
    }
}

export function badgeText(tags) {
    const values = Array.isArray(tags) ? tags : []
    if (values.length === 0) return null
    if (values.length === 1 && String(values[0]).length >= 4)
        return String(values[0])
    return `#${values.length}`
}
