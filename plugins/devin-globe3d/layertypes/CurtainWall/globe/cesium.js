/**
 * Curtain layer type — Cesium globe renderer.
 *
 * The curtain is a `wall`: one quad per track segment, textured with the
 * radargram image, standing between two height rails. Cesium has the primitive,
 * so the whole module is "turn the track into rails and hand it over".
 *
 * `gctx.raw` is the Cesium namespace, which is what this needs — a wall's
 * material is a `Cesium.ImageMaterialProperty`, and there is no neutral
 * GlobeRenderer primitive for vertical geometry.
 */
import {
    curtainConfig,
    heightRails,
    trackCoordinates,
    trackLength,
} from './curtain'

function make(layerObj, gctx) {
    const Cesium = gctx.raw
    const geojson = layerObj._curtainGeoJSON || layerObj._geojson
    const coords = trackCoordinates(geojson)
    const config = curtainConfig(layerObj)
    if (coords.length < 2 || !config.image) return

    const { maximumHeights, minimumHeights } = heightRails(coords, config)

    const material = new Cesium.ImageMaterialProperty({
        image: config.image,
        transparent: config.transparent,
        // A wall repeats its material per segment by default; one image stretched
        // across the whole track is what a radargram wants.
        repeat: new Cesium.Cartesian2(config.repeat ? coords.length - 1 : 1, 1),
    })

    const entity = new Cesium.Entity({
        name: layerObj.display_name || layerObj.name,
        wall: {
            positions: Cesium.Cartesian3.fromDegreesArray(
                coords.flatMap(([lng, lat]) => [lng, lat])
            ),
            maximumHeights,
            minimumHeights,
            material,
            outline: config.outlineColor != null,
            outlineColor: config.outlineColor
                ? Cesium.Color.fromCssColorString(config.outlineColor)
                : undefined,
        },
    })

    const dataSource = new Cesium.CustomDataSource(layerObj.name)
    dataSource.entities.add(entity)
    gctx.renderer.dataSources.add(dataSource)

    gctx.layers[layerObj.name] = {
        type: 'curtainwall',
        kind: 'entities',
        dataSource,
        entity,
        material,
        visible: true,
        opacity: 1,
        trackLength: trackLength(coords),
    }
    gctx.requestRender()
}

function destroy(layerObj, gctx) {
    const record = gctx.layers[layerObj.name]
    if (record) gctx.renderer.dataSources.remove(record.dataSource, true)
    gctx.requestRender()
}

function setVisibility(layerObj, gctx) {
    const record = gctx.layers[layerObj.name]
    if (!record) return
    record.visible = gctx.visible !== false
    record.dataSource.show = record.visible
    gctx.requestRender()
}

function setOpacity(layerObj, gctx) {
    const record = gctx.layers[layerObj.name]
    if (!record) return
    const opacity = gctx.opacity ?? layerObj.opacity ?? 1
    record.opacity = opacity
    // An image material's alpha rides on its color multiplier.
    record.material.color = gctx.raw.Color.WHITE.withAlpha(opacity)
    gctx.requestRender()
}

export default {
    make,
    destroy,
    setVisibility,
    setOpacity,
}
