import L_ from '@basics/Layers_/Layers_'
import CursorInfo from '@basics/UserInterface_/components/CursorInfo/CursorInfo'

const DEFAULT_COLOR = '#ffe066'
const MAX_KIN = 2000

let active = null

function getKinProperty(layerName, feature) {
    const data = L_.layers.data[layerName] || {}
    const configured =
        data.variables?.kinProperty ||
        data.variables?.kin?.property ||
        data.variables?.useKeyAsName
    if (configured) return configured
    const props = feature?.properties || {}
    for (const candidate of ['sol', 'site', 'campaign', 'type', 'name']) {
        if (props[candidate] != null) return candidate
    }
    return null
}

function eachFeatureLayer(leafletLayer, cb) {
    if (!leafletLayer) return
    if (typeof leafletLayer.eachLayer === 'function') {
        leafletLayer.eachLayer(cb)
    } else if (leafletLayer._vectorTiles) {
        for (const v in leafletLayer._vectorTiles) {
            const tile = leafletLayer._vectorTiles[v]
            for (const l in tile._layers) cb(tile._layers[l])
        }
    }
}

function clear() {
    if (!active) return
    active.restore.forEach(({ layer, style }) => {
        try {
            if (typeof layer.setStyle === 'function') layer.setStyle(style)
        } catch (e) {
            /* layer may have been removed from the map */
        }
    })
    active = null
}

const KinHighlight = {
    use(ctx) {
        if (ctx.eventType === 'mouseout') {
            clear()
            return
        }

        const layerName = ctx.layerName
        const feature = ctx.feature
        if (!layerName || !feature) return

        const prop = getKinProperty(layerName, feature)
        if (!prop) return
        const value = feature.properties?.[prop]
        if (value == null) return

        if (active && active.layerName === layerName && active.value === value)
            return
        clear()

        const color =
            L_.layers.data[layerName]?.variables?.kinColor ||
            L_.configData?.look?.highlightcolor ||
            DEFAULT_COLOR

        const restore = []
        eachFeatureLayer(L_.layers.layer[layerName], (l) => {
            if (restore.length >= MAX_KIN) return
            const f = l.feature
            if (!f || f.properties?.[prop] !== value) return
            if (typeof l.setStyle !== 'function') return
            const opts = l.options || {}
            restore.push({
                layer: l,
                style: {
                    color: opts.color,
                    weight: opts.weight,
                    opacity: opts.opacity,
                    fillOpacity: opts.fillOpacity,
                },
            })
            l.setStyle({
                color,
                weight: (opts.weight || 1) + 2,
                opacity: 1,
                fillOpacity: Math.min(1, (opts.fillOpacity || 0.4) + 0.3),
            })
        })

        if (restore.length === 0) return

        active = { layerName, value, restore }
        ctx.state = ctx.state || {}
        ctx.state.kinCount = restore.length
        ctx.state.kinProperty = prop

        try {
            CursorInfo.update(
                `${prop}: ${value} — ${restore.length} kin feature${
                    restore.length === 1 ? '' : 's'
                }`,
                null,
                false
            )
        } catch (e) {
            /* CursorInfo is unavailable outside the map UI */
        }
    },
    _clear: clear,
    _getKinProperty: getKinProperty,
}

export default KinHighlight
