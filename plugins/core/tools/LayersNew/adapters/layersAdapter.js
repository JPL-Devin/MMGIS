import $ from 'jquery'

import {
    orderedLeafNames,
    replayOrderingHistory,
} from '../ordering'
import { transformStacUrl } from '@basics/Layers_/LayerUtils'
import { resolveJsColormap } from '@basics/Layers_/render/rampUtils'
import {
    evaluate_cmap,
} from '@external/js-colormaps/js-colormaps.js'
import { velocityRange } from '@basics/UserInterface_/LayerSettings/typeSettings'

const RASTER_TYPES = new Set(['tile', 'image', 'data', 'velocity'])

function browserBaseUrl() {
    return `${window.location.origin}${(window.location.pathname || '').replace(
        /\/$/g,
        ''
    )}`
}

export function resolveLayerOpacity(layers, name) {
    const runtime = layers.layers?.layer?.[name]
    const runtimeOpacity = runtime
        ? Number(layers.getLayerOpacity(name))
        : Number.NaN
    if (runtime && Number.isFinite(runtimeOpacity)) return runtimeOpacity
    const configuredOpacity = Number(layers.layers?.opacity?.[name])
    return layers.layers?.opacity?.[name] != null &&
        Number.isFinite(configuredOpacity)
        ? configuredOpacity
        : 1
}

function resolveRasterColormap(value, fallback) {
    return resolveJsColormap(value, fallback)
}

function tileCoordinates(layer, invertTms = true) {
    const bounds = layer.boundingBox
    const zoom = Math.max(
        0,
        Math.min(
            Number(layer.previewZoom) || Number(layer.minZoom) || 3,
            18
        )
    )
    if (!Array.isArray(bounds) || bounds.length < 4) return [zoom, 0, 0]
    const longitude = (Number(bounds[0]) + Number(bounds[2])) / 2
    const latitude = Math.max(-85.0511, Math.min(85.0511, (Number(bounds[1]) + Number(bounds[3])) / 2))
    const scale = 2 ** zoom
    const x = Math.floor(((longitude + 180) / 360) * scale)
    const y = Math.floor(
        ((1 -
            Math.log(
                Math.tan((latitude * Math.PI) / 180) +
                    1 / Math.cos((latitude * Math.PI) / 180)
            ) /
                Math.PI) /
            2) *
            scale
    )
    const tileY =
        invertTms && (layer.tileformat === 'tms' || layer.tms === true)
            ? scale - 1 - y
            : y
    return [zoom, Math.max(0, Math.min(scale - 1, x)), Math.max(0, Math.min(scale - 1, tileY))]
}

function fillTileTemplate(url, layer, invertTms = true) {
    const [z, x, y] = tileCoordinates(layer, invertTms)
    return url
        .replace(/\{z\}/gi, z)
        .replace(/\{x\}/gi, x)
        .replace(/\{y\}/gi, y)
        .replace(/\{s\}/gi, 'a')
        .replace(/\{time\}/gi, layer.time?.end || '')
}

function missionRasterSource(layers, formulae, source) {
    let value = source || ''
    if (value.startsWith('COG:')) value = value.slice(4)
    if (formulae.isUrlAbsolute(value)) return value
    value = `${layers.missionPath || ''}${value}`
    if (formulae.isUrlAbsolute(value)) return value
    return `/${value}`
}

function getRasterPreviewUrl(layers, formulae, layer) {
    if (!layer || !RASTER_TYPES.has(layer.type)) return null
    const source = layer.url || layer.demtileurl || ''
    const sourceType = layer.sourceType || layer.demSourceType || ''
    const isCog =
        source.startsWith('COG:') ||
        (sourceType.toLowerCase() === 'cog' && !source.startsWith('http')) ||
        (layer.type === 'image' && /\.(tif|tiff)$/i.test(source))
    const isStac =
        source.startsWith('stac-collection:') ||
        sourceType.toLowerCase() === 'stac-collection'
    if (isCog) {
        const query = new URLSearchParams({
            url: missionRasterSource(layers, formulae, source),
        })
        if (layer.cogColormap) query.set('colormap_name', layer.cogColormap)
        if (layer.cogMin != null && layer.cogMax != null)
            query.set('rescale', `[${layer.cogMin},${layer.cogMax}]`)
        if (layer.cogBands?.[0] != null)
            query.set('bidx', layer.cogBands[0])
        if (layer.demparser === 'terrarium')
            query.set('algorithm', 'terrarium')
        if (layer.demparser === 'terrainrgb')
            query.set('algorithm', 'terrainrgb')
        return fillTileTemplate(
            `${browserBaseUrl()}/titiler/cog/tiles/${
                layer.tileMatrixSet || 'WebMercatorQuad'
            }/{z}/{x}/{y}.png?${query.toString()}`,
            layer,
            false
        )
    }
    if (isStac) {
        const normalized = source.startsWith('stac-collection:')
            ? source
            : `stac-collection:${source}`
        const endpoint = layer.type === 'data' ? 'preview' : 'tiles'
        const transformed = transformStacUrl(
            normalized,
            layer,
            endpoint,
            window.location
        )
        return endpoint === 'tiles' ? fillTileTemplate(transformed, layer) : transformed
    }
    if (!source.includes('{z}') || !source.includes('{x}') || !source.includes('{y}'))
        return null
    const resolved = layers.getUrl(layer.type, source, layer)
    return fillTileTemplate(resolved, layer)
}

