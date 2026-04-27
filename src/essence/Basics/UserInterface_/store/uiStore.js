import { createStore } from 'zustand/vanilla'
import { applyTheme } from '../../../../design-system/applyTheme'

const uiStore = createStore((set, get) => ({
    themeName: 'Dark Default',
    setTheme: (name) => {
        set({ themeName: name })
        applyTheme(name)
    },

    viewerPanelOpen: false,
    mapPanelOpen: true,
    globePanelOpen: false,

    setViewerPanelOpen: (open) => set({ viewerPanelOpen: open }),
    setMapPanelOpen: (open) => set({ mapPanelOpen: open }),
    setGlobePanelOpen: (open) => set({ globePanelOpen: open }),

    toggleViewerPanel: () =>
        set((state) => ({ viewerPanelOpen: !state.viewerPanelOpen })),
    toggleMapPanel: () =>
        set((state) => ({ mapPanelOpen: !state.mapPanelOpen })),
    toggleGlobePanel: () =>
        set((state) => ({ globePanelOpen: !state.globePanelOpen })),

    toolPanelFloating: true,
    toolPanelWidth: 320,
    toolPanelVisible: false,
    setToolPanelWidth: (width) => set({ toolPanelWidth: width }),
    setToolPanelVisible: (visible) => set({ toolPanelVisible: visible }),
}))

export default uiStore
