function runtimeDependencies() {
    return {
        layers: require('@basics/Layers_/Layers_').default,
        registry: require('@basics/Layers_/registry/LayerAttachmentRegistry')
            .default,
    }
}

export function createAttachmentsAdapter(dependencies = {}) {
    const defaults =
        dependencies.layers && dependencies.registry ? {} : runtimeDependencies()
    const { layers, registry } = {
        ...defaults,
        ...dependencies,
    }
    return {
        describe: (id) => registry.describe?.(id),
        idForSublayerKey: (key) => registry.idForSublayerKey?.(key),
        getAttachments: (name) => layers.layers?.attachments?.[name] || {},
        toggle: (host, sublayer) =>
            layers.toggleSublayer(host, sublayer),
        setVisibility: (host, sublayer, visible) =>
            layers.setAttachmentVisibility(host, sublayer, visible),
        setOpacity: (host, sublayer, opacity) =>
            layers.setSublayerOpacity(host, sublayer, opacity),
    }
}

let defaultAdapter
const getDefaultAdapter = () => {
    if (!defaultAdapter) defaultAdapter = createAttachmentsAdapter()
    return defaultAdapter
}

const attachmentsAdapter = new Proxy(
    {},
    {
        get: (_, property) => (...args) =>
            getDefaultAdapter()[property](...args),
    }
)

export default attachmentsAdapter
