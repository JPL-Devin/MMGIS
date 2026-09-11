/**
 * Graticule layer type — map renderer.
 *
 * Draws a latitude/longitude grid over the 2D map. Line spacing adapts to the
 * current zoom; labels are decimal degrees or DMS. Redraws on every view change.
 */
import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'
import MapRenderer from '@basics/Map_/MapRenderer'

// Candidate intervals in degrees, coarse to fine.
const INTERVALS = [
    45, 30, 20, 15, 10, 5, 2, 1, 0.5, 0.25, 0.1, 0.05, 0.02, 0.01, 0.005,
    0.002, 0.001, 0.0005, 0.0002, 0.0001,
]

function getConfig(layerObj) {
    const v = layerObj.variables || {}
    const s = layerObj.style || {}
    return {
        color: s.color || '#ffffff',
        weight: s.weight != null ? Number(s.weight) : 1,
        opacity: s.opacity != null ? Number(s.opacity) : 0.6,
        dashArray: v.dashed === true ? '4 4' : null,
        labelFormat: v.labelFormat === 'dms' ? 'dms' : 'dd',
        showLabels: v.showLabels !== false,
        fontSize: v.fontSize != null ? Number(v.fontSize) : 11,
        linesPerView: v.linesPerView != null ? Number(v.linesPerView) : 6,
        fixedInterval: v.interval != null && v.interval !== '' ? Number(v.interval) : null,
    }
}

// Pick the coarsest interval that yields at least `target` lines across the view.
function chooseInterval(bounds, target) {
    const span = Math.min(
        bounds.getEast() - bounds.getWest(),
        bounds.getNorth() - bounds.getSouth()
    )
    for (const i of INTERVALS) if (span / i >= target) return i
    return INTERVALS[INTERVALS.length - 1]
}

function decimals(interval) {
    const s = String(interval)
    return s.includes('.') ? s.split('.')[1].length : 0
}

function formatDMS(value, isLat) {
    const hemi = isLat ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'
    const abs = Math.abs(value)
    const d = Math.floor(abs)
    const mFloat = (abs - d) * 60
    const m = Math.floor(mFloat)
    const s = Math.round((mFloat - m) * 60 * 100) / 100
    let out = `${d}°`
    if (m > 0 || s > 0) out += `${String(m).padStart(2, '0')}′`
    if (s > 0) out += `${s}″`
    return `${out}${hemi}`
}

function formatLabel(value, isLat, cfg, interval) {
    if (cfg.labelFormat === 'dms') return formatDMS(value, isLat)
    const hemi = isLat ? (value < 0 ? 'S' : 'N') : value < 0 ? 'W' : 'E'
    return `${Math.abs(value).toFixed(decimals(interval))}°${hemi}`
}

function makeLabel(L, latlng, text, cfg, cls) {
    return L.marker(latlng, {
        interactive: false,
        keyboard: false,
        pane: cfg.paneName,
        icon: L.divIcon({
            className: `mmgis-graticule-label ${cls}`,
            html: `<span style="color:${cfg.color};font-size:${cfg.fontSize}px;text-shadow:0 0 2px #000,0 0 3px #000;white-space:nowrap;">${text}</span>`,
            iconSize: null,
            iconAnchor: cls === 'lat' ? [-4, 7] : [-2, cfg.fontSize + 6],
        }),
    })
}

function draw(layerObj, group, mctx) {
    const L = mctx.raw
    const map = mctx.map
    const cfg = getConfig(layerObj)
    cfg.paneName = group._graticulePane
    group.clearLayers()

    const b = map.getBounds()
    const interval = cfg.fixedInterval || chooseInterval(b, cfg.linesPerView)
    const west = Math.max(-180, b.getWest())
    const east = Math.min(180, b.getEast())
    const south = Math.max(-90, b.getSouth())
    const north = Math.min(90, b.getNorth())
    const lineOpts = {
        color: cfg.color,
        weight: cfg.weight,
        opacity: cfg.opacity,
        dashArray: cfg.dashArray,
        interactive: false,
        pane: cfg.paneName,
    }
    const labelLng = Math.max(west, b.getWest()) + (east - west) * 0.005
    const labelLat = Math.max(south, b.getSouth()) + (north - south) * 0.005

    // Meridians
    for (
        let lng = Math.ceil(west / interval) * interval;
        lng <= east;
        lng += interval
    ) {
        lng = Number(lng.toFixed(6))
        group.addLayer(L.polyline([[south, lng], [north, lng]], lineOpts))
        if (cfg.showLabels)
            group.addLayer(
                makeLabel(L, [labelLat, lng], formatLabel(lng, false, cfg, interval), cfg, 'lng')
            )
    }
    // Parallels
    for (
        let lat = Math.ceil(south / interval) * interval;
        lat <= north;
        lat += interval
    ) {
        lat = Number(lat.toFixed(6))
        group.addLayer(L.polyline([[lat, west], [lat, east]], lineOpts))
        if (cfg.showLabels)
            group.addLayer(
                makeLabel(L, [lat, labelLng], formatLabel(lat, true, cfg, interval), cfg, 'lat')
            )
    }
}

function make(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const L = mctx.raw
    const map = mctx.map

    const paneName = `graticule-${F_.getSafeName(layerObj.name)}`
    if (!map.getPane(paneName)) {
        const pane = map.createPane(paneName)
        pane.style.zIndex = 450
        pane.style.pointerEvents = 'none'
    }

    const group = L.layerGroup([], { pane: paneName })
    group._graticulePane = paneName
    group._graticuleRedraw = () => draw(layerObj, group, mctx)
    group.setOpacity = (o) => {
        map.getPane(paneName).style.opacity = o
    }
    group.on('add', () => {
        map.on('moveend zoomend', group._graticuleRedraw)
        group._graticuleRedraw()
    })
    group.on('remove', () => {
        map.off('moveend zoomend', group._graticuleRedraw)
        group.clearLayers()
    })

    L_.layers.layer[layerObj.name] = group
    L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true
    L_.Map_.allLayersLoaded()
}

function destroy(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const group = mctx.layerRegistry.layer[layerObj.name]
    if (!group) return
    mctx.map.off('moveend zoomend', group._graticuleRedraw)
    group.clearLayers()
    L_.Map_.rmNotNull(group)
}

function setOpacity(layerObj, ctx = {}) {
    const mctx = MapRenderer.context(ctx.mapContext)
    const group = mctx.layerRegistry.layer[layerObj.name]
    const o = ctx.opacity != null ? ctx.opacity : L_.layers.opacity[layerObj.name]
    if (group && o != null) group.setOpacity(o)
}

function setStyle(layerObj) {
    const group = L_.layers.layer[layerObj.name]
    if (group && group._graticuleRedraw) group._graticuleRedraw()
}

export default {
    make,
    destroy,
    setOpacity,
    setStyle,
}
