import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import F_ from '@basics/Formulae_/Formulae_'
import { IconButton, Slider, Select } from '@design/components'
import Switch from '@design/components/Switch/Switch'

import './GraticuleTool.css'

const L = window.L

const DEG_STEPS = [
    0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 15, 30,
]
const KM_STEPS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]

const defaultState = {
    enabled: true,
    mode: 'latlon', // 'latlon' | 'metric'
    spacing: 'auto', // 'auto' | number (deg or km)
    color: '#ffffff',
    opacity: 0.6,
    labels: true,
}

let state = { ...defaultState }
let gridLayer = null
let labelContainer = null

const fmtDeg = (v, isLat) => {
    const abs = Math.abs(v)
    const hemi = isLat ? (v < 0 ? 'S' : 'N') : v < 0 ? 'W' : 'E'
    const dec = abs >= 1 ? (Number.isInteger(abs) ? 0 : 2) : 3
    return `${abs.toFixed(dec)}°${hemi}`
}
const fmtKm = (v) => (Math.abs(v) < 1 ? `${(v * 1000).toFixed(0)}m` : `${v}km`)

const pickStep = (range, steps, target = 6) => {
    for (const s of steps) if (range / s <= target) return s
    return steps[steps.length - 1]
}

const clearGrid = () => {
    Map_.rmNotNull(gridLayer)
    gridLayer = null
    if (labelContainer) labelContainer.innerHTML = ''
}

const addLabel = (text, pt, edge) => {
    const el = document.createElement('div')
    el.className = `graticuleLabel graticuleLabel-${edge}`
    el.textContent = text
    el.style.color = state.color
    if (edge === 'top' || edge === 'bottom') el.style.left = `${pt.x}px`
    else el.style.top = `${pt.y}px`
    labelContainer.appendChild(el)
}

const lineStyle = () => ({
    color: state.color,
    opacity: state.opacity,
    weight: 1,
    interactive: false,
})

const drawLatLon = (map, bounds) => {
    const lines = []
    const west = Math.max(bounds.getWest(), -180)
    const east = Math.min(bounds.getEast(), 180)
    const south = Math.max(bounds.getSouth(), -90)
    const north = Math.min(bounds.getNorth(), 90)
    const step =
        state.spacing === 'auto'
            ? pickStep(Math.max(east - west, north - south), DEG_STEPS)
            : state.spacing
    const size = map.getSize()

    for (let lon = Math.ceil(west / step) * step; lon <= east; lon += step) {
        lon = +lon.toFixed(6)
        lines.push(L.polyline([[south, lon], [north, lon]], lineStyle()))
        if (state.labels) {
            const x = map.latLngToContainerPoint([south, lon]).x
            if (x > 20 && x < size.x - 20)
                addLabel(fmtDeg(lon, false), { x }, 'bottom')
        }
    }
    for (let lat = Math.ceil(south / step) * step; lat <= north; lat += step) {
        lat = +lat.toFixed(6)
        lines.push(L.polyline([[lat, west], [lat, east]], lineStyle()))
        if (state.labels) {
            const y = map.latLngToContainerPoint([lat, west]).y
            if (y > 20 && y < size.y - 20)
                addLabel(fmtDeg(lat, true), { y }, 'left')
        }
    }
    return lines
}

// Local metric grid centered on the map center, spaced every N km on the
// mission's planetary radius (F_.radiusOfPlanetMajor).
const drawMetric = (map, bounds) => {
    const lines = []
    const R = F_.radiusOfPlanetMajor
    const center = map.getCenter()
    const mPerDegLat = (Math.PI / 180) * R
    const mPerDegLon = mPerDegLat * Math.cos((center.lat * Math.PI) / 180)
    if (mPerDegLon <= 0) return lines

    const heightKm = ((bounds.getNorth() - bounds.getSouth()) * mPerDegLat) / 1000
    const widthKm = ((bounds.getEast() - bounds.getWest()) * mPerDegLon) / 1000
    const stepKm =
        state.spacing === 'auto'
            ? pickStep(Math.max(widthKm, heightKm), KM_STEPS)
            : state.spacing
    const size = map.getSize()

    const nx = Math.ceil(widthKm / stepKm / 2) + 1
    const ny = Math.ceil(heightKm / stepKm / 2) + 1
    for (let i = -nx; i <= nx; i++) {
        const lon = center.lng + (i * stepKm * 1000) / mPerDegLon
        lines.push(
            L.polyline(
                [
                    [bounds.getSouth(), lon],
                    [bounds.getNorth(), lon],
                ],
                lineStyle()
            )
        )
        if (state.labels) {
            const x = map.latLngToContainerPoint([center.lat, lon]).x
            if (x > 20 && x < size.x - 20)
                addLabel(fmtKm(i * stepKm), { x }, 'bottom')
        }
    }
    for (let j = -ny; j <= ny; j++) {
        const lat = center.lat + (j * stepKm * 1000) / mPerDegLat
        lines.push(
            L.polyline(
                [
                    [lat, bounds.getWest()],
                    [lat, bounds.getEast()],
                ],
                lineStyle()
            )
        )
        if (state.labels) {
            const y = map.latLngToContainerPoint([lat, center.lng]).y
            if (y > 20 && y < size.y - 20)
                addLabel(fmtKm(j * stepKm), { y }, 'left')
        }
    }
    return lines
}

