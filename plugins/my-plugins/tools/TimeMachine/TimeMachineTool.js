import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { IconButton } from '@design/components'

import './TimeMachineTool.css'

// Available playback step sizes (label -> seconds).
const STEP_OPTIONS = [
    { label: '1 min', s: 60 },
    { label: '1 hr', s: 3600 },
    { label: '6 hr', s: 21600 },
    { label: '1 day', s: 86400 },
    { label: '7 day', s: 604800 },
    { label: '30 day', s: 2592000 },
]

// Playback speeds (steps per second of wall-clock time).
const SPEED_OPTIONS = [0.5, 1, 2, 4, 8]

const toISO = (ms) => new Date(ms).toISOString().split('.')[0] + 'Z'

const fmt = (iso) => {
    if (!iso) return '—'
    return String(iso).replace('T', ' ').replace('Z', '')
}

function TimeMachinePanel() {
    // Whether MMGIS global time is enabled for this mission.
    const enabled = TimeControl.enabled === true

    // The full playback range, captured from the current global window.
    const [range, setRange] = useState({ start: null, end: null })
    // Width (ms) of the sliding window that stays fixed during playback.
    const windowMsRef = useRef(0)
    // Current playback cursor (ms) — the trailing edge / "now" of the window.
    const [cursor, setCursor] = useState(0)
    const cursorRef = useRef(0)

    const [playing, setPlaying] = useState(false)
    const [stepS, setStepS] = useState(86400)
    const [speed, setSpeed] = useState(1)
    const timerRef = useRef(null)

    // Capture the mission's configured window as the playable range.
    const capture = () => {
        if (!enabled) return
        const s = Date.parse(TimeControl.getStartTime())
        const e = Date.parse(TimeControl.getEndTime())
        if (isNaN(s) || isNaN(e) || e <= s) return
        windowMsRef.current = e - s
        setRange({ start: s, end: e })
        cursorRef.current = e
        setCursor(e)
    }

    useEffect(() => {
        capture()
        return () => stop()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Push the sliding window [cursor - windowMs, cursor] to MMGIS.
    const applyCursor = (ms) => {
        const winStart = ms - windowMsRef.current
        TimeControl.setTime(toISO(winStart), toISO(ms), false, '00:00:00', toISO(ms))
    }

    const clamp = (ms) => {
        if (range.start == null) return ms
        return Math.max(range.start, Math.min(range.end, ms))
    }

    const goTo = (ms) => {
        const c = clamp(ms)
        cursorRef.current = c
        setCursor(c)
        applyCursor(c)
    }

    const stepBy = (dir) => goTo(cursorRef.current + dir * stepS * 1000)

    const stop = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const play = () => {
        if (!enabled || range.start == null) return
        // Restart from the beginning if we're already at the end.
        if (cursorRef.current >= range.end) goTo(range.start)
        setPlaying(true)
        stop()
        timerRef.current = setInterval(() => {
            const next = cursorRef.current + stepS * 1000
            if (next >= range.end) {
                goTo(range.end)
                pause()
                return
            }
            goTo(next)
        }, 1000 / speed)
    }

    const pause = () => {
        setPlaying(false)
        stop()
    }

    // Keep interval cadence in sync with the selected speed while playing.
    useEffect(() => {
        if (playing) play()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [speed])

    const progress =
        range.start != null && range.end > range.start
            ? ((cursor - range.start) / (range.end - range.start)) * 100
            : 0

    if (!enabled) {
        return (
            <div className='timeMachineTool_content'>
                <div className='timeMachine_notice'>
                    Global time is not enabled for this mission. Enable{' '}
                    <code>time</code> in the mission config to use the Time
                    Machine.
                </div>
            </div>
        )
    }

    return (
        <div className='timeMachineTool_content'>
            <div className='timeMachine_readout'>
                <div className='timeMachine_now'>{fmt(toISO(cursor))}</div>
                <div className='timeMachine_range'>
                    <span>{fmt(range.start && toISO(range.start))}</span>
                    <span>{fmt(range.end && toISO(range.end))}</span>
                </div>
                <input
                    className='timeMachine_slider'
                    type='range'
                    min={range.start ?? 0}
                    max={range.end ?? 1}
                    value={cursor}
                    onChange={(e) => {
                        pause()
                        goTo(parseInt(e.target.value, 10))
                    }}
                />
                <div className='timeMachine_progress'>
                    {progress.toFixed(0)}%
                </div>
            </div>

            <div className='timeMachine_controls'>
                <IconButton size='sm' title='Jump to start' onClick={() => { pause(); goTo(range.start) }}>
                    <i className='mdi mdi-skip-backward mdi-18px' />
                </IconButton>
                <IconButton size='sm' title='Step back' onClick={() => { pause(); stepBy(-1) }}>
                    <i className='mdi mdi-step-backward mdi-18px' />
                </IconButton>
                {playing ? (
                    <IconButton size='sm' title='Pause' onClick={pause}>
                        <i className='mdi mdi-pause mdi-24px' />
                    </IconButton>
                ) : (
                    <IconButton size='sm' title='Play' onClick={play}>
                        <i className='mdi mdi-play mdi-24px' />
                    </IconButton>
                )}
                <IconButton size='sm' title='Step forward' onClick={() => { pause(); stepBy(1) }}>
                    <i className='mdi mdi-step-forward mdi-18px' />
                </IconButton>
                <IconButton size='sm' title='Jump to end' onClick={() => { pause(); goTo(range.end) }}>
                    <i className='mdi mdi-skip-forward mdi-18px' />
                </IconButton>
            </div>

            <div className='timeMachine_settings'>
                <label>
                    Step
                    <select
                        value={stepS}
                        onChange={(e) => setStepS(parseInt(e.target.value, 10))}
                    >
                        {STEP_OPTIONS.map((o) => (
                            <option key={o.s} value={o.s}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Speed
                    <select
                        value={speed}
                        onChange={(e) => setSpeed(parseFloat(e.target.value))}
                    >
                        {SPEED_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                                {s}×
                            </option>
                        ))}
                    </select>
                </label>
                <IconButton size='sm' title='Re-read range from time bar' onClick={() => { pause(); capture() }}>
                    <i className='mdi mdi-refresh mdi-18px' />
                </IconButton>
            </div>
        </div>
    )
}

let TimeMachineTool = {
    height: 0,
    width: 320,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''

        TimeMachineTool._root = createRoot(toolPanel)
        TimeMachineTool._root.render(
            <div className='timeMachineTool'>
                <div className='mmgisToolHeader'>
                    <div>
                        <div>
                            <div className='mmgisToolTitle'>Time Machine</div>
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
                <TimeMachinePanel />
            </div>
        )
    },

    destroy: function () {
        if (TimeMachineTool._root) {
            TimeMachineTool._root.unmount()
            TimeMachineTool._root = null
        }
    },
}

export default TimeMachineTool
