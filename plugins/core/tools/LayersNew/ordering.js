export function subtreeEnd(rows, index) {
    const row = rows[index]
    if (!row || !row.structural) return index + 1
    let end = index + 1
    while (end < rows.length && rows[end].depth > row.depth) end += 1
    return end
}

export function canDropRows(rows, oldIndex, newIndex) {
    if (oldIndex === newIndex) return true
    const end = subtreeEnd(rows, oldIndex)
    return !(newIndex > oldIndex && newIndex < end)
}

export function dropDepth(rows, oldIndex, newIndex, afterHeader = 0) {
    const end = subtreeEnd(rows, oldIndex)
    const next = [...rows.slice(0, oldIndex), ...rows.slice(end)]
    const insertion = Math.max(0, Math.min(newIndex, next.length))
    const previous = next[insertion - 1]
    if (!previous) return 0
    if (previous.structural && afterHeader === 2)
        return previous.depth + 1
    if (previous.structural && afterHeader === 1)
        return previous.depth
    return previous.depth
}

export function moveRows(rows, oldIndex, newIndex, afterHeader = 0) {
    if (
        oldIndex < 0 ||
        oldIndex >= rows.length ||
        newIndex < 0 ||
        newIndex >= rows.length ||
        !canDropRows(rows, oldIndex, newIndex)
    )
        return rows

    const end = subtreeEnd(rows, oldIndex)
    const block = rows.slice(oldIndex, end)
    const next = [...rows.slice(0, oldIndex), ...rows.slice(end)]
    let insertion = newIndex
    insertion = Math.max(0, Math.min(insertion, next.length))
    const nextDepth = dropDepth(rows, oldIndex, newIndex, afterHeader)
    const delta = nextDepth - block[0].depth
    const moved = block.map((row) => ({
        ...row,
        depth: Math.max(0, row.depth + delta),
    }))
    next.splice(insertion, 0, ...moved)
    return next
}

export function replayOrderingHistory(rows, history) {
    return (history || []).reduce(
        (current, [oldIndex, newIndex, afterHeader]) =>
            moveRows(current, oldIndex, newIndex, afterHeader),
        rows
    )
}

export function orderedLeafNames(rows) {
    return rows.filter((row) => !row.structural).map((row) => row.name)
}
