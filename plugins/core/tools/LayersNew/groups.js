export function getHeaderDescendants(rows, headerName) {
    const start = rows.findIndex((row) => row.name === headerName)
    if (start < 0) return []
    const header = rows[start]
    const end = rows.findIndex(
        (row, index) => index > start && row.depth <= header.depth
    )
    return rows.slice(start + 1, end < 0 ? rows.length : end)
}

export function groupTogglePlan(rows, headerName, visibilityMemory, states) {
    const children = getHeaderDescendants(rows, headerName).filter(
        (row) => !row.structural
    )
    const on = children
        .filter((row) => states[row.name] === true)
        .map((row) => row.name)
    if (on.length > 0)
        return { names: on, memory: on, turningOn: false }
    const memory = visibilityMemory || []
    return {
        names: memory.length > 0 ? memory : children.map((row) => row.name),
        memory,
        turningOn: true,
    }
}
