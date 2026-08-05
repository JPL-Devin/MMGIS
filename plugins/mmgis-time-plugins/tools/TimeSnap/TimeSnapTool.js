import React, { useState, useEffect, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import F_ from '@basics/Formulae_/Formulae_'
import { IconButton } from '@design/components'

import './TimeSnapTool.css'

const SUB_ID = 'timeSnapTool'

// Every time-enabled layer that keeps its features (and therefore their
// timestamps) client-side, so their real event times can be read directly.
const getLocalTimeLayers = () => {
    const out = []
    Object.keys(L_.layers.data || {}).forEach((name) => {
        const d = L_.layers.data[name]
        if (d == null || d.time == null || d.time.enabled !== true) return
        if (d.time.startProp == null && d.time.endProp == null) return
        out.push(name)
    })
    return out
}

const sourceGeoJSON = (layerName) => {
    const cached = L_._localTimeFilterCache
        ? L_._localTimeFilterCache[layerName]
        : null
    if (cached && cached.features) return cached
    const layer = L_.layers.layer[layerName]
    if (layer && layer._sourceGeoJSON && layer._sourceGeoJSON.features)
        return layer._sourceGeoJSON
    return null
}

// Sorted, de-duplicated epoch-ms list of every feature time on a layer.
const getEventTimes = (layerName) => {
    const geojson = sourceGeoJSON(layerName)
    if (geojson == null) return []
    const d = L_.layers.data[layerName]
    const prop = d.time.endProp || d.time.startProp
    const times = {}
    geojson.features.forEach((f) => {
        const v = F_.getIn(f.properties, prop, null)
        if (v == null) return
        const t = new Date(v).getTime()
        if (!isNaN(t)) times[t] = true
    })
    return Object.keys(times)
        .map((t) => parseInt(t))
        .sort((a, b) => a - b)
}

const HISTOGRAM_BINS = 40

const histogram = (times, startMs, endMs) => {
    const bins = new Array(HISTOGRAM_BINS).fill(0)
    if (endMs <= startMs) return bins
    const span = endMs - startMs
    times.forEach((t) => {
        if (t < startMs || t > endMs) return
        let i = Math.floor(((t - startMs) / span) * HISTOGRAM_BINS)
        if (i >= HISTOGRAM_BINS) i = HISTOGRAM_BINS - 1
        bins[i]++
    })
    return bins
}

const iso = (ms) => new Date(ms).toISOString().split('.')[0] + 'Z'

const TimeSnapPanel = () => {
    const [times, setTimes] = useState({
        start: TimeControl.getStartTime(),
        end: TimeControl.getEndTime(),
        current: TimeControl.getTime(),
    })
    const [tick, setTick] = useState(0)

    const refresh = useCallback(() => {
        setTimes({
            start: TimeControl.getStartTime(),
            end: TimeControl.getEndTime(),
            current: TimeControl.getTime(),
        })
        setTick((t) => t + 1)
    }, [])

    useEffect(() => {
        TimeControl.subscribe(SUB_ID, refresh)
        return () => TimeControl.unsubscribe(SUB_ID)
    }, [refresh])

    if (!TimeControl.enabled)
        return (
            <div className='timeSnapTool_empty'>
                The time bar is disabled for this mission, so there is nothing
                to snap to.
            </div>
        )

    const layerNames = getLocalTimeLayers()
    const perLayer = layerNames.map((name) => ({
        name,
        times: getEventTimes(name),
    }))
    const allTimes = []
    perLayer.forEach((l) => allTimes.push(...l.times))
    allTimes.sort((a, b) => a - b)

    const startMs = new Date(times.start).getTime()
    const endMs = new Date(times.end).getTime()
    const currentMs = new Date(times.current).getTime()
    const windowMs = endMs - startMs

    // Move the playhead to an actual event time, keeping the window length so
    // the layers that filter on the window still show that event.
    const snapTo = (t) => {
        if (t == null) return
        TimeControl.setTime(iso(t - windowMs), iso(t), false, '00:00:00', iso(t))
        setTimeout(refresh, 0)
    }

    const next = allTimes.find((t) => t > currentMs)
    const prevCandidates = allTimes.filter((t) => t < currentMs)
    const prev = prevCandidates.length
        ? prevCandidates[prevCandidates.length - 1]
        : null

    const nearest = allTimes
        .map((t) => ({ t, d: Math.abs(t - currentMs) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 8)
        .sort((a, b) => a.t - b.t)

    return (
        <div className='timeSnapTool_content'>
            <div className='timeSnapTool_playhead'>
                <div className='timeSnapTool_label'>Playhead</div>
                <div className='timeSnapTool_value'>{times.current}</div>
            </div>
            <div className='timeSnapTool_nav'>
                <button
                    className='timeSnapTool_button'
                    disabled={prev == null}
                    onClick={() => snapTo(prev)}
                    title={prev == null ? 'No earlier event' : iso(prev)}
                >
                    <i className='mdi mdi-skip-previous mdi-18px' />
                    Prev event
                </button>
                <button
                    className='timeSnapTool_button'
                    disabled={next == null}
                    onClick={() => snapTo(next)}
                    title={next == null ? 'No later event' : iso(next)}
                >
                    Next event
                    <i className='mdi mdi-skip-next mdi-18px' />
                </button>
            </div>
            {allTimes.length === 0 ? (
                <div className='timeSnapTool_empty'>
                    No feature times found. TimeSnap reads times off features
                    held client-side, so a time-enabled layer needs
                    <code> time.startProp</code> or <code>time.endProp</code>{' '}
                    and its data loaded.
                </div>
            ) : (
                <>
                    <div className='timeSnapTool_gap'>
                        {prev != null && (
                            <div>
                                {(
                                    (currentMs - prev) /
                                    3600000
                                ).toFixed(2)}{' '}
                                h since previous event
                            </div>
                        )}
                        {next != null && (
                            <div>
                                {((next - currentMs) / 3600000).toFixed(2)} h
                                until next event
                            </div>
                        )}
                    </div>
                    {perLayer.map((l) => {
                        const bins = histogram(l.times, startMs, endMs)
                        const max = Math.max(1, ...bins)
                        const inWindow = bins.reduce((a, b) => a + b, 0)
                        return (
                            <div className='timeSnapTool_layer' key={l.name}>
                                <div className='timeSnapTool_layerHeader'>
                                    <div title={l.name}>
                                        {L_.layers.data[l.name].display_name ||
                                            l.name}
                                    </div>
                                    <div>
                                        {inWindow}/{l.times.length}
                                    </div>
                                </div>
                                <div className='timeSnapTool_hist'>
                                    {bins.map((c, i) => (
                                        <div
                                            key={i}
                                            className='timeSnapTool_bin'
                                            style={{
                                                height: `${
                                                    (c / max) * 100
                                                }%`,
                                                opacity: c === 0 ? 0.15 : 1,
                                            }}
                                            title={`${c} feature${
                                                c === 1 ? '' : 's'
                                            }`}
                                        />
                                    ))}
                                    <div
                                        className='timeSnapTool_playheadLine'
                                        style={{
                                            left: `${Math.min(
                                                100,
                                                Math.max(
                                                    0,
                                                    ((currentMs - startMs) /
                                                        (windowMs || 1)) *
                                                        100
                                                )
                                            )}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                    <div className='timeSnapTool_label'>
                        Nearest event times
                    </div>
                    <div className='timeSnapTool_list'>
                        {nearest.map(({ t }) => (
                            <div
                                key={t}
                                className={`timeSnapTool_listItem${
                                    t === currentMs ? ' isCurrent' : ''
                                }`}
                                onClick={() => snapTo(t)}
                            >
                                {iso(t)}
                            </div>
                        ))}
                    </div>
                </>
            )}
            <div className='timeSnapTool_hiddenTick'>{tick}</div>
        </div>
    )
}

let TimeSnapTool = {
    height: 0,
    width: 340,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        TimeSnapTool._root = createRoot(toolPanel)
        TimeSnapTool._root.render(
            <div className='timeSnapTool'>
                <div className='mmgisToolHeader'>
                    <div>
                        <div>
                            <div className='mmgisToolTitle'>TimeSnap</div>
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
                <TimeSnapPanel />
            </div>
        )
    },

    destroy: function () {
        TimeControl.unsubscribe(SUB_ID)
        if (TimeSnapTool._root) {
            TimeSnapTool._root.unmount()
            TimeSnapTool._root = null
        }
    },
}

export { getEventTimes, histogram, HISTOGRAM_BINS }
export default TimeSnapTool
