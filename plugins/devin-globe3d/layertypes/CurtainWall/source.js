/**
 * Curtain layer type — data acquisition.
 *
 * The track is ordinary GeoJSON, so core's transports would do; `source` is
 * declared because the curtain also accepts the sounder's *sidecar* form, where
 * the track and the per-vertex surface heights arrive as one JSON document
 * (`{ track: <GeoJSON>, heights: [...], image: "..." }`) rather than as a
 * FeatureCollection. Normalizing that here keeps the renderer free of parsing.
 *
 * The GeoJSON is also stashed on the layer object because a globe-only type has
 * no documented `ctx.data` on the globe side — see this plugin's README.
 */
async function fetch(layerObj, ctx) {
    if (!ctx.url) return null

    const response = await window.fetch(ctx.url)
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
    const body = await response.json()

    const geojson = body?.track ?? body
    if (Array.isArray(body?.heights)) {
        layerObj.variables = layerObj.variables || {}
        layerObj.variables.curtain = {
            ...(layerObj.variables.curtain || {}),
            heights: body.heights,
        }
    }
    if (body?.image && !layerObj.variables?.curtain?.image) {
        layerObj.variables = layerObj.variables || {}
        layerObj.variables.curtain = {
            ...(layerObj.variables.curtain || {}),
            image: body.image,
        }
    }

    layerObj._curtainGeoJSON = geojson
    return geojson
}

export default { fetch }
