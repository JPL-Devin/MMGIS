import React from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { IconButton } from '@design/components'

import { eventsInWindow } from '../../lib/eventsInWindow'

import './EventTimelineTool.css'

const EVENT_TYPE_ID = 'missionevents'
const SUBSCRIPTION_ID = 'EventTimelineTool'

/** Every on, missionevents layer's features, as {layerName, geojson, layerObj}. */
function eventLayers() {
    return Object.keys(L_.layers.data)
        .filter(
            (name) =>
                L_.layers.data[name]?.type === EVENT_TYPE_ID &&
                L_.layers.on[name] === true
        )
        .map((name) => ({
            layerName: name,
            layerObj: L_.layers.data[name],
            geojson: L_.layers.layer[name]?.toGeoJSON
                ? L_.layers.layer[name].toGeoJSON()
                : L_.layers.data[name]?._geojson,
        }))
}

function currentWindow() {
    if (!TimeControl.enabled) return { start: null, end: null }
    return { start: TimeControl.getStartTime(), end: TimeControl.getEndTime() }
}

const EventList = ({ rows, window_ }) => (
    <div className='eventTimelineTool_content'>
        <div className='eventTimelineTool_window'>
            {window_.start
                ? `${window_.start} → ${window_.end}`
                : 'Time is not enabled for this mission.'}
        </div>
        {rows.length === 0 ? (
            <div className='eventTimelineTool_empty'>No events in this window.</div>
        ) : (
            rows.map((r) => (
                <div className='eventTimelineTool_row' key={`${r.layerName}_${r.id}`}>
                    <div className='eventTimelineTool_rowName'>{r.label}</div>
                    <div className='eventTimelineTool_rowMeta'>
                        {r.start}
                        {r.durationSec ? ` · ${Math.round(r.durationSec)}s` : ''}
                    </div>
                </div>
            ))
        )}
    </div>
)

let EventTimelineTool = {
    height: 0,
    width: 340,
    _root: null,

    _render: function () {
        if (!EventTimelineTool._root) return
        const window_ = currentWindow()
        const rows = eventsInWindow(eventLayers(), window_.start, window_.end)
        EventTimelineTool._root.render(
            <div className='eventTimelineTool'>
                <div className='mmgisToolHeader'>
                    <div>
                        <div>
                            <div className='mmgisToolTitle'>Event Timeline</div>
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
                <EventList rows={rows} window_={window_} />
            </div>
        )
    },

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        EventTimelineTool._root = createRoot(toolPanel)
        EventTimelineTool._render()
        TimeControl.subscribe(SUBSCRIPTION_ID, EventTimelineTool._render)
    },

    destroy: function () {
        TimeControl.unsubscribe(SUBSCRIPTION_ID)
        if (EventTimelineTool._root) {
            EventTimelineTool._root.unmount()
            EventTimelineTool._root = null
        }
    },
}

export default EventTimelineTool