const redraw = () => {
    clearGrid()
    if (!state.enabled || !Map_.map) return
    const map = Map_.map
    const bounds = map.getBounds()
    const lines =
        state.mode === 'metric'
            ? drawMetric(map, bounds)
            : drawLatLon(map, bounds)
    gridLayer = L.layerGroup(lines).addTo(map)
}

const spacingOptions = () => {
    const steps = state.mode === 'metric' ? KM_STEPS : DEG_STEPS
    const unit = state.mode === 'metric' ? ' km' : '°'
    return [{ value: 'auto', label: 'Auto (by zoom)' }].concat(
        steps.map((s) => ({ value: String(s), label: `${s}${unit}` }))
    )
}

const Graticule = () => {
    const [, setTick] = useState(0)
    const update = (patch) => {
        state = { ...state, ...patch }
        setTick((t) => t + 1)
        redraw()
    }
    useEffect(() => {
        redraw()
    }, [])

    return (
        <div className='graticuleTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div>
                        <div className='mmgisToolTitle'>Graticule</div>
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
            <div className='graticuleTool_content'>
                <div className='graticuleRow'>
                    <label>Show Grid</label>
                    <Switch
                        checked={state.enabled}
                        onCheckedChange={(v) => update({ enabled: v })}
                    />
                </div>
                <div className='graticuleRow'>
                    <label>Mode</label>
                    <Select
                        value={state.mode}
                        options={[
                            { value: 'latlon', label: 'Lat/Lon (degrees)' },
                            { value: 'metric', label: 'Local metric (km)' },
                        ]}
                        onValueChange={(v) =>
                            update({ mode: v, spacing: 'auto' })
                        }
                    />
                </div>
                <div className='graticuleRow'>
                    <label>Spacing</label>
                    <Select
                        value={String(state.spacing)}
                        options={spacingOptions()}
                        onValueChange={(v) =>
                            update({ spacing: v === 'auto' ? 'auto' : +v })
                        }
                    />
                </div>
                <div className='graticuleRow'>
                    <label>Line Color</label>
                    <input
                        type='color'
                        value={state.color}
                        onChange={(e) => update({ color: e.target.value })}
                    />
                </div>
                <div className='graticuleRow'>
                    <label>Opacity</label>
                    <Slider
                        value={state.opacity}
                        min={0.05}
                        max={1}
                        step={0.05}
                        suffix=''
                        formatValue={(v) => v.toFixed(2)}
                        onValueChange={(v) => update({ opacity: v })}
                    />
                </div>
                <div className='graticuleRow'>
                    <label>Edge Labels</label>
                    <Switch
                        checked={state.labels}
                        onCheckedChange={(v) => update({ labels: v })}
                    />
                </div>
            </div>
        </div>
    )
}

let GraticuleTool = {
    height: 0,
    width: 300,
    _root: null,

    make: function () {
        const vars = L_.getToolVars('graticule', true) || {}
        state = {
            ...defaultState,
            ...(vars.defaultColor ? { color: vars.defaultColor } : {}),
            ...(vars.defaultMode ? { mode: vars.defaultMode } : {}),
        }

        labelContainer = document.createElement('div')
        labelContainer.className = 'graticuleLabels'
        Map_.map.getContainer().appendChild(labelContainer)
        Map_.map.on('moveend zoomend resize', redraw)

        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''
        GraticuleTool._root = createRoot(toolPanel)
        GraticuleTool._root.render(<Graticule />)
    },

    destroy: function () {
        if (GraticuleTool._root) {
            GraticuleTool._root.unmount()
            GraticuleTool._root = null
        }
        Map_.map.off('moveend zoomend resize', redraw)
        clearGrid()
        if (labelContainer) {
            labelContainer.remove()
            labelContainer = null
        }
    },
}

export default GraticuleTool
