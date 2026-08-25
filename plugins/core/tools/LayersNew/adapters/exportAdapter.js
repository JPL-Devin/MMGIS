export function normalizeFeatures(data) {
    if (data?.type === 'FeatureCollection') return data
    if (Array.isArray(data?.Features))
        return { type: 'FeatureCollection', features: data.Features }
    if (Array.isArray(data?.features))
        return { type: 'FeatureCollection', features: data.features }
    return { type: 'FeatureCollection', features: [] }
}

export function createExportAdapter({ layers, api, convert }) {
    return {
        isLayerOn: (name) => layers.layers?.on?.[name] === true,
        getLayerData: (name) => layers.layers?.data?.[name],
        getApi: () => api,
        fetchGeodataset: (params) => api.api('geodatasets_get', params),
        normalizeFeatures,
        convertCoordinates: (geojson) => convert(geojson),
    }
}
