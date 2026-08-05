/**
 * GeologicUnits — pure legend derivation, free of `src/essence`.
 *
 * Kept dependency-free so it can be imported (and unit tested) in Node; the
 * `legend.derive` surface in geologicUnits.js is the thin adapter that reads the
 * live layer's features off `window.L_` and hands them here.
 */

// A categorical palette (ColorBrewer Set3-ish). Unit codes are hashed onto it so
// the same code is always the same colour without an admin choosing one.
export const PALETTE = [
    '#8dd3c7',
    '#ffed6f',
    '#bebada',
    '#fb8072',
    '#80b1d3',
    '#fdb462',
    '#b3de69',
    '#fccde5',
    '#bc80bd',
    '#ccebc5',
]

/**
 * Deterministic colour for a unit code.
 * @param {string|number} code
 * @param {string[]} [palette]
 * @returns {string}
 */
export function colorForCode(code, palette = PALETTE) {
    const s = String(code)
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return palette[h % palette.length]
}

/**
 * Build `_legend` entries from the distinct unit codes in the layer's features.
 *
 * Categorical, so each entry is a `square` swatch with `styleMatching` — which
 * both labels the entry and colours every feature whose `unitProp` equals its
 * `propertyValue`, so a layer needs no configured style to be coloured by unit.
 *
 * @param {Array<object>} features  GeoJSON features
 * @param {{unitProp?: string, palette?: string[]}} [opts]
 * @returns {Array<object>} legend entries (empty if no codes were found)
 */
export function buildUnitLegend(features, opts = {}) {
    const { unitProp = 'unit', palette } = opts
    const seen = new Set()
    const codes = []
    for (const f of features || []) {
        const v = f?.properties?.[unitProp]
        if (v == null || v === '') continue
        const code = String(v)
        if (!seen.has(code)) {
            seen.add(code)
            codes.push(code)
        }
    }
    codes.sort()
    return codes.map((code) => ({
        shape: 'square',
        color: colorForCode(code, palette),
        strokecolor: '#333333',
        value: code,
        styleMatching: true,
        propertyName: unitProp,
        propertyValue: code,
    }))
}
