import $ from 'jquery'
import L_ from '@basics/Layers_/Layers_'
import F_ from '@basics/Formulae_/Formulae_'
import Map_ from '@basics/Map_/Map_'
import { decide } from './logic'

import './Proximity.css'

const PANEL_ID = 'proximityPanel'
let overlay = null

/** Every feature of every visible vector/query layer, tagged with its layer. */
function gatherCandidates() {
    const out = []
    Object.keys(L_.layers.layer).forEach((lName) => {
        const data = L_.layers.data[lName]
        const layer = L_.layers.layer[lName]
        if (!L_.layers.on[lName] || !layer || !data) return
        if (data.type !== 'vector' && data.type !== 'query') return
        if (typeof layer.eachLayer !== 'function') return
        layer.eachLayer((l) => {
            if (l.feature && l.feature.geometry)
                out.push({ layerName: lName, feature: l.feature, leaflet: l })
        })
    })
    return out
}

function clear() {
    if (overlay) {
        Map_.rmNotNull(overlay)
        overlay = null
    }
    $(`#${PANEL_ID}`).remove()
}

function formatDist(m) {
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`
}

function render(result, originName) {
    clear()
    const [lng, lat] = result.center
    const group = L.featureGroup()
    L.circle([lat, lng], {
        // Leaflet assumes Earth; rescale so the ring is `radius` planet-meters.
        radius: result.radius * F_.getEarthToPlanetRatio(),
        color: '#ffd166',
        weight: 2,
        fillOpacity: 0.08,
        interactive: false,
    }).addTo(group)
    result.results.forEach((r) => {
        L.circleMarker([r.center[1], r.center[0]], {
            radius: 9,
            color: '#ffd166',
            weight: 2,
            fill: false,
            interactive: false,
        }).addTo(group)
    })
    overlay = group.addTo(Map_.map)

    const rows = result.results
        .map(
            (r, i) =>
                `<li data-i="${i}" title="Zoom to">` +
                `<span class="proxRank">${i + 1}</span>` +
                `<span class="proxName">${r.name}</span>` +
                `<span class="proxLayer">${r.layerName}</span>` +
                `<span class="proxDist">${formatDist(r.distance)}</span></li>`
        )
        .join('')
    $('body').append(
        `<div id="${PANEL_ID}">` +
            `<div class="proxHeader"><span>Proximity</span>` +
            `<span class="proxSub">${result.results.length} within ${formatDist(
                result.radius
            )} of ${originName}</span>` +
            `<div class="proxClear" title="Clear"><i class="mdi mdi-close mdi-18px"></i></div></div>` +
            `<ul>${rows || '<li class="proxEmpty">No features nearby</li>'}</ul></div>`
    )
    $(`#${PANEL_ID} .proxClear`).on('click', clear)
    $(`#${PANEL_ID} li[data-i]`).on('click', function () {
        const r = result.results[parseInt($(this).attr('data-i'))]
        Map_.map.setView([r.center[1], r.center[0]], Map_.map.getZoom())
        L_.setActiveFeature(r.leaflet)
    })
}

const Proximity = {
    use(ctx) {
        if (!ctx.feature) return
        const candidates = gatherCandidates()
        const result = decide(ctx.feature, candidates, ctx.config, (a, b, c, d) =>
            F_.lngLatDistBetween(a, b, c, d)
        )
        if (result == null) return
        result.results.forEach((r) => {
            r.leaflet = candidates.find((c) => c.feature === r.feature)?.leaflet
        })
        ctx.state.proximity = result
        render(result, ctx.feature.properties?.name ?? ctx.layerName)
    },
}

export default Proximity
