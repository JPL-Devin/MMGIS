import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'
import Map_ from '@basics/Map_/Map_'
import L from 'leaflet'
import $ from 'jquery'

import {
    resolveConfig,
    geometryCenter,
    findNeighbors,
    formatDistance,
    bearingToCompass,
} from './logic'

const PANEL_ID = 'highlightNeighborsPanel'
let group = null
let listening = false

function clear() {
    if (group) {
        group.clearLayers()
        if (Map_.map && Map_.map.hasLayer(group)) Map_.map.removeLayer(group)
    }
    $(`#${PANEL_ID}`).remove()
}

function ensureListener() {
    if (listening) return
    listening = true
    document.addEventListener('newActiveFeature', (e) => {
        if (!e.detail || e.detail.activeFeature == null) clear()
    })
}

function collectCandidates(layerName, includeOtherLayers, feature) {
    const names = includeOtherLayers
        ? Object.keys(L_.layers.on).filter(
              (n) =>
                  L_.layers.on[n] &&
                  L_.layers.data[n]?.type === 'vector' &&
                  L_.layers.layer[n]?.eachLayer
          )
        : [layerName]
    const out = []
    names.forEach((n) => {
        const lyr = L_.layers.layer[n]
        if (!lyr || !lyr.eachLayer) return
        lyr.eachLayer((sub) => {
            if (!sub.feature || sub.feature === feature) return
            out.push({
                layerName: n,
                leafletLayer: sub,
                feature: sub.feature,
                center: geometryCenter(sub.feature.geometry),
            })
        })
    })
    return out
}

function displayName(layerName) {
    return L_.layers.data[layerName]?.display_name || layerName
}

function featureLabel(f) {
    const p = f.properties || {}
    return p.name ?? p.Name ?? p.title ?? p.id ?? p.sol ?? p.site ?? '—'
}

function render(originLatLng, neighbors, cfg, layerName) {
    if (!group) group = L.layerGroup()
    group.clearLayers()
    group.addTo(Map_.map)

    L.circle(originLatLng, {
        radius: cfg.radius,
        color: cfg.color,
        weight: 1,
        dashArray: '4 4',
        fill: false,
        interactive: false,
    }).addTo(group)

    neighbors.forEach((n) => {
        L.circleMarker([n.center[1], n.center[0]], {
            radius: 9,
            color: cfg.color,
            weight: 3,
            fill: false,
            interactive: false,
        }).addTo(group)
    })

    $(`#${PANEL_ID}`).remove()
    const rows = neighbors
        .map(
            (n) =>
                `<li title="${displayName(n.layerName)}" style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #333;font-size:12px;">
                    <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${featureLabel(
                        n.feature
                    )}</span>
                    <span style="color:#bbb;">${formatDistance(n.distance)}</span>
                    <span style="color:${cfg.color};width:52px;text-align:right;">${n.bearing.toFixed(
                        0
                    )}° ${bearingToCompass(n.bearing)}</span>
                </li>`
        )
        .join('')
    $('body').append(
        `<div id="${PANEL_ID}" style="position:absolute;right:50px;top:50px;z-index:1200;width:300px;max-height:45vh;overflow:auto;background:rgba(20,20,20,0.92);color:#eee;padding:10px 12px;border-radius:4px;border-left:3px solid ${cfg.color};font-family:sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.5);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <b style="font-size:13px;">Neighbors within ${formatDistance(
                    cfg.radius
                )}</b>
                <span style="font-size:11px;color:#bbb;">${neighbors.length} in ${
            cfg.includeOtherLayers ? 'all layers' : displayName(layerName)
        }</span>
            </div>
            <ul style="list-style:none;margin:0;padding:0;">${
                rows || '<li style="font-size:12px;color:#888;">None found</li>'
            }</ul>
        </div>`
    )
}

const HighlightNeighbors = {
    use(ctx) {
        ensureListener()
        clear()
        if (!ctx.feature) return
        const cfg = resolveConfig(ctx.config)
        const origin = geometryCenter(ctx.feature.geometry)
        if (!origin) return

        const candidates = collectCandidates(
            ctx.layerName,
            cfg.includeOtherLayers,
            ctx.feature
        )
        const neighbors = findNeighbors(
            origin,
            candidates,
            cfg,
            (lng1, lat1, lng2, lat2) =>
                F_.lngLatDistBetween(lng1, lat1, lng2, lat2),
            (lat1, lng1, lat2, lng2) =>
                F_.bearingBetweenTwoLatLngs(lat1, lng1, lat2, lng2)
        )

        render([origin[1], origin[0]], neighbors, cfg, ctx.layerName)
        ctx.state.highlightNeighbors = neighbors.map((n) => ({
            layerName: n.layerName,
            feature: n.feature,
            distance: n.distance,
            bearing: n.bearing,
        }))
    },
}

export default HighlightNeighbors
