import { useEffect, useMemo } from 'react'

import { RESTYLED_EVENT } from '@basics/Layers_/render/dynamicStyleRuntime'
import { useLayersNewStore } from '../store'

export function flattenLayerTree(tree, adapter) {
    const rows = []
    const visit = (nodes, parent = null, depth = 0) => {
        ;(Array.isArray(nodes) ? nodes : []).forEach((node) => {
            if (!node || typeof node !== 'object') return
            const name = node.name
            const data = adapter.getLayerData(name) || node
            const type = data.type || node.type
            const row = {
                name,
                displayName: data.display_name || node.display_name || name,
                description: data.description || node.description || '',
                tags: data.tags || node.tags || [],
                type,
                depth,
                parent,
                structural: adapter.isStructural(type),
                ...adapter.getLayerState(name),
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
        const tag = value.slice(1)
        return row.tags.some((entry) => String(entry).toLowerCase().includes(tag))
    }
    return [row.name, row.displayName, row.description, ...row.tags]
        .join(' ')
        .toLowerCase()
        .includes(value)
}

export function useLayerTree(adapter) {
    const tree = useLayersNewStore((state) => state.layerTree)
    const search = useLayersNewStore((state) => state.search)

    useEffect(() => {
        const refresh = () => {
            const nextTree = adapter.getTree()
            const rows = flattenLayerTree(nextTree, adapter)
            useLayersNewStore.getState().setLayerTree(rows)
            useLayersNewStore.getState().setLayerStates(
                adapter.getLayerStates()
            )
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
        () => tree.filter((row) => rowMatchesSearch(row, search)),
        [tree, search]
    )
}
