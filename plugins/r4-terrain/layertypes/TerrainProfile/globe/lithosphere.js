/**
 * TerrainProfile layer type — LithoSphere globe renderer.
 *
 * TerrainProfile `extends` vector, so it inherits vector's map renderer, its
 * Cesium globe renderer, config/filter surfaces and picking. Only the
 * LithoSphere globe drawing is overridden here, to draw the profile line as a
 * free (non-draped) polyline so it reads as a section line above the terrain
 * rather than being clamped and hidden by relief.
 *
 * The GeoJSON comes from the map layer that vector's map `make` already built
 * (`L_.layers.layer[name]`), exactly like vector's own globe/layerConfig — this
 * module never fetches.
 *
 * gctx (lithosphere) = { engine, renderer (LithoSphere), layers, hasLayer,
 *                        toggleLayer, removeLayer }
 */
import L_ from '@basics/Layers_/Layers_'

function make(layerObj, gctx) {
    const mapLayer = L_.layers.layer[layerObj.name]
    if (!mapLayer || typeof mapLayer.toGeoJSON !== 'function') return

    const geojson = mapLayer.toGeoJSON(L_.GEOJSON_PRECISION)

    return gctx.renderer.addLayer('vector', {
        name: layerObj.name,
        order: L_._layersOrdered,
        on: L_.layers.opacity[layerObj.name] ? true : false,
        geojson,
        onClick: (feature, lnglat, layer) => {
            L_.selectFeature(layer.name, feature)
        },
        opacity: L_.layers.opacity[layerObj.name],
        style: {
            letPropertiesStyleOverride: true,
            default: {
                color: layerObj.style?.color || '#4e9a06',
                weight: parseFloat(layerObj.style?.weight) || 4,
            },
        },
    })
}

export default {
    make,
}
