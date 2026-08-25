export function createAttachmentsAdapter({ layers, registry, map }) {
    return {
        describe: (id) => registry.describe(id),
        idForSublayerKey: (key) => registry.idForSublayerKey(key),
        getAttachments: (name) => layers.layers?.attachments?.[name] || {},
        toggle: (host, sublayer) => layers.toggleSublayer(host, sublayer),
        setVisibility: (host, sublayer, visible) =>
            layers.setAttachmentVisibility(host, sublayer, visible),
        setOpacity: (host, sublayer, opacity) =>
            layers.setSublayerOpacity(host, sublayer, opacity),
        setDropdown: (host, sublayer, value) => {
            const attachment = layers.layers?.attachments?.[host]?.[sublayer]
            const callback = attachment?.layer?.dropdownFunc
            if (typeof callback === 'function')
                callback(host, sublayer, map, value)
        },
    }
}
