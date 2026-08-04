import React from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import { IconButton } from '@design/components'

import './ViewBookmarksTool.css'

const parseLayerNames = (layers) => {
    if (Array.isArray(layers)) return layers.filter((n) => typeof n === 'string')
    if (typeof layers !== 'string') return []
    return layers
        .split(',')
        .map((n) => n.trim())
        .filter((n) => n !== '')
}

// Reads the tool's mission config variables into a normalized shape
export const readBookmarks = (vars) => {
    const bookmarks = Array.isArray(vars?.bookmarks) ? vars.bookmarks : []
    const defaultZoom =
        vars?.defaultZoom != null && !isNaN(parseInt(vars.defaultZoom))
            ? parseInt(vars.defaultZoom)
            : null

    return bookmarks
        .filter(
            (b) =>
                b != null &&
                !isNaN(parseFloat(b.longitude)) &&
                !isNaN(parseFloat(b.latitude))
        )
        .map((b, idx) => ({
            key: `${b.name || 'bookmark'}_${idx}`,
            name: b.name || `Bookmark ${idx + 1}`,
            description: b.description || null,
            group: b.group || null,
            icon: b.icon || 'map-marker',
            longitude: parseFloat(b.longitude),
            latitude: parseFloat(b.latitude),
            zoom:
                b.zoom != null && !isNaN(parseInt(b.zoom))
                    ? parseInt(b.zoom)
                    : defaultZoom,
            layers: parseLayerNames(b.layers),
        }))
}

// Groups bookmarks by their `group` field; ungrouped come first under ''
export const groupBookmarks = (bookmarks) => {
    const groups = new Map()
    bookmarks.forEach((b) => {
        const key = b.group || ''
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key).push(b)
    })
    return Array.from(groups.entries())
        .sort((a, b) => (a[0] === '' ? -1 : b[0] === '' ? 1 : 0))
        .map(([name, items]) => ({ name, items }))
}

const applyLayers = async (layerNames, exclusive) => {
    if (layerNames.length === 0) return

    const wanted = new Set(layerNames)
    const flat = L_.layers?.dataFlat || []

    for (const layer of flat) {
        if (layer?.name == null) continue
        if (layer.type === 'header') continue

        const shouldBeOn = wanted.has(layer.name)
        const isOn = L_.layers.on[layer.name] === true

        if (shouldBeOn && !isOn) await L_.toggleLayer(layer)
        else if (exclusive && !shouldBeOn && isOn) await L_.toggleLayer(layer)
    }
}

let ViewBookmarksTool = {
    height: 0,
    width: 300,
    vars: {},
    _root: null,

    initialize: function () {
        this.vars = L_.getToolVars('viewbookmarks') || {}
    },

    use: async function (bookmark) {
        if (bookmark == null) return
        await applyLayers(bookmark.layers, this.vars.exclusiveLayers === true)
        Map_.resetView([bookmark.latitude, bookmark.longitude, bookmark.zoom])
    },

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        const vars = (this.vars = L_.getToolVars('viewbookmarks') || {})
        const bookmarks = readBookmarks(vars)
        const showDescriptions = vars.showDescriptions === true
        const grouped =
            vars.groupBookmarks === true
                ? groupBookmarks(bookmarks)
                : [{ name: '', items: bookmarks }]

        const renderBookmark = (b) => (
            <li
                key={b.key}
                className='viewBookmarksTool_item'
                title={b.description || b.name}
                onClick={() => ViewBookmarksTool.use(b)}
            >
                <i className={`mdi mdi-${b.icon} mdi-18px`} />
                <div>
                    <div className='viewBookmarksTool_itemName'>{b.name}</div>
                    {showDescriptions && b.description ? (
                        <div className='viewBookmarksTool_itemDesc'>
                            {b.description}
                        </div>
                    ) : null}
                </div>
            </li>
        )

        ViewBookmarksTool._root = createRoot(toolPanel)
        ViewBookmarksTool._root.render(
            <div className='viewBookmarksTool'>
                <div className='mmgisToolHeader'>
                    <div>
                        <div>
                            <div className='mmgisToolTitle'>Bookmarks</div>
                        </div>
                        <div>
                            <IconButton
                                size='sm'
                                onClick={() => ToolController_.closeActiveTool()}
                                title='Close Tool'
                            >
                                <i className='mdi mdi-close mdi-18px' />
                            </IconButton>
                        </div>
                    </div>
                </div>
                <div className='viewBookmarksTool_content'>
                    {bookmarks.length === 0 ? (
                        <div className='viewBookmarksTool_empty'>
                            No bookmarks configured. Add them in the Configure
                            page under Tools &gt; ViewBookmarks.
                        </div>
                    ) : (
                        grouped.map((g) => (
                            <div key={g.name || '__ungrouped'}>
                                {g.name ? (
                                    <div className='viewBookmarksTool_group'>
                                        {g.name}
                                    </div>
                                ) : null}
                                <ul className='viewBookmarksTool_list'>
                                    {g.items.map(renderBookmark)}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            </div>
        )
    },

    destroy: function () {
        if (ViewBookmarksTool._root) {
            ViewBookmarksTool._root.unmount()
            ViewBookmarksTool._root = null
        }
    },
}

export default ViewBookmarksTool
