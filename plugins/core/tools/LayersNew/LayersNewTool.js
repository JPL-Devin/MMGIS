import React from 'react'
import { createRoot } from 'react-dom/client'

import { layersNewAdapters } from './adapters/runtimeAdapters'
import LayersPanel from './components/LayersPanel'
import {
    useLayersNewStore,
    orderingHistoryString,
} from './store'

import './LayersNewTool.css'

function getLayers() {
    return require('@basics/Layers_/Layers_').default
}

function getToolController() {
    return require('@basics/ToolController_/ToolController_').default
}

function getFiltering() {
    return require('@basics/Layers_/Filtering/Filtering').default
}

function restoreOrderingHistory(toolName, history) {
    const L_ = getLayers()
    const futures = L_.FUTURES?.tools || []
    const entry = futures.find((value) => {
        const name = String(value).split('$')[0]
        return name === toolName
    })
    if (entry == null) return

    const encoded = String(entry).split('$')[1]
    if (!encoded) return
    history.length = 0
    encoded.split('.').forEach((value) => {
        const parts = value.split('-').map((part) => parseInt(part, 10))
        if (parts.length === 3 && parts.every(Number.isFinite))
            history.push(parts)
    })
}

const LayersNewTool = {
    height: 0,
    width: 350,
    vars: {},
    orderingHistory: [],
    _root: null,

    initialize() {
        const L_ = getLayers()
        this.vars = L_.getToolVars('layersnew') || {}
        this.width = this.vars.width || 350

        if (L_.UserInterface_?.isMobile === true) {
            const map = document.getElementById('map')
            const mapRect = map?.getBoundingClientRect()
            this.width = 'full'
            this.height = Math.round((mapRect?.height || 0) * 0.7)
        }
    },

    make() {
        const toolPanel = document.getElementById('toolPanel')
        if (!toolPanel) return

        if (this._root == null) {
            this._root = createRoot(toolPanel)
        }
        this._root.render(
            <LayersPanel
                onClose={() => getToolController().closeActiveTool()}
                adapters={layersNewAdapters}
            />
        )
    },

    destroy() {
        if (this._root) {
            this._root.unmount()
            this._root = null
        }
        useLayersNewStore.getState().teardown()
    },

    finalize() {
        const Filtering = getFiltering()
        restoreOrderingHistory('LayersNewTool', this.orderingHistory)
        useLayersNewStore
            .getState()
            .setOrderingHistory([...this.orderingHistory])
        if (this.orderingHistory.length > 0)
            layersNewAdapters.layers.applyOrderingHistory(
                this.orderingHistory
            )
        Filtering.initialize()
    },

    getUrlString() {
        return orderingHistoryString(this.orderingHistory)
    },

    populateCogScale(name) {
        useLayersNewStore.getState().setCogScaleLayer(name)
    },
}

export default LayersNewTool
