import { useMemo } from 'react'

import LayerTypeRegistry from '@basics/Layers_/registry/LayerTypeRegistry'
import { useLayersNewStore } from '../store'
import { universalSections } from '../components/Settings/UniversalSections'

export function countActiveFilters(filter) {
    return (
        (filter?.values || []).filter(
            (value) =>
                value &&
                !value.isGroup &&
                (value.type != null ||
                    value.key != null ||
                    value.value != null)
        ).length + (filter?.spatial?.center != null ? 1 : 0)
    )
}

export function createLayerSettingsApi(layer, layerName, adapters) {
    const { layers, legend } = adapters
    return {
        get: (path) =>
            path.split('.').reduce((value, key) => value?.[key], layer),
        set: (path, value) => {
            layers.set(layerName, path, value)
        },
        isOn: () => layers.getLayerState(layerName).on,
        setVisibility: (value) => layers.setVisibility(layerName, value),
        ensureOn: async () => {
            if (!layers.getLayerState(layerName).on)
                await layers.toggleLayer(layerName)
        },
        opacity: () => layers.getLayerState(layerName).opacity,
        setOpacity: (value) => layers.setOpacity(layerName, value),
        restyle: () => layers.restyle(layer),
        refreshLayer: () => layers.refreshLayer(layerName),
        refreshLegend: () => legend.refresh(layer),
        resetSettings: () => layers.resetSettings(layerName),
        getDynamicStyle: () => layers.getDynamicStyle(layer),
        getDynamicStyleRules: () => layers.getDynamicStyleRules(layer),
        getDynamicStyleDomain: () => layers.getDynamicStyleDomain(layer),
        getDynamicStyleStats: (property) =>
            layers.getDynamicStyleStats(layer, property),
        ensureFieldStats: () => layers.ensureDynamicStyleFieldStats(layer),
        getStatsFields: () => layers.getDynamicStyleStatsFields(layer),
        getActiveFilterCount: () => {
            const filter = layers.getFilters?.()?.[layerName]
            return countActiveFilters(filter)
        },
        getAttachmentCount: () =>
            Object.values(adapters.attachments.getAttachments(layerName))
                .filter((attachment) => attachment !== false).length,
        overrideDynamicStyle: (override) =>
            layers.overrideDynamicStyle(layer, override),
        overrideDynamicStyleRule: (index, patch) =>
            layers.overrideDynamicStyleRule(layer, index, patch),
        attachments: adapters.attachments,
        notify: (kind, message) => layers.notify(kind, message),
        runtime: () => layers.getLayerRuntime(layerName),
        globe: () => layers.globe(),
        vars: () => layer.variables || {},
        capabilities: () => LayerTypeRegistry.capabilities(layer.type),
        withTitiler:
            typeof window !== 'undefined' &&
            window.mmgisglobal?.WITH_TITILER === 'true',
    }
}

export function useLayerSettings(adapters) {
    const { layers } = adapters
    const layerName = useLayersNewStore((state) => state.selectedLayer)
    const settingsTab = useLayersNewStore((state) => state.settingsTab)
    return useMemo(() => {
        if (!layerName) return null
        const layer = layers.getLayerData(layerName)
        if (!layer) return null
        const settings = LayerTypeRegistry.getSettings(layer.type)
        const universalAdapters = {
            layers,
            attachments: adapters.attachments,
            time: adapters.time,
        }
        const ctx = {
            capabilities: LayerTypeRegistry.capabilities(layer.type),
            api: createLayerSettingsApi(layer, layerName, adapters),
            isOn: layers.getLayerState(layerName).on,
            runtime: layers.getLayerRuntime(layerName),
            vars: layer.variables || {},
            settingsTab,
        }
        let typeSections = []
        try {
            typeSections = (settings?.sections?.(layer, ctx) || []).map(
                (section) => ({
                    ...section,
                    owner: section.owner || layer.type,
                })
            )
        } catch (error) {
            typeSections = [
                {
                    id: 'type-settings-error',
                    label: 'Type settings',
                    Component: () => {
                        throw error
                    },
                },
            ]
        }
        const universal = universalSections(
            layer,
            layerName,
            universalAdapters,
            ctx
        )
        const typeIds = new Set(typeSections.map((section) => section.id))
        const sections = [
            ...universal.filter((section) => !typeIds.has(section.id)),
            ...typeSections,
        ].filter((section) => section.hidden !== true)
        let configuredTabs = null
        try {
            configuredTabs = settings?.tabs?.(layer, ctx) || null
        } catch {
            configuredTabs = null
        }
        const tabIds = [
            ...new Set(
                sections.map((section) => section.tab || 'settings')
            ),
        ]
        const tabs = [
            ...(configuredTabs || []),
            ...tabIds
                .filter(
                    (id) =>
                        !(configuredTabs || []).some(
                            (tab) => (tab.id || tab.value) === id
                        )
                )
                .map((id) => ({
                    id,
                    label: id.charAt(0).toUpperCase() + id.slice(1),
                })),
        ].map((tab) => ({
            value: tab.id || tab.value,
            label: tab.label,
        }))
        return {
            layer,
            layerName,
            ctx,
            sections,
            tabs,
            summary:
                settings && typeof settings.summary === 'function'
                    ? settings.summary(layer, ctx)
                    : '',
            parentPath: findParentPath(layers.getTree?.() || [], layerName),
        }
    }, [adapters, layers, layerName, settingsTab])
}

function findParentPath(nodes, target, parents = []) {
    for (const node of Array.isArray(nodes) ? nodes : []) {
        if (node.name === target) return parents
        const found = findParentPath(node.sublayers, target, [
            ...parents,
            node.display_name || node.name,
        ])
        if (found) return found
    }
    return []
}
