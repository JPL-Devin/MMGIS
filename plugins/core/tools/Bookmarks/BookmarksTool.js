import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import { IconButton } from '@design/components'

import './BookmarksTool.css'

// Served under ROOT_PATH; window.mmgisglobal.ROOT_PATH is '' at the root.
const ROOT = (window.mmgisglobal && window.mmgisglobal.ROOT_PATH) || ''
const API = `${ROOT}/api/mapBookmarks`

function currentMission() {
    return L_.mission || (L_.configData && L_.configData.msv && L_.configData.msv.mission) || 'default'
}

function BookmarksPanel() {
    const [bookmarks, setBookmarks] = useState([])
    const [name, setName] = useState('')
    const [error, setError] = useState(null)
    const mission = currentMission()

    const refresh = useCallback(() => {
        fetch(`${API}/get?mission=${encodeURIComponent(mission)}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.status === 'success') setBookmarks(d.body || [])
                else setError(d.message || 'Failed to load')
            })
            .catch((e) => setError(String(e)))
    }, [mission])

    useEffect(() => {
        refresh()
    }, [refresh])

    const save = () => {
        const c = Map_.map.getCenter()
        const body = {
            mission,
            name: name || `View @ ${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`,
            lat: c.lat,
            lng: c.lng,
            zoom: Map_.map.getZoom(),
        }
        fetch(`${API}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then((r) => r.json())
            .then((d) => {
                if (d.status === 'success') {
                    setName('')
                    refresh()
                } else setError(d.message || 'Failed to save')
            })
            .catch((e) => setError(String(e)))
    }

    const remove = (id) => {
        fetch(`${API}/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })
            .then((r) => r.json())
            .then(() => refresh())
            .catch((e) => setError(String(e)))
    }

    const flyTo = (b) => {
        Map_.resetView([b.lat, b.lng, b.zoom])
    }

    return (
        <div className='bookmarksTool_content'>
            <div className='bookmarksTool_add'>
                <input
                    type='text'
                    placeholder='Name this view…'
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
                <IconButton size='sm' onClick={save} title='Save current view'>
                    <i className='mdi mdi-bookmark-plus mdi-18px' />
                </IconButton>
            </div>
            {error && <div className='bookmarksTool_error'>{error}</div>}
            <ul className='bookmarksTool_list'>
                {bookmarks.length === 0 && (
                    <li className='bookmarksTool_empty'>No bookmarks yet.</li>
                )}
                {bookmarks.map((b) => (
                    <li key={b.id} className='bookmarksTool_item'>
                        <button
                            className='bookmarksTool_go'
                            onClick={() => flyTo(b)}
                            title={`z${b.zoom} · ${b.lat.toFixed(3)}, ${b.lng.toFixed(3)}`}
                        >
                            <i className='mdi mdi-map-marker mdi-18px' />
                            <span>{b.name}</span>
                        </button>
                        <IconButton size='sm' onClick={() => remove(b.id)} title='Delete'>
                            <i className='mdi mdi-delete mdi-18px' />
                        </IconButton>
                    </li>
                ))}
            </ul>
        </div>
    )
}

let BookmarksTool = {
    height: 0,
    width: 300,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        BookmarksTool._root = createRoot(toolPanel)
        BookmarksTool._root.render(
            <div className='bookmarksTool'>
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
                <BookmarksPanel />
            </div>
        )
    },

    destroy: function () {
        if (BookmarksTool._root) {
            BookmarksTool._root.unmount()
            BookmarksTool._root = null
        }
    },
}

export default BookmarksTool
