import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'

import ToolController_ from '@basics/ToolController_/ToolController_'
import L_ from '@basics/Layers_/Layers_'
import Map_ from '@basics/Map_/Map_'
import { IconButton } from '@design/components'

import './LayerStatsTool.css'

const BINS = 12
const TOP_N = 8

function getVectorLayerNames() {
    return Object.keys(L_.layers.on).filter(
        (n) =>
            L_.layers.on[n] &&
            L_.layers.data[n]?.type === 'vector' &&
            L_.layers.layer[n]?.eachLayer
    )
}

// Flattens a Leaflet layer group into [{ feature, leafletLayer }]
function collectFeatures(layerName, viewportOnly) {
    const group = L_.layers.layer[layerName]
    const out = []
    if (!group) return out
    const bounds = viewportOnly ? Map_.map.getBounds() : null
    const visit = (l) => {
        if (l.eachLayer && !l.feature) {
            l.eachLayer(visit)
            return
        }
        if (!l.feature) return
        if (bounds) {
            let ok = true
            if (l.getLatLng) ok = bounds.contains(l.getLatLng())
            else if (l.getBounds) ok = bounds.intersects(l.getBounds())
            if (!ok) return
        }
        out.push({ feature: l.feature, leafletLayer: l })
    }
    group.eachLayer(visit)
    return out
}

function computeStats(items) {
    const props = {}
    items.forEach(({ feature }, idx) => {
        const p = feature.properties || {}
        Object.keys(p).forEach((k) => {
            const v = p[k]
            if (v === null || v === undefined || typeof v === 'object') return
            if (!props[k]) props[k] = { values: [], idxs: [] }
            props[k].values.push(v)
            props[k].idxs.push(idx)
        })
    })
    const stats = []
    Object.keys(props)
        .sort()
        .forEach((k) => {
            const { values, idxs } = props[k]
            const nums = values.map(Number)
            const isNumeric =
                values.length > 0 &&
                nums.every((n) => Number.isFinite(n)) &&
                values.every((v) => typeof v !== 'boolean')
            const uniq = new Set(values.map(String))
            const s = {
                name: k,
                count: values.length,
                unique: uniq.size,
                isNumeric,
            }
            if (isNumeric) {
                const min = Math.min(...nums)
                const max = Math.max(...nums)
                s.min = min
                s.max = max
                s.mean = nums.reduce((a, b) => a + b, 0) / nums.length
                const span = max - min || 1
                const bins = Array.from({ length: BINS }, (_, i) => ({
                    label: `${(min + (span * i) / BINS).toPrecision(4)}`,
                    count: 0,
                    idxs: [],
                }))
                nums.forEach((n, i) => {
                    let b = Math.floor(((n - min) / span) * BINS)
                    if (b >= BINS) b = BINS - 1
                    bins[b].count++
                    bins[b].idxs.push(idxs[i])
                })
                s.bars = bins
            } else {
                const freq = {}
                values.forEach((v, i) => {
                    const key = String(v)
                    if (!freq[key]) freq[key] = { label: key, count: 0, idxs: [] }
                    freq[key].count++
                    freq[key].idxs.push(idxs[i])
                })
                s.bars = Object.values(freq)
                    .sort((a, b) => b.count - a.count)
                    .slice(0, TOP_N)
            }
            stats.push(s)
        })
    return stats
}

function fmt(n) {
    if (typeof n !== 'number') return n
    return Number.isInteger(n) ? n : n.toPrecision(5)
}

function BarChart({ bars, isNumeric, onBarClick, activeIdx }) {
    const w = 270
    const h = 90
    const pad = 4
    const max = Math.max(1, ...bars.map((b) => b.count))
    const bw = (w - pad * 2) / bars.length
    return (
        <svg className='layerStatsTool_chart' width={w} height={h + 14}>
            {bars.map((b, i) => {
                const bh = (b.count / max) * (h - 6)
                return (
                    <g
                        key={i}
                        className={
                            'layerStatsTool_bar' +
                            (activeIdx === i ? ' active' : '')
                        }
                        onClick={() => onBarClick(i)}
                    >
                        <title>{`${b.label}: ${b.count}`}</title>
                        <rect
                            x={pad + i * bw + 1}
                            y={h - bh}
                            width={Math.max(1, bw - 2)}
                            height={bh}
                        />
                        {(isNumeric ? i % 3 === 0 : true) && (
                            <text
                                x={pad + i * bw + bw / 2}
                                y={h + 11}
                                textAnchor='middle'
                            >
                                {String(b.label).slice(0, isNumeric ? 7 : 6)}
                            </text>
                        )}
                    </g>
                )
            })}
        </svg>
    )
}

