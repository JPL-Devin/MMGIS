import { useEffect, useMemo, useState } from 'react'

import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import { useLayersNewStore } from '../store'

const thumbnailCache = new Map()
const RASTER_TYPES = new Set(['tile', 'image', 'data', 'velocity'])

function getCandidate(name, adapter, signal) {
    const layer = adapter.getLayerData(name)
    if (!layer || !RASTER_TYPES.has(layer.type)) return null
    const settings =
        adapter.getTypeConfig?.(layer.type)?.settings ||
        LayerTypeRegistry.getSettings(layer.type)
    const candidate =
        layer.thumbnail ||
        layer.thumbnailUrl ||
        layer.preview ||
        settings?.thumbnail
    return typeof candidate === 'function'
        ? candidate(layer, adapter.getLayerRuntime(name), signal)
        : candidate
}

export function clearLayerThumbnailCache() {
    thumbnailCache.forEach((value) => {
        if (typeof value === 'string' && value.startsWith('blob:'))
            URL.revokeObjectURL(value)
    })
    thumbnailCache.clear()
}

export function useLayerThumbnail(nameOrAdapter, maybeAdapter) {
    const legacy = typeof nameOrAdapter === 'object' && !maybeAdapter
    const selected = useLayersNewStore((state) => state.selectedLayer)
    const name = legacy ? selected : nameOrAdapter
    const adapter = legacy ? nameOrAdapter : maybeAdapter
    const [thumbnail, setThumbnail] = useState(() =>
        name ? thumbnailCache.get(name) || null : null
    )
    const legacyValue = useMemo(() => {
        if (!legacy || !name || !adapter) return undefined
        const candidate = getCandidate(name, adapter)
        return typeof candidate === 'string' ? candidate : null
    }, [adapter, legacy, name])
    const stableLegacyValue = useMemo(
        () => (legacy ? legacyValue : undefined),
        [legacy, legacyValue]
    )

    useEffect(() => {
        if (!name || !adapter) return undefined
        let disposed = false
        const controller = new AbortController()
        const candidate = getCandidate(name, adapter, controller.signal)
        if (!candidate) {
            setThumbnail(null)
            return () => controller.abort()
        }
        if (thumbnailCache.has(name)) {
            setThumbnail(thumbnailCache.get(name))
            return () => controller.abort()
        }
        const valuePromise =
            typeof candidate === 'string' &&
            !candidate.startsWith('data:') &&
            !candidate.startsWith('blob:')
                ? fetch(candidate, { signal: controller.signal })
                      .then((response) => {
                          if (!response.ok) throw new Error('thumbnail fetch failed')
                          return response.blob()
                      })
                      .then((blob) => URL.createObjectURL(blob))
                : Promise.resolve(candidate)
        valuePromise
            .then((value) => {
                if (disposed || controller.signal.aborted || !value) return
                thumbnailCache.set(name, value)
                setThumbnail(value)
            })
            .catch(() => {})
        return () => {
            disposed = true
            controller.abort()
        }
    }, [adapter, name])

    return legacy ? stableLegacyValue : thumbnail
}
