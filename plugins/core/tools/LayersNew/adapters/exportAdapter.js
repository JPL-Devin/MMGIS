export function normalizeFeatures(data) {
    if (data?.type === 'FeatureCollection') return data
    if (Array.isArray(data?.Features))
        return { type: 'FeatureCollection', features: data.Features }
    if (Array.isArray(data?.features))
        return { type: 'FeatureCollection', features: data.features }
    return { type: 'FeatureCollection', features: [] }
}

function runtimeDependencies() {
    const layers = require('@basics/Layers_/Layers_').default
    return {
        layers,
        api: require('@pre/calls').default,
        convert: layers.convertGeoJSONLngLatsToPrimaryCoordinates,
    }
}

export function createExportAdapter(dependencies = {}) {
    const defaults =
        dependencies.layers && dependencies.api ? {} : runtimeDependencies()
    const { layers, api, convert } = {
        ...defaults,
        ...dependencies,
    }
    const coordinateConverter =
        convert || layers?.convertGeoJSONLngLatsToPrimaryCoordinates
    return {
        isLayerOn: (name) => layers.layers?.on?.[name] === true,
        getLayerData: (name) => layers.layers?.data?.[name],
        getApi: () => api,
        fetchGeodataset: (params) => api.api?.('geodatasets_get', params),
        normalizeFeatures,
        convertCoordinates: (geojson) =>
            coordinateConverter?.(geojson) || geojson,
    }
}

let defaultAdapter
const getDefaultAdapter = () => {
    if (!defaultAdapter) defaultAdapter = createExportAdapter()
    return defaultAdapter
}

const exportAdapter = new Proxy(
    {},
    {
        get: (_, property) => (...args) =>
            getDefaultAdapter()[property](...args),
    }
)

export default exportAdapter
