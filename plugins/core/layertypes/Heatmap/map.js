// Heatmap map renderer: acquires the source layer via the type's source module,
// samples its geometries, and draws a projected-space canvas heatmap.
import L_ from '@basics/Layers_/Layers_'
import MapRenderer from '@basics/Map_/MapRenderer'
import { captureVector } from '@basics/Layers_/capture/LayerCapturer'
import { getHeatmapLayerClass } from './HeatmapLayer'
import { sampleFeatureCollection } from './sampling'
import { heatmapOptions } from './config'

const _timeSubscribed = new Set()

function sourceLayerData(layerObj) {
    const sourceName = layerObj.variables?.sourceLayer
    if (!sourceName) return null
    return L_.layers.data[L_.asLayerUUID(sourceName)] || null
}

function layerOptionsFor(layerObj, opts) {
    return {
        radius: opts.radius,
        blur: opts.blur,
        radiusUnits: opts.radiusUnits,
        maxIntensity: opts.maxIntensity,
        gradient: opts.gradient,
        opacity:
            L_.layers.opacity[layerObj.name] ?? layerObj.initialOpacity ?? 1,
    }
}

// Resample cached source GeoJSON into the live layer (used by live controls).
export function resample(layerObj) {
    const layer = L_.layers.layer[layerObj.name]
    if (!layer || !layer._heatmapSourceGeoJSON) return
    const opts = heatmapOptions(layerObj)
    const t0 = performance.now()
    const { samples, numericProps } = sampleFeatureCollection(
        layer._heatmapSourceGeoJSON,
        {
            spacingMeters: opts.lineSampleSpacingMeters,
            polygonInteriorSamples: opts.polygonInteriorSamples,
            weightProperty: opts.weightProperty,
            weightMin: opts.weightMin,
            weightMax: opts.weightMax,
        }
    )
    layer._heatmapNumericProps = numericProps
    layer._heatmapSampleMs = performance.now() - t0
    layer.setOptions(layerOptionsFor(layerObj, opts))
    layer.setSamples(samples)
}

// Push current variables (radius/blur/max/gradient/units) to the live layer.
export function restyle(layerObj) {
    const layer = L_.layers.layer[layerObj.name]
    if (!layer) return
    layer.setOptions(layerOptionsFor(layerObj, heatmapOptions(layerObj)))
}

// Re-acquire the source and redraw; keeps the heatmap in sync with the source's time window.
export function refetch(layerObj) {
    const layer = L_.layers.layer[layerObj.name]
    if (!layer) return
    captureVector(
        layerObj,
        { evenIfOff: true },
        (geojson) => {
            if (geojson == null || geojson === 'off') return
            layer._heatmapSourceGeoJSON = geojson
            resample(layerObj)
        },
        () => {}
    )
}

function make(layerObj, ctx = {}) {
    const { evenIfOff, forceGeoJSON, mapContext } = ctx
    const mctx = MapRenderer.context(mapContext)
    const L = mctx.raw
    const HeatmapLayer = getHeatmapLayerClass(L)
    const name = layerObj.name

    return new Promise((resolve) => {
        const markLoaded = () => {
            L_._layersLoaded[L_._layersOrdered.indexOf(name)] = true
            L_.Map_.allLayersLoaded()
        }
        const add = (geojson) => {
            if (geojson === 'off') {
                mctx.layerRegistry.layer[name] = false
                markLoaded()
                resolve()
                return
            }
            const opts = heatmapOptions(layerObj)
            const existing = mctx.layerRegistry.layer[name]
            const layer =
                existing && existing._heat
                    ? existing
                    : new HeatmapLayer(layerOptionsFor(layerObj, opts))
            layer._heatmapSourceGeoJSON = geojson || {
                type: 'FeatureCollection',
                features: [],
            }
            mctx.layerRegistry.layer[name] = layer
            if (!mctx.default) layer.addTo(mctx.map)
            resample(layerObj)

            const src = sourceLayerData(layerObj)
            if (src?.time?.enabled === true && !_timeSubscribed.has(name)) {
                _timeSubscribed.add(name)
                // Defer so core has applied the new window to the source's time config first.
                L_.subscribeTimeChange(`heatmap_${name}`, () => {
                    setTimeout(
                        () => refetch(L_.layers.data[name] || layerObj),
                        0
                    )
                })
            }

            markLoaded()
            resolve()
        }

        if (forceGeoJSON) add(forceGeoJSON)
        else
            captureVector(layerObj, { evenIfOff }, add, () => {
                mctx.layerRegistry.layer[name] = null
                markLoaded()
                resolve()
            })
    })
}

function destroy(layerObj) {
    const name = layerObj.name
    if (_timeSubscribed.has(name)) {
        _timeSubscribed.delete(name)
        L_.unsubscribeTimeChange(`heatmap_${name}`)
    }
}

// The source's time window changed: re-acquire rather than rebuilding the layer.
function timeChange(layerObj, ctx = {}) {
    const src = sourceLayerData(layerObj)
    if (src?.time?.enabled !== true && layerObj.time?.enabled !== true) return
    if (!L_.layers.layer[layerObj.name]) return
    refetch(layerObj)
}

// Live control changes. ctx.resample re-samples geometry (weight/spacing changes);
// otherwise only render params (radius/blur/max/gradient/units) are pushed.
function setStyle(layerObj, ctx = {}) {
    if (ctx.resample === true) resample(layerObj)
    else restyle(layerObj)
}

export default {
    make,
    destroy,
    timeChange,
    setStyle,
}
