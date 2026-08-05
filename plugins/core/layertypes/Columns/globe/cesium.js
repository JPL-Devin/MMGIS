/**
 * Columns layer type — Cesium globe renderer.
 *
 * Draws each point feature as a vertical cylinder whose length comes from a
 * numeric property and whose color comes from that value's position in the
 * layer's range — a 3D magnitude plot MMGIS can't draw today (points on the
 * globe are flat billboards).
 *
 * The 2D map render is inherited from `vector` (`extends`), so the layer still
 * behaves like a normal vector layer on the map.
 *
 * gctx (cesium) = { engine, renderer (Cesium.Viewer), layers, requestRender, raw }
 */
import * as Cesium from 'cesium'
import { columnSpecs } from './columnData'

function make(layerObj, gctx) {
    const { columns } = columnSpecs(layerObj)
    const name = layerObj.name

    // A reload replaces whatever is there rather than stacking a second set.
    destroy(name, gctx)

    const dataSource = new Cesium.CustomDataSource(`columns_${name}`)
    const featureMap = {}

    columns.forEach((c, i) => {
        const color = Cesium.Color.fromCssColorString(c.color)
        const id = `${name}_column_${i}`
        dataSource.entities.add({
            id,
            position: Cesium.Cartesian3.fromDegrees(
                c.lng,
                c.lat,
                c.base + c.height / 2
            ),
            cylinder: {
                length: Math.max(c.height, 1),
                topRadius: c.radius,
                bottomRadius: c.radius,
                material: color.withAlpha(0.9),
                outline: false,
            },
        })
        featureMap[id] = c.feature
    })

    gctx.renderer.dataSources.add(dataSource)

    gctx.layers[name] = {
        type: 'columns',
        kind: 'entities',
        dataSource,
        visible: true,
        featureMap,
        columns,
    }

    gctx.requestRender()
}

function destroy(layerName, gctx) {
    const record = gctx.layers[layerName]
    if (!record?.dataSource) return
    gctx.renderer.dataSources.remove(record.dataSource, true)
    delete gctx.layers[layerName]
    gctx.requestRender()
}

function setVisibility(layerName, visible, gctx) {
    const record = gctx.layers[layerName]
    if (!record?.dataSource) return
    record.dataSource.show = visible
    record.visible = visible
    gctx.requestRender()
}

function setOpacity(layerName, opacity, gctx) {
    const record = gctx.layers[layerName]
    if (!record?.dataSource) return
    record.dataSource.entities.values.forEach((entity) => {
        if (!entity.cylinder) return
        const current = entity.cylinder.material?.color?.getValue?.()
        if (current)
            entity.cylinder.material = current.withAlpha(parseFloat(opacity))
    })
    gctx.requestRender()
}

// Column heights/colors come from the layer's config, so a restyle is a rebuild.
function setStyle(layerName, gctx) {
    const layerObj = gctx.layers[layerName] ? window.L_?.layers?.data?.[layerName] : null
    if (!layerObj) return
    make(layerObj, gctx)
}

export default {
    make,
    destroy,
    setVisibility,
    setOpacity,
    setStyle,
}
