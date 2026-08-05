/**
 * ContactUnits's decisions, with nothing imported from `src/essence`.
 *
 * The handler beside it touches Leaflet/`Map_`, so the part worth testing lives
 * here where a Node unit test can import it. See
 * plugins/core/interactions/README.md.
 */

const DEFAULTS = {
    // The two feature properties naming the units on either side of a contact.
    leftProp: 'unit_left',
    rightProp: 'unit_right',
}

/**
 * Name the two units a clicked contact separates.
 *
 * @param {object|null} feature The clicked GeoJSON feature, if there was one.
 * @param {object|null} config  This interaction's settings on the layer.
 * @returns {{left: ?string, right: ?string, label: string}|null}
 *   null when there is no feature, or it names no units at all.
 */
export function decide(feature, config) {
    if (feature == null) return null
    // `config` is null until an admin fills the form in, and partial after — so
    // defaults belong here, not in the manifest.
    const { leftProp, rightProp } = { ...DEFAULTS, ...(config || {}) }
    const props = feature.properties || {}
    const left = props[leftProp]
    const right = props[rightProp]
    if (left == null && right == null) return null
    const l = left == null ? null : String(left)
    const r = right == null ? null : String(right)
    return {
        left: l,
        right: r,
        label: `Contact between ${l ?? '?'} and ${r ?? '?'}`,
    }
}

/** Minimal HTML escaping for the popup content. */
export function escapeHtml(s) {
    return String(s).replace(
        /[&<>"']/g,
        (c) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[c]
    )
}
