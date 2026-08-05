/**
 * Radargram layer type — LithoSphere globe renderer.
 *
 * The radargram itself is a vertical sheet hanging below the ground track, so
 * this is the only surface of the type that draws anything of its own: the map
 * (and Cesium, and picking, and filtering) come from `extends: "vector"`.
 *
 * LithoSphere has a native 'curtain' layerer that does exactly this — a
 * texture-mapped ribbon from each line vertex down to `depth` — and it is
 * reachable through the *neutral* `gctx.addEngineLayer(type, config)`, so this
 * module builds a config and never touches THREE. `window.THREE` would only be
 * needed for geometry LithoSphere has no layerer for (see the report).
 *
 * gctx (lithosphere) = { engine, renderer, raw, layers, addEngineLayer,
 *                        hasLayer, toggleLayer, removeLayer, clampToGround,
 *                        geojsonHasPolygons }
 */
import L_ from '@basics/Layers_/Layers_'
import { settingsOf } from '../lib/radargram'

/** The curtain config for a layer, or null when there is nothing to draw yet. */
export function toCurtainConfig(layerObj) {
    const mapLayer = L_.layers.layer[layerObj.name]
    if (!mapLayer || typeof mapLayer.toGeoJSON !== 'function') return null

    const geojson = mapLayer.toGeoJSON(L_.GEOJSON_PRECISION)
    const { imageProp, maxDepthMeters, verticalExaggeration } =
        settingsOf(layerObj)

    // One curtain per track, because the image is per-feature: LithoSphere
    // textures a whole curtain layer with one image, and two tracks do not
    // share a radargram.
    return (geojson?.features || [])
        .filter((f) =>
            ['LineString', 'MultiLineString'].includes(f.geometry?.type)
        )
        .map((f, i) => ({
            name: `${layerObj.name}__radargram_${i}`,
            on: L_.layers.opacity[layerObj.name] ? true : false,
            opacity: L_.layers.opacity[layerObj.name],
            order: 0,
            lineGeometry: f.geometry,
            imagePath: f.properties?.[imageProp] || null,
            // No image configured yet: a flat translucent sheet still shows
            // where the sounding is, rather than nothing at all.
            imageColor: f.properties?.[imageProp]
                ? undefined
                : ['#8f5902', '#000000'],
            depth: maxDepthMeters,
            options: { verticalExaggeration, verticalOffset: 0 },
        }))
}

async function make(layerObj, gctx) {
    const configs = toCurtainConfig(layerObj)
    if (configs == null || configs.length === 0) return

    const handles = []
    for (const config of configs) {
        handles.push(await gctx.addEngineLayer('curtain', config))
    }

    // The record core dispatches from. `kind: 'curtain'` is engine vocabulary,
    // as the contract asks — but see the report: on LithoSphere core never
    // dispatches destroy/setVisibility/setOpacity back here, and the curtain
    // names above are not this layer's name, so nothing removes them.
    gctx.layers[layerObj.name] = {
        type: 'radargram',
        kind: 'curtain',
        curtainNames: configs.map((c) => c.name),
        handles,
    }
    return handles
}

/**
 * Teardown. Written because the sub-curtains are named after the layer rather
 * than *being* the layer, so LithoSphere's by-name removal of `layerName` does
 * not find them.
 *
 * NOTE: as of this branch GlobeRenderer.removeLayer() short-circuits to
 * `this.renderer.removeLayer(name)` for the lithosphere engine before the
 * registry is consulted, so this never runs. Kept because it is the correct
 * implementation of the contract as documented.
 */
function destroy(layerName, gctx) {
    const record = gctx.layers?.[layerName]
    if (record?.curtainNames == null) return
    record.curtainNames.forEach((n) => gctx.removeLayer(n))
    delete gctx.layers[layerName]
}

function setVisibility(layerName, visible, gctx) {
    const record = gctx.layers?.[layerName]
    if (record?.curtainNames == null) return
    record.curtainNames.forEach((n) => gctx.toggleLayer(n, visible))
}

export default {
    make,
    destroy,
    setVisibility,
}
