import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import TimeControl from '@basics/TimeControl_/TimeControl'
import { IconButton } from '@design/components'

import { BODIES, bodyFromRadius, solarPosition } from './solar'
import './SolarIlluminationTool.css'

const pad = (n) => String(Math.floor(n)).padStart(2, '0')
const fmtHours = (h) => `${pad(h)}:${pad((h % 1) * 60)}`

function getBody() {
    const v = L_.getToolVars ? L_.getToolVars('SolarIllumination') || {} : {}
    if (v.body && BODIES[String(v.body).toUpperCase()])
        return String(v.body).toUpperCase()
    const msv = (L_.configData && L_.configData.msv) || {}
    return bodyFromRadius(msv.radius && msv.radius.major)
}

function getBaseTime() {
    if (TimeControl.enabled && TimeControl.currentTime)
        return new Date(TimeControl.currentTime)
    return new Date()
}

let _layer = null

function drawArrows(lat, lon, sun) {
    clearArrows()
    const map = Map_.map
    const L = window.L
    const b = map.getBounds()
    const lenDeg = (b.getNorth() - b.getSouth()) * 0.15
    const dest = (azDeg) => {
        const a = azDeg * (Math.PI / 180)
        return [
            lat + lenDeg * Math.cos(a),
            lon + (lenDeg * Math.sin(a)) / Math.cos(lat * (Math.PI / 180)),
        ]
    }
    const group = L.layerGroup()
    group.addLayer(
        L.circleMarker([lat, lon], {
            radius: 6,
            color: '#fff',
            fillColor: '#ffb300',
            fillOpacity: 1,
        })
    )
    if (sun.elevation > 0) {
        group.addLayer(
            L.polyline([[lat, lon], dest(sun.azimuth)], {
                color: '#ffd54f',
                weight: 4,
            })
        )
        group.addLayer(
            L.circleMarker(dest(sun.azimuth), {
                radius: 8,
                color: '#ffd54f',
                fillColor: '#ffeb3b',
                fillOpacity: 1,
            }).bindTooltip('Sun', { permanent: true, direction: 'top' })
        )
        const shadowLen = Math.min(
            5,
            1 / Math.tan(Math.max(sun.elevation, 2) * (Math.PI / 180))
        )
        const sd = dest((sun.azimuth + 180) % 360)
        const shadowEnd = [
            lat + (sd[0] - lat) * shadowLen,
            lon + (sd[1] - lon) * shadowLen,
        ]
        group.addLayer(
            L.polyline([[lat, lon], shadowEnd], {
                color: '#263238',
                weight: 6,
                opacity: 0.7,
                dashArray: '8 6',
            }).bindTooltip('Shadow', { direction: 'auto' })
        )
    }
    group.addTo(map)
    _layer = group
}

function clearArrows() {
    if (_layer && Map_.map) Map_.map.removeLayer(_layer)
    _layer = null
}

function Panel() {
    const body = getBody()
    const [point, setPoint] = useState(null)
    const [baseTime, setBaseTime] = useState(getBaseTime)
    const [offsetMin, setOffsetMin] = useState(0)

    const dayMinutes = Math.round(BODIES[body].dayHours * 60)
    const time = new Date(baseTime.getTime() + offsetMin * 60000)
    const sun = point ? solarPosition(body, time, point.lat, point.lng) : null

    useEffect(() => {
        const onClick = (e) => setPoint(e.latlng)
        Map_.map.on('click', onClick)
        return () => {
            Map_.map.off('click', onClick)
            clearArrows()
        }
    }, [])

    useEffect(() => {
        if (point && sun) drawArrows(point.lat, point.lng, sun)
    }, [point, offsetMin, baseTime])

    return (
        <div className='solarIlluminationTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div>
                        <div className='mmgisToolTitle'>Solar Illumination</div>
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
            <div className='solarIlluminationTool_content'>
                <div className='si_body'>
                    Body: <b>{BODIES[body].name}</b>
                </div>
                {!point ? (
                    <div className='si_hint'>
                        Click on the map to pick a point.
                    </div>
                ) : (
                    <>
                        <div className='si_row'>
                            <span>Lat / Lon</span>
                            <span>
                                {point.lat.toFixed(4)}°, {point.lng.toFixed(4)}°
                            </span>
                        </div>
                        <div className='si_row'>
                            <span>Time (UTC)</span>
                            <input
                                type='datetime-local'
                                value={new Date(
                                    baseTime.getTime() -
                                        baseTime.getTimezoneOffset() * 60000
                                )
                                    .toISOString()
                                    .slice(0, 16)}
                                onChange={(e) => {
                                    const d = new Date(e.target.value)
                                    if (!isNaN(d)) {
                                        setBaseTime(d)
                                        setOffsetMin(0)
                                    }
                                }}
                            />
                        </div>
                        <div className='si_row'>
                            <span>Scrub (±1 {body === 'MARS' ? 'sol' : 'day'})</span>
                            <span>
                                {offsetMin >= 0 ? '+' : '-'}
                                {fmtHours(Math.abs(offsetMin) / 60)}
                            </span>
                        </div>
                        <input
                            className='si_slider'
                            type='range'
                            min={-dayMinutes}
                            max={dayMinutes}
                            step={5}
                            value={offsetMin}
                            onChange={(e) =>
                                setOffsetMin(parseInt(e.target.value))
                            }
                        />
                        <div className='si_values'>
                            <div className='si_value'>
                                <div className='si_label'>Azimuth</div>
                                <div className='si_num'>
                                    {sun.azimuth.toFixed(1)}°
                                </div>
                            </div>
                            <div className='si_value'>
                                <div className='si_label'>Elevation</div>
                                <div
                                    className={`si_num ${
                                        sun.elevation > 0 ? 'si_day' : 'si_night'
                                    }`}
                                >
                                    {sun.elevation.toFixed(1)}°
                                </div>
                            </div>
                            <div className='si_value'>
                                <div className='si_label'>Local Solar Time</div>
                                <div className='si_num'>
                                    {fmtHours(sun.localSolarTime)}
                                </div>
                            </div>
                            <div className='si_value'>
                                <div className='si_label'>
                                    {body === 'MARS' ? 'Ls' : 'Ecl. Lon'}
                                </div>
                                <div className='si_num'>
                                    {sun.seasonAngle.toFixed(1)}°
                                </div>
                            </div>
                        </div>
                        <div className='si_status'>
                            {sun.elevation > 0
                                ? 'Sun is above the horizon; shadow drawn opposite the sun.'
                                : 'Sun is below the horizon at this time.'}
                        </div>
                        <div className='si_time'>{time.toISOString()}</div>
                    </>
                )}
            </div>
        </div>
    )
}

let SolarIlluminationTool = {
    height: 0,
    width: 320,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''
        SolarIlluminationTool._root = createRoot(toolPanel)
        SolarIlluminationTool._root.render(<Panel />)
    },

    destroy: function () {
        if (SolarIlluminationTool._root) {
            SolarIlluminationTool._root.unmount()
            SolarIlluminationTool._root = null
        }
        clearArrows()
    },
}

export default SolarIlluminationTool