export function createLayersAdapter({
    layers,
    map,
    globe,
    formulae,
    filtering,
    registry,
    resetDynamicStyle,
    restyleDynamicStyle,
    dynamicStyle,
    viewedDynamicStyleRules,
    dynamicStyleDomain,
    dynamicStylePropertyStats,
    ensureDynamicStyleFieldStats,
    dynamicStyleStatsFields,
    overrideDynamicStyleRule,
    toast,
    info,
    legend,
}) {
    const layerData = (name) => {
        const uuid = layers.asLayerUUID(name) || name
        return layers.layers?.data?.[uuid] || layers.layers?.data?.[name]
    }

    const adapter = {
        getTree: () => layers.configData?.layers || [],
        getLayerData: layerData,
        getLayerRuntime: (name) => layers.layers?.layer?.[name],
        getLayerState: (name) => ({
            on: layers.layers?.on?.[name] === true,
            opacity: resolveLayerOpacity(layers, name),
            loading: layers.layers?.loading?.[name] === true,
            refreshFailed: layers.layers?.refreshFailed?.[name] === true,
        }),
        getLayerStates: () => {
            const names = Object.keys(layers.layers?.data || {})
            return Object.fromEntries(
                names.map((name) => [name, {
                    on: layers.layers?.on?.[name] === true,
                    opacity: resolveLayerOpacity(layers, name),
                    loading: layers.layers?.loading?.[name] === true,
                    refreshFailed: layers.layers?.refreshFailed?.[name] === true,
                }])
            )
        },
        getOrderedNames: () => [...(layers._layersOrdered || [])],
        getAvailableLayerTypes: () =>
            [...new Set(
                (layers.layers?.dataFlat || [])
                    .filter((layer) => layer?.type && layer.type !== 'header')
                    .map((layer) => layer.type)
            )],
        getToolVars: () => layers.getToolVars('layersnew') || {},
        isMobile: () => layers.UserInterface_?.isMobile === true,
        isStructural: (typeId) => registry.isStructural(typeId),
        getTypeConfig: (typeId) => registry.getConfig(typeId),
        getLayerThumbnailUrl: (name) =>
            getRasterPreviewUrl(layers, formulae, layerData(name)),
        isFilterable: (name) => filtering.isFilterable(name),
        getFilters: (name) =>
            name
                ? layers.layers?.filters?.[name] || {}
                : filtering.filters,
        toggleLayer: (name) => {
            const layer = layerData(name)
            return layer ? layers.toggleLayer(layer) : undefined
        },
        setOpacity: (name, value) => layers.setLayerOpacity(name, value),
        setVisibility: (name, value) => {
            if (layers.layers?.on?.[name] === (value === true)) return
            return layers.toggleLayer(layerData(name))
        },
        setGlobalLoading: (name) => layers.setGlobalLoading(name),
        setGlobalLoaded: (name) => layers.setGlobalLoaded(name),
        set: (name, path, value) => {
            const layer = layerData(name)
            if (!layer) return
            const parts = path.split('.')
            const last = parts.pop()
            const target = parts.reduce(
                (valueAtPath, key) =>
                    valueAtPath[key] || (valueAtPath[key] = {}),
                layer
            )
            target[last] = value
        },
        resetSettings: (name) => {
            layers.setLayerOpacity(name, 1)
            if (layers.layers?.filters) adapter.setFilter(name, 'clear')
            else layers.setLayerFilter(name, 'clear')
            resetDynamicStyle(layerData(name), null)
        },
        setFilter: (name, filter, value) => {
            const runtime = layers.layers?.layer?.[name]
            if (runtime) return layers.setLayerFilter(name, filter, value)
            layers.layers.filters = layers.layers.filters || {}
            layers.layers.filters[name] = layers.layers.filters[name] || {}
            if (filter === 'clear') layers.layers.filters[name] = {}
            else layers.layers.filters[name][filter] = value
        },
        updateRange: (name, min, max, type) => {
            const layer = layerData(name)
            const runtime = layers.layers?.layer?.[layer?.name || name]
            if (!layer || !runtime) return
            if (type === 'velocity') {
                const range = velocityRange(
                    runtime.options?.minVelocity,
                    runtime.options?.maxVelocity,
                    min,
                    max
                )
                layer.currentCogMin = range.min
                layer.currentCogMax = range.max
                runtime.options.minVelocity = range.min
                runtime.options.maxVelocity = range.max
                map.map?.removeLayer(runtime)
                runtime.addTo?.(map.map)
            } else if (type === 'image') {
                layer.currentCogMin = min
                layer.currentCogMax = max
                const georaster = runtime.options?.georaster
                if (!georaster?.numberOfRasters || georaster.numberOfRasters !== 1)
                    return
                const { colormap: cmap, reverse } = resolveRasterColormap(
                    layer.cogColormap,
                    'binary'
                )
                const hideNoData = layer.variables?.hideNoDataValue === true
                const fillMinMax = layer.variables?.image?.fillMinMax === true
                runtime.options.pixelValuesToColorFn = (values) => {
                    const pixel = values[0]
                    if (georaster.noDataValue != null && pixel === georaster.noDataValue)
                        return hideNoData ? null : [0, 0, 0]
                    let scaled = (pixel - min) / (max - min)
                    if (scaled < 0 || scaled > 1) {
                        if (!fillMinMax) return null
                        scaled = Math.max(0, Math.min(1, scaled))
                    }
                    return evaluate_cmap(scaled, cmap, reverse)
                }
                runtime.clearCache?.()
                runtime.updateColors?.(runtime.options.pixelValuesToColorFn)
            } else {
                layer.currentCogMin = min
                layer.currentCogMax = max
                runtime.refresh?.(null, true, {
                    currentCogMin: min,
                    currentCogMax: max,
                })
                globe?.litho?.updateLayerCogParameters?.(layer.name, {
                    currentCogMin: min,
                    currentCogMax: max,
                })
            }
            legend?.refreshLegends?.()
        },
        updateColormap: (name, value, type) => {
            const layer = layerData(name)
            if (!layer) return
            if (type === 'velocity')
                layer.variables = {
                    ...layer.variables,
                    streamlines: {
                        ...layer.variables?.streamlines,
                        colorScale: value,
                    },
                }
            else layer.cogColormap = value
            const min = layer.currentCogMin ?? layer.cogMin ?? 0
            const max = layer.currentCogMax ?? layer.cogMax ?? 1
            return adapter.updateRange(name, min, max, type)
        },
        updateExpression: (name, value) => {
            const layer = layerData(name)
            const runtime = layers.layers?.layer?.[layer?.name || name]
            if (!layer || !runtime) return
            layer.currentCogExpression = value
            runtime.refresh?.(null, true, { currentCogExpression: value })
            globe?.litho?.updateLayerCogParameters?.(layer.name, {
                currentCogExpression: value,
            })
        },
        discoverStac: async (name) => {
            const layer = layerData(name)
            const source = layer?.url || ''
            if (!source.startsWith('stac-collection:')) return []
            const preview = transformStacUrl(
                source,
                layer,
                'preview',
                typeof window !== 'undefined' ? window.location : null
            )
            const infoUrl = preview.replace(/\/preview(?:\?.*)?$/, '/info')
            const response = await fetch(infoUrl)
            if (!response.ok) throw new Error(`STAC discovery failed (${response.status})`)
            const info = await response.json()
            const assets = Object.keys(info.assets || {}).map((asset) => ({
                value: asset,
                label: asset,
            }))
            const bands = (info.bands || []).map((band, index) => {
                const value = band?.common_name || band?.name || index + 1
                return { value: String(value), label: String(value) }
            })
            return { assets, bands }
        },
        resetTypeSettings: (name, type) => {
            const layer = layerData(name)
            if (!layer) return
            layer.currentCogMin = null
            layer.currentCogMax = null
            layer.currentCogExpression = null
            adapter.setFilter(name, 'clear')
            if (type !== 'velocity') map.refreshLayer?.(layer)
            legend?.refreshLegends?.()
        },
        populateCogScale: (name) =>
            layers.populateCogScale?.(name) ||
            (typeof window !== 'undefined' &&
                window.ToolController_?.getTool?.('LayersTool')?.populateCogScale?.(name)),
        videoElement: (name) =>
            layers.layers?.layer?.[name]?.getElement?.() || null,
        getDynamicStyle: (layer) => dynamicStyle(layer),
        getDynamicStyleRules: (layer) => viewedDynamicStyleRules(layer),
        getDynamicStyleDomain: (layer) => dynamicStyleDomain(layer),
        getDynamicStyleStats: (layer, property) =>
            dynamicStylePropertyStats(layer, property),
        ensureDynamicStyleFieldStats: (layer) =>
            ensureDynamicStyleFieldStats(layer),
        getDynamicStyleStatsFields: (layer) => dynamicStyleStatsFields(layer),
        overrideDynamicStyle: (layer, override) =>
            resetDynamicStyle(layer, override),
        overrideDynamicStyleRule: (layer, index, patch) =>
            overrideDynamicStyleRule(layer, index, patch),
        restyle: (layer) => restyleDynamicStyle(layer),
        notify: (kind, message) => {
            if (kind === 'error') return toast.error(message, 3000)
            return toast.info(message)
        },
        reorder: (ordered) => layers.reorderLayers(ordered),
        applyOrderingHistory: (history) => {
            const rows = []
            const visit = (nodes, depth = 0) =>
                (Array.isArray(nodes) ? nodes : []).forEach((node) => {
                    const data = layerData(node.name) || node
                    const type = data.type || node.type
                    rows.push({
                        name: node.name,
                        depth,
                        structural: registry.isStructural(type),
                    })
                    visit(node.sublayers, depth + 1)
                })
            visit(layers.configData?.layers)
            const ordered = orderedLeafNames(
                replayOrderingHistory(rows, history)
            )
            layers.reorderLayers(ordered)
            map.orderedBringToFront()
            return ordered
        },
        orderedBringToFront: () => map.orderedBringToFront(),
        refreshLayer: (name) => {
            const layer = layerData(name)
            if (!layer) return
            const runtime = layers.layers?.layer?.[layer.name || name]
            if (runtime === null || layer.type === 'tile') return
            if (layer.controlled === true) return
            try {
                return map.refreshLayer(layer)
            } catch (error) {
                return undefined
            }
        },
        fitBounds: (bounds) => map.map?.fitBounds(bounds),
        globe: () => globe,
        getSafeName: (name) => formulae.getSafeName(name),
        escapeHtml: (value) => formulae.escapeHtml(value),
        getDynamicProps: (name) => layers.getDynamicProps(name),
        getAggregations: (name, context) =>
            filtering.getAggregations(name, context),
        applyFilter: (name, context) => filtering.applyFilter(name, context),
        mountFilter: (container, name) =>
            filtering.make($(container), name),
        destroyFilter: () => filtering.destroy(),
        locate: (name) => {
            const data = layerData(name)
            const runtime = layers.layers?.layer?.[name]
            if (!data || !runtime) {
                toast.warning('Unable to locate layer.', 4000)
                return false
            }
            if (layers.layers?.on?.[name] !== true) {
                toast.warning(
                    'Please turn the layer on before locating.',
                    4000
                )
                return false
            }
            try {
                if (typeof runtime.getBounds === 'function')
                    map.map.fitBounds(runtime.getBounds())
                else if (data.boundingBox)
                    map.map.fitBounds([
                        [data.boundingBox[1], data.boundingBox[0]],
                        [data.boundingBox[3], data.boundingBox[2]],
                    ])
                else {
                    toast.warning('Unable to locate layer.', 4000)
                    return false
                }
                return true
            } catch (error) {
                toast.warning('Unable to locate layer.', 4000)
                return false
            }
        },
        openInfo: (name) => info.open(name),
        refreshFailed: (name) => layers.layers?.refreshFailed?.[name] === true,
        initializeFiltering: () => filtering.initialize(),
        subscribeOnLayerToggle: (callback, subscriptionId = 'LayersNew') => {
            layers.subscribeOnLayerToggle(subscriptionId, callback)
            return () => layers.unsubscribeOnLayerToggle(subscriptionId)
        },
    }
    return adapter
}
