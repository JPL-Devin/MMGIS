import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import Globe_ from '@basics/Globe_/Globe_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { IconButton } from '@design/components'

import './BookmarksTool.css'

const apiBase = () =>
    `${window.mmgisglobal.ROOT_PATH ? window.mmgisglobal.ROOT_PATH + '/' : ''}api/bookmarks`

const api = async (method, path = '', body) => {
    const r = await fetch(apiBase() + path, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    })
    return r.json()
}

const captureView = () => {
    const c = Map_.map.getCenter()
    const time = TimeControl.enabled
        ? {
              start: TimeControl.getStartTime(),
              end: TimeControl.getEndTime(),
              current: TimeControl.getTime(),
          }
        : null
    return {
        center: { lat: c.lat, lng: c.lng },
        zoom: Map_.map.getZoom(),
        layers: Object.keys(L_.layers.on).filter((n) => L_.layers.on[n] === true),
        time,
        globe: L_.hasGlobe === true,
    }
}

const applyView = async (view) => {
    Map_.resetView([view.center.lat, view.center.lng, view.zoom])
    if (L_.hasGlobe && Globe_.litho && Globe_.litho.setCenter) {
        Globe_.litho.setCenter({
            lat: view.center.lat,
            lng: view.center.lng,
            zoom: view.zoom,
        })
    }
    const wanted = new Set(view.layers || [])
    for (const name of Object.keys(L_.layers.data)) {
        const layer = L_.layers.data[name]
        if (layer.type === 'header') continue
        const isOn = L_.layers.on[name] === true
        if (wanted.has(name) !== isOn) await L_.toggleLayer(layer)
    }
    if (view.time && TimeControl.enabled && view.time.start && view.time.end) {
        TimeControl.setTime(view.time.start, view.time.end, false, undefined, view.time.current)
    }
}

const iconFor = (view) => {
    if (view.globe) return 'mdi-earth'
    if (view.zoom >= 14) return 'mdi-magnify-plus-outline'
    if (view.zoom <= 6) return 'mdi-map-outline'
    return 'mdi-map-marker-radius-outline'
}

function BookmarksPanel() {
    const [bookmarks, setBookmarks] = useState([])
    const [name, setName] = useState('')
    const [shared, setShared] = useState(false)
    const [status, setStatus] = useState('')

    const refresh = async () => {
        const res = await api('GET', `?mission=${encodeURIComponent(L_.mission)}`)
        if (res.status === 'success') setBookmarks(res.body)
        else setStatus(res.message || 'Failed to load bookmarks.')
    }
    useEffect(() => {
        refresh()
    }, [])

    const save = async () => {
        if (!name.trim()) return setStatus('Enter a name first.')
        const res = await api('POST', '', {
            mission: L_.mission,
            name: name.trim(),
            shared,
            view: captureView(),
        })
        setStatus(res.message || '')
        if (res.status === 'success') {
            setName('')
            refresh()
        }
    }
    const remove = async (id) => {
        const res = await api('DELETE', `/${id}`)
        setStatus(res.message || '')
        refresh()
    }

    const mine = bookmarks.filter((b) => b.isOwner)
    const others = bookmarks.filter((b) => !b.isOwner)

    const Item = ({ b }) => (
        <li className='bookmarksTool_item' onClick={() => applyView(b.view)} title='Fly to this view'>
            <i className={`mdi ${iconFor(b.view)} mdi-24px`} />
            <div className='bookmarksTool_itemBody'>
                <div className='bookmarksTool_itemName'>
                    {b.name}
                    {b.shared && <span className='bookmarksTool_badge'>shared</span>}
                </div>
                <div className='bookmarksTool_itemMeta'>
                    {b.view.center.lat.toFixed(4)}, {b.view.center.lng.toFixed(4)} · z{b.view.zoom} ·{' '}
                    {(b.view.layers || []).length} layers
                    {!b.isOwner && ` · by ${b.owner}`}
                </div>
            </div>
            {b.isOwner && (
                <IconButton
                    size='sm'
                    title='Delete bookmark'
                    onClick={(e) => {
                        e.stopPropagation()
                        remove(b.id)
                    }}
                >
                    <i className='mdi mdi-delete mdi-18px' />
                </IconButton>
            )}
        </li>
    )

    return (
        <div className='bookmarksTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div>
                        <div className='mmgisToolTitle'>Bookmarks</div>
                    </div>
                    <div>
                        <IconButton size='sm' onClick={() => ToolController_.closeActiveTool()} title='Close Tool'>
                            <i className='mdi mdi-close mdi-18px' />
                        </IconButton>
                    </div>
                </div>
            </div>
            <div className='bookmarksTool_content'>
                <div className='bookmarksTool_save'>
                    <input
                        type='text'
                        placeholder='Name this view...'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && save()}
                    />
                    <label title='Visible to all users of this mission'>
                        <input type='checkbox' checked={shared} onChange={(e) => setShared(e.target.checked)} />
                        Shared
                    </label>
                    <button onClick={save} title='Save current view'>
                        <i className='mdi mdi-bookmark-plus mdi-18px' /> Save
                    </button>
                </div>
                {status && <div className='bookmarksTool_status'>{status}</div>}
                <div className='bookmarksTool_section'>My Bookmarks ({mine.length})</div>
                <ul>
                    {mine.map((b) => (
                        <Item key={b.id} b={b} />
                    ))}
                    {mine.length === 0 && <li className='bookmarksTool_empty'>No saved views yet.</li>}
                </ul>
                <div className='bookmarksTool_section'>Shared with Mission ({others.length})</div>
                <ul>
                    {others.map((b) => (
                        <Item key={b.id} b={b} />
                    ))}
                    {others.length === 0 && <li className='bookmarksTool_empty'>Nothing shared by others.</li>}
                </ul>
            </div>
        </div>
    )
}

let BookmarksTool = {
    height: 0,
    width: 320,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''
        BookmarksTool._root = createRoot(toolPanel)
        BookmarksTool._root.render(<BookmarksPanel />)
    },

    destroy: function () {
        if (BookmarksTool._root) {
            BookmarksTool._root.unmount()
            BookmarksTool._root = null
        }
    },
}

export default BookmarksTool
