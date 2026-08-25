export function createAttachmentsAdapter({ layers, registry }) {
    return {
        describe: (id) => registry.describe(id),
        idForSublayerKey: (key) => registry.idForSublayerKey(key),
        getAttachments: (name) => layers.layers?.attachments?.[name] || {},
        toggle: (host, sublayer) => layers.toggleSublayer(host, sublayer),
        setVisibility: (host, sublayer, visible) =>
            layers.setAttachmentVisibility(host, sublayer, visible),
        setOpacity: (host, sublayer, opacity) =>
            layers.setSublayerOpacity(host, sublayer, opacity),
    }
}
