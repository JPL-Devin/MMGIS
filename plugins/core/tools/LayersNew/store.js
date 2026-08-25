import { create } from 'zustand'

export const initialLayersNewState = {
    layerTree: [],
    layerState: {},
    loading: {},
    headerStates: {},
    headerVisibility: {},
    search: '',
    typeFilters: [],
    visibleOnly: false,
    activeFilterOnly: false,
    selectedLayer: null,
    settingsTab: 'settings',
    settingsInvoker: null,
    settingsPresentation: 'list',
    orderingHistory: [],
    cogScaleLayer: null,
}

export const useLayersNewStore = create((set) => ({
    ...initialLayersNewState,
    setLayerTree: (layerTree) => set({ layerTree }),
    setLayerState: (name, patch) =>
        set((state) => ({
            layerState: {
                ...state.layerState,
                [name]: { ...(state.layerState[name] || {}), ...patch },
            },
        })),
    setLayerStates: (layerState) => set({ layerState }),
    setLoading: (name, loading) =>
        set((state) => ({ loading: { ...state.loading, [name]: loading } })),
    setHeaderState: (name, expanded) =>
        set((state) => ({
            headerStates: { ...state.headerStates, [name]: expanded },
        })),
    setHeaderVisibility: (name, children) =>
        set((state) => ({
            headerVisibility: {
                ...state.headerVisibility,
                [name]: children,
            },
        })),
    setSearch: (search) => set({ search }),
    setTypeFilters: (typeFilters) => set({ typeFilters }),
    setVisibleOnly: (visibleOnly) => set({ visibleOnly }),
    setActiveFilterOnly: (activeFilterOnly) => set({ activeFilterOnly }),
    selectLayer: (selectedLayer) => set({ selectedLayer }),
    setSettingsTab: (settingsTab) => set({ settingsTab }),
    setSettingsInvoker: (settingsInvoker) => set({ settingsInvoker }),
    setSettingsPresentation: (settingsPresentation) =>
        set({ settingsPresentation }),
    setOrderingHistory: (orderingHistory) => set({ orderingHistory }),
    setCogScaleLayer: (cogScaleLayer) => set({ cogScaleLayer }),
    teardown: () =>
        set({
            layerTree: [],
            layerState: {},
            loading: {},
            headerStates: {},
            headerVisibility: {},
            search: '',
            typeFilters: [],
            visibleOnly: false,
            activeFilterOnly: false,
            orderingHistory: [],
            selectedLayer: null,
            settingsTab: 'settings',
            settingsInvoker: null,
            settingsPresentation: 'list',
            cogScaleLayer: null,
        }),
}))

export function orderingHistoryString(history) {
    return (history || [])
        .map((entry) => `${entry[0]}-${entry[1]}-${entry[2]}`)
        .join('.')
}

export function resetLayersNewStore() {
    useLayersNewStore.setState(initialLayersNewState)
}