function LayerStatsPanel() {
    const [layerNames, setLayerNames] = useState(getVectorLayerNames())
    const [layerName, setLayerName] = useState(
        L_.activeFeature?.layerName || getVectorLayerNames()[0] || ''
    )
    const [viewportOnly, setViewportOnly] = useState(false)
    const [tick, setTick] = useState(0)
    const [active, setActive] = useState(null) // { prop, bar }

    useEffect(() => {
        const refresh = () => {
            setLayerNames(getVectorLayerNames())
            setTick((t) => t + 1)
        }
        L_.subscribeOnLayerToggle('LayerStatsTool', refresh)
        Map_.map.on('moveend', refresh)
        return () => {
            L_.unsubscribeOnLayerToggle('LayerStatsTool')
            Map_.map.off('moveend', refresh)
        }
    }, [])

    useEffect(() => {
        if (layerName && !layerNames.includes(layerName))
            setLayerName(layerNames[0] || '')
    }, [layerNames])

    const items = useMemo(
        () => (layerName ? collectFeatures(layerName, viewportOnly) : []),
        [layerName, viewportOnly, tick]
    )
    const stats = useMemo(() => computeStats(items), [items])

    const clearHighlight = () => {
        if (layerName) L_.resetLayerFills(layerName)
        setActive(null)
    }

    const onBarClick = (stat, i) => {
        if (layerName) L_.resetLayerFills(layerName)
        if (active && active.prop === stat.name && active.bar === i) {
            setActive(null)
            return
        }
        stat.bars[i].idxs.forEach((idx) => {
            const ll = items[idx]?.leafletLayer
            if (ll) L_.highlight(ll, 'yellow')
        })
        setActive({ prop: stat.name, bar: i })
    }

    useEffect(() => () => layerName && L_.resetLayerFills(layerName), [])

    return (
        <div className='layerStatsTool'>
            <div className='mmgisToolHeader'>
                <div>
                    <div>
                        <div className='mmgisToolTitle'>Layer Stats</div>
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
            <div className='layerStatsTool_content'>
                <div className='layerStatsTool_controls'>
                    <select
                        value={layerName}
                        onChange={(e) => {
                            clearHighlight()
                            setLayerName(e.target.value)
                        }}
                    >
                        {layerNames.length === 0 && (
                            <option value=''>No vector layers on</option>
                        )}
                        {layerNames.map((n) => (
                            <option key={n} value={n}>
                                {L_.layers.data[n]?.display_name || n}
                            </option>
                        ))}
                    </select>
                    <label>
                        <input
                            type='checkbox'
                            checked={viewportOnly}
                            onChange={(e) => {
                                clearHighlight()
                                setViewportOnly(e.target.checked)
                            }}
                        />
                        Viewport only
                    </label>
                </div>
                <div className='layerStatsTool_summary'>
                    {items.length} feature{items.length === 1 ? '' : 's'},{' '}
                    {stats.length} properties
                    {active && (
                        <span
                            className='layerStatsTool_clear'
                            onClick={clearHighlight}
                        >
                            clear highlight
                        </span>
                    )}
                </div>
                {stats.map((s) => (
                    <div className='layerStatsTool_prop' key={s.name}>
                        <div className='layerStatsTool_propName'>
                            {s.name}
                            <span className='layerStatsTool_type'>
                                {s.isNumeric ? 'numeric' : 'categorical'}
                            </span>
                        </div>
                        <div className='layerStatsTool_metrics'>
                            <span>count {s.count}</span>
                            <span>unique {s.unique}</span>
                            {s.isNumeric && (
                                <>
                                    <span>min {fmt(s.min)}</span>
                                    <span>max {fmt(s.max)}</span>
                                    <span>mean {fmt(s.mean)}</span>
                                </>
                            )}
                        </div>
                        <BarChart
                            bars={s.bars}
                            isNumeric={s.isNumeric}
                            activeIdx={
                                active?.prop === s.name ? active.bar : null
                            }
                            onBarClick={(i) => onBarClick(s, i)}
                        />
                    </div>
                ))}
            </div>
        </div>
    )
}

let LayerStatsTool = {
    height: 0,
    width: 300,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''
        LayerStatsTool._root = createRoot(toolPanel)
        LayerStatsTool._root.render(<LayerStatsPanel />)
    },

    destroy: function () {
        if (LayerStatsTool._root) {
            LayerStatsTool._root.unmount()
            LayerStatsTool._root = null
        }
    },
}

export default LayerStatsTool
