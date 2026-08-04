/**
 * Extrusion layer type — Cesium globe renderer.
 *
 * Draws a GeoJSON layer as data-driven 3D geometry: polygons become extruded
 * prisms and points become columns, both sized and colored by a numeric feature
 * property. MMGIS can drape vectors on terrain today but cannot give a polygon
 * or a point real vertical extent, which is the point of this type.
 *
 * The type is globe-only and has no 2D map renderer, so it fetches its own
 * GeoJSON in `make` (data acquisition is not part of the renderer vocabulary;
 * "a type that needs its own source shapes it in make").
 *
 * gctx (cesium) = { engine, renderer, layers, requestRender, loadingLayers, ... }
 */
import * as Cesium from 'cesium'
import {
    extrudedHeight,
    normalize,
    propertyDomain,
    rampColor,
    toGlobeConfig,
} from './layerConfig'

async function make(layerObj, gctx) {
    const layerConfig = toGlobeConfig(layerObj)
    if (!layerConfig.path) return
    const response = await fetch(layerConfig.path)
    if (!response.ok) {
        console.error(
            `Extrusion layer "${layerConfig.name}": failed to fetch ${layerConfig.path} (${response.status})`
        )
        return
    }
    layerConfig.geojson = await response.json()
    return render(layerConfig, gctx)
}

// Add an already-built globe layer config (engine-facing entry point).
function render(layerConfig, gctx) {
    const { renderer, layers, loadingLayers } = gctx
    const { name, geojson } = layerConfig
    if (!geojson || loadingLayers[name]) return
    loadingLayers[name] = true

    try {
        const domain =
            layerConfig.min != null && layerConfig.max != null
                ? { min: layerConfig.min, max: layerConfig.max }
                : propertyDomain(geojson, layerConfig.property)

        const entities = []
        for (const feature of geojson.features || []) {
            const entity = buildEntity(feature, domain, layerConfig)
            if (entity) entities.push(entity)
        }

        const dataSource = new Cesium.CustomDataSource(name)
        entities.forEach((e) => dataSource.entities.add(e))
        renderer.dataSources.add(dataSource)

        layers[name] = {
            type: 'extrusion',
            kind: 'entities',
            dataSource,
            visible: true,
            opacity: layerConfig.opacity ?? 1,
            config: layerConfig,
            domain,
        }
    } finally {
        delete loadingLayers[name]
    }
    gctx.requestRender()
}

function buildEntity(feature, domain, config) {
    const geometry = feature?.geometry
    if (!geometry) return null

    const value = parseFloat(feature.properties?.[config.property])
    const height = extrudedHeight(value, domain, config)
    const color = Cesium.Color.fromCssColorString(
        rampColor(normalize(value, domain), config.ramp)
    ).withAlpha(config.opacity ?? 1)

    const common = {
        name: String(feature.properties?.name ?? config.property ?? ''),
        properties: feature.properties || {},
    }

    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
        const rings =
            geometry.type === 'Polygon'
                ? [geometry.coordinates[0]]
                : geometry.coordinates.map((poly) => poly[0])
        // MultiPolygon: only its first ring gets extruded (one entity per feature).
        const positions = Cesium.Cartesian3.fromDegreesArray(
            rings[0].flatMap(([lng, lat]) => [lng, lat])
        )
        return new Cesium.Entity({
            ...common,
            polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positions),
                extrudedHeight: height,
                height: config.baseHeight,
                material: color,
                outline: config.outline,
                outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
                perPositionHeight: false,
            },
        })
    }

    if (geometry.type === 'Point') {
        const [lng, lat] = geometry.coordinates
        const length = Math.max(1, height - config.baseHeight)
        return new Cesium.Entity({
            ...common,
            position: Cesium.Cartesian3.fromDegrees(
                lng,
                lat,
                config.baseHeight + length / 2
            ),
            cylinder: {
                length,
                topRadius: config.columnRadius,
                bottomRadius: config.columnRadius,
                material: color,
                outline: config.outline,
                outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
            },
        })
    }

    return null
}

function destroy(name, gctx) {
    const layerInfo = gctx.layers[name]
    if (layerInfo) gctx.renderer.dataSources.remove(layerInfo.dataSource, true)
}

function setVisibility(name, visible, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.dataSource.show = visible
    layerInfo.visible = visible
    gctx.requestRender()
}

function setOpacity(name, opacity, gctx) {
    const layerInfo = gctx.layers[name]
    if (!layerInfo) return
    layerInfo.opacity = opacity
    const { config, domain } = layerInfo
    layerInfo.dataSource.entities.values.forEach((entity) => {
        const value = parseFloat(entity.properties?.[config.property]?.getValue?.())
        const color = Cesium.Color.fromCssColorString(
            rampColor(normalize(value, domain), config.ramp)
        ).withAlpha(opacity)
        const graphics = entity.polygon || entity.cylinder
        if (graphics) graphics.material = color
    })
    gctx.requestRender()
}

export default {
    make,
    render,
    destroy,
    setVisibility,
    setOpacity,
}
