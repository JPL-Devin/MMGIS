/**
 * TerrainProfile tool.
 *
 * Plots an elevation-vs-distance profile for whatever profile:pick has shared
 * through the feature's store (../../../lib/profileStore): a whole clicked
 * LineString, or the two most recently clicked endpoints (a straight segment
 * between them).
 *
 * Elevation samples come from the mission's configured DEM via the same
 * `getbands` API the coordinate readout uses (L_.configData.coordinates
 * .coordelevurl). When no DEM is configured it falls back to any Z values on
 * the line's own vertices, and otherwise says so rather than plotting nothing.
 */
import React, { useEffect, useState, useCallback } from 'react'
import { createRoot } from 'react-dom/client'

import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'
import calls from '@pre/calls'

import store from '../../lib/profileStore'

import './TerrainProfileTool.css'

// Great-circle distance in metres between two [lng, lat] points.
function haversine(a, b) {
    const R = F_.radiusOfPlanetMajor || 6378137
    const toRad = (d) => (d * Math.PI) / 180
    const dLat = toRad(b[1] - a[1])
    const dLng = toRad(b[0] - a[0])
    const lat1 = toRad(a[1])
    const lat2 = toRad(b[1])
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// Resample a list of [lng, lat(, z)] vertices to `n` evenly spaced points,
// carrying cumulative distance along the way.
function resample(coords, n) {
    const segLens = []
    let total = 0
    for (let i = 1; i < coords.length; i++) {
        const d = haversine(coords[i - 1], coords[i])
        segLens.push(d)
        total += d
    }
    if (total === 0) return coords.map((c) => ({ lng: c[0], lat: c[1], dist: 0, z: c[2] }))

    const out = []
    for (let s = 0; s < n; s++) {
        const target = (total * s) / (n - 1)
        let acc = 0
        let i = 0
        while (i < segLens.length && acc + segLens[i] < target) {
            acc += segLens[i]
            i++
        }
        const segLen = segLens[i] || 1
        const t = (target - acc) / segLen
        const a = coords[i]
        const b = coords[i + 1] || coords[i]
        out.push({
            lng: a[0] + (b[0] - a[0]) * t,
            lat: a[1] + (b[1] - a[1]) * t,
            z: a[2] != null && b[2] != null ? a[2] + (b[2] - a[2]) * t : null,
            dist: target,
        })
    }
    return out
}

function elevUrl() {
    const c = L_.configData?.coordinates
    if (!c || !c.coordelevurl) return null
    let url = c.coordelevurl
    if (!F_.isUrlAbsolute(url)) url = L_.missionPath + url
    return url
}

// One getbands elevation query, promisified.
function queryElevation(url, lat, lng) {
    return new Promise((resolve) => {
        calls.api(
            'getbands',
            { type: 'band', x: lng, y: lat, xyorll: 'll', bands: '[[1,1]]', path: url },
            (data) => resolve(data?.[0]?.[1] != null ? data[0][1] : null),
            () => resolve(null)
        )
    })
}

function coordsFromStore(s) {
    if (s.line) {
        const g = s.line.geometry
        if (g.type === 'LineString') return g.coordinates
        if (g.type === 'MultiLineString') return g.coordinates.flat()
    }
    if (s.endpoints.length === 2)
        return s.endpoints.map((p) => [p.lng, p.lat])
    return null
}

function Panel() {
    const [, setTick] = useState(0)
    const [status, setStatus] = useState('')
    const [profile, setProfile] = useState(null)

    useEffect(() => store.subscribe(() => setTick((t) => t + 1)), [])

    const coords = coordsFromStore(store)
    const ready = !!coords

    const plot = useCallback(async () => {
        const cs = coordsFromStore(store)
        if (!cs) return
        setProfile(null)

        const samples = Math.max(2, Math.min(128, 64))
        const pts = resample(cs, samples)
        const url = elevUrl()

        let source
        if (url) {
            setStatus(`Sampling ${pts.length} elevations from the mission DEM…`)
            for (const p of pts) p.z = await queryElevation(url, p.lat, p.lng)
            source = 'DEM (getbands)'
        } else if (pts.some((p) => p.z != null)) {
            source = "the line's own Z vertices"
        } else {
            setStatus(
                'No DEM is configured for this mission (coordinates.coordelevurl) and the line has no Z values, so there is nothing to sample. Configure a DEM to plot a real profile.'
            )
            return
        }

        const zs = pts.map((p) => p.z).filter((z) => z != null)
        if (!zs.length) {
            setStatus('Elevation query returned no data for these points.')
            return
        }
        setStatus(`Plotted ${zs.length} samples from ${source}.`)
        setProfile({ pts, min: Math.min(...zs), max: Math.max(...zs) })
    }, [])

    return (
        <div className='terrainProfileTool'>
            <div className='tpHeader'>Terrain Profile</div>
            <div className='tpBody'>
                <div className='tpStatus'>
                    {ready
                        ? store.line
                            ? `Line picked: ${store.line._layerName}`
                            : `${store.endpoints.length}/2 endpoints picked`
                        : 'Click a line feature, or two point features, with the profile:pick interaction active.'}
                </div>
                <div className='tpButtons'>
                    <button disabled={!ready} onClick={plot}>
                        Plot profile
                    </button>
                    <button onClick={() => { store.clear(); setProfile(null); setStatus('') }}>
                        Clear
                    </button>
                </div>
                {status && <div className='tpMsg'>{status}</div>}
                {profile && <Plot profile={profile} />}
            </div>
        </div>
    )
}

// Dependency-free inline SVG plot of elevation vs. distance.
function Plot({ profile }) {
    const { pts, min, max } = profile
    const W = 280
    const H = 140
    const pad = 24
    const maxDist = pts[pts.length - 1].dist || 1
    const range = max - min || 1
    const path = pts
        .filter((p) => p.z != null)
        .map((p, i) => {
            const x = pad + ((W - 2 * pad) * p.dist) / maxDist
            const y = H - pad - ((H - 2 * pad) * (p.z - min)) / range
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
        })
        .join(' ')
    return (
        <svg className='tpPlot' width={W} height={H}>
            <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke='#888' />
            <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke='#888' />
            <path d={path} fill='none' stroke='#4e9a06' strokeWidth='2' />
            <text x={pad} y={pad - 8} fontSize='10' fill='#ccc'>{max.toFixed(1)} m</text>
            <text x={pad} y={H - pad + 14} fontSize='10' fill='#ccc'>{min.toFixed(1)} m</text>
            <text x={W - pad} y={H - pad + 14} fontSize='10' fill='#ccc' textAnchor='end'>
                {(maxDist / 1000).toFixed(2)} km
            </text>
        </svg>
    )
}

let TerrainProfileTool = {
    height: 260,
    width: 320,
    _root: null,

    make: function () {
        const toolPanel = document.getElementById('toolPanel')
        if (toolPanel) toolPanel.innerHTML = ''
        TerrainProfileTool._root = createRoot(toolPanel)
        TerrainProfileTool._root.render(<Panel />)
    },

    destroy: function () {
        if (TerrainProfileTool._root) {
            TerrainProfileTool._root.unmount()
            TerrainProfileTool._root = null
        }
    },
}

export default TerrainProfileTool
