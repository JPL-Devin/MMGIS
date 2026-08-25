import { useEffect, useMemo } from 'react'

import { RESTYLED_EVENT } from '@basics/Layers_/render/dynamicStyleRuntime'
import { useLayersNewStore } from '../store'
import { replayOrderingHistory } from '../ordering'

export function flattenLayerTree(tree, adapter) {
    const rows = []
    const toolVars = adapter.getToolVars?.() || {}
    const visit = (nodes, parent = null, depth = 0) => {
        ;(Array.isArray(nodes) ? nodes : []).forEach((node) => {
            if (!node || typeof node !== 'object') return
            const name = node.name
            const data = adapter.getLayerData(name) || node
            const type = data.type || node.type
            const layerState = adapter.getLayerState(name)
            const row = {
                name,
                displayName: data.display_name || node.display_name || name,
                description: data.description || node.description || '',
                tags: Array.isArray(data.tags || node.tags)
                    ? data.tags || node.tags
                    : [],
                type,
                depth,
                parent,
                structural: adapter.isStructural(type),
                childCount: Array.isArray(node.sublayers)
                    ? node.sublayers.length
                    : 0,
                filtered: adapter.isFilterable?.(name)
                    ? layerHasActiveFilter(name, adapter)
                    : false,
                timeEnabled: Boolean(
                    data.time?.enabled === true || node.time?.enabled === true
                ),
                defaultExpanded:
                    toolVars.expanded === true ||
                    data.variables?.expanded === true ||
                    node.variables?.expanded === true,
                ...layerState,
            }
            rows.push(row)
            if (Array.isArray(node.sublayers))
                visit(node.sublayers, name, depth + 1)
        })
    }
    visit(tree)
    return rows
}

export function rowMatchesSearch(row, search) {
    const value = String(search || '').trim().toLowerCase()
    if (!value) return true
    if (value.startsWith('#')) {
        const tag = value.slice(1).split(':').pop()
        return (row.tags || []).some((entry) =>
            String(entry).toLowerCase().includes(tag)
        )
    }
    return [row.name, row.displayName, row.description, ...(row.tags || [])]
        .join(' ')
        .toLowerCase()
        .includes(value)
}

export function layerHasActiveFilter(layerName, adapter) {
    const layer = adapter.getLayerData(layerName)
    if (!layer || !adapter.isFilterable?.(layerName)) return false

    if (layer._filterEncoded) {
        if (layer._filterEncoded.filters) return true
        if (layer._filterEncoded.spatialFilter) return true
    }

    const filter = adapter.getFilters?.()?.[layerName]
    if (filter) {
        if (
            filter.values &&
            filter.values.some(
                (value) => value && !value.isGroup && value.type != null
            )
        )
            return true
        if (filter.spatial && filter.spatial.center != null) return true
    }
    return false
}

export function getAvailableLayerTypes(rows) {
    return [
        ...new Set(
            rows
                .filter((row) => !row.structural && row.type)
                .map((row) => row.type)
        ),
    ]
}

export function getLayerFilterPresentation(row, state, adapter) {
    const types = state.typeFilters || []
    return {
        forceOff:
            types.length > 0 &&
            !row.structural &&
            !types.includes(row.type),
        forceOff2:
            state.visibleOnly === true && !row.structural && row.on !== true,
        forceOff3:
            state.activeFilterOnly === true &&
            !row.structural &&
            !layerHasActiveFilter(row.name, adapter),
    }
}

export function filterLayerRows(rows, state, adapter) {
    const search = String(state.search || '').trim()
    const typeFilters = state.typeFilters || []
    const visibleOnly = state.visibleOnly === true
    const activeFilterOnly = state.activeFilterOnly === true
    const matching = new Set(
        rows
            .filter((row) => !row.structural)
            .filter(
                (row) =>
                    typeFilters.length === 0 || typeFilters.includes(row.type)
            )
            .filter((row) => !visibleOnly || row.on)
            .filter(
                (row) =>
                    !activeFilterOnly ||
                    layerHasActiveFilter(row.name, adapter)
            )
            .filter((row) => rowMatchesSearch(row, search))
            .map((row) => row.name)
    )
    const includeAll = !search && !typeFilters.length && !visibleOnly &&
        !activeFilterOnly
    const rowsByName = new Map(rows.map((row) => [row.name, row]))
    const included = new Set(matching)
    matching.forEach((name) => {
        let row = rowsByName.get(name)
        while (row?.parent) {
            included.add(row.parent)
            row = rowsByName.get(row.parent)
        }
    })

    const visible = []
    rows.forEach((row) => {
        if (!row.structural && !included.has(row.name)) return
        if (row.structural && !includeAll && !included.has(row.name)) return
        let parent = row.parent
        while (parent) {
            const parentRow = rowsByName.get(parent)
            if (
                parentRow &&
                (state.headerStates || {})[parent] === false &&
                !search
            )
                return
            parent = parentRow?.parent
        }
        visible.push(row)
    })
    return visible
}

export function useLayerTree(adapter) {
    const tree = useLayersNewStore((state) => state.layerTree)
    const state = useLayersNewStore((current) => ({
        search: current.search,
        typeFilters: current.typeFilters,
        visibleOnly: current.visibleOnly,
        activeFilterOnly: current.activeFilterOnly,
        headerStates: current.headerStates,
        orderingHistory: current.orderingHistory,
    }))

    useEffect(() => {
        const refresh = () => {
            const nextTree = adapter.getTree()
            const rows = flattenLayerTree(nextTree, adapter)
            const orderingHistory =
                useLayersNewStore.getState().orderingHistory
            const orderedRows = replayOrderingHistory(rows, orderingHistory)
            useLayersNewStore.getState().setLayerTree(orderedRows)
            useLayersNewStore.getState().setLayerStates(
                adapter.getLayerStates()
            )
            orderedRows.filter((row) => row.structural).forEach((row) => {
                const current = useLayersNewStore.getState().headerStates
                if (current[row.name] == null)
                    useLayersNewStore.getState().setHeaderState(
                        row.name,
                        row.defaultExpanded === true
                    )
            })
        }
        refresh()
        const unsubscribe = adapter.subscribeOnLayerToggle(
            refresh,
            'LayersNewTree'
        )
        document.addEventListener('layersToolHeaderStateChange', refresh)
        document.addEventListener('layerVisibilityChange', refresh)
        document.addEventListener('layerRefreshStatusChanged', refresh)
        document.addEventListener(RESTYLED_EVENT, refresh)
        return () => {
            unsubscribe()
            document.removeEventListener(
                'layersToolHeaderStateChange',
                refresh
            )
            document.removeEventListener('layerVisibilityChange', refresh)
            document.removeEventListener(
                'layerRefreshStatusChanged',
                refresh
            )
            document.removeEventListener(RESTYLED_EVENT, refresh)
        }
    }, [adapter])

    return useMemo(
        () =>
            filterLayerRows(tree, state, adapter).map((row) => ({
                ...row,
                ...getLayerFilterPresentation(row, state, adapter),
                expanded:
                    state.search.trim() !== '' ||
                    state.headerStates[row.name] !== false,
            })),
        [tree, state, adapter]
    )
}
