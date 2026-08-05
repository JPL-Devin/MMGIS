/**
 * Plot geometry for the Spectra tool. Imports nothing, so it is unit-testable.
 */

export const SERIES_COLORS = [
    '#e6194b',
    '#3cb44b',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#46f0f0',
]

/**
 * @param {Array<{wavelengths:number[],reflectance:number[]}>} selections
 * @returns {{minX:number,maxX:number,minY:number,maxY:number}|null}
 */
export function extentOf(selections) {
    const xs = []
    const ys = []
    ;(selections || []).forEach((s) => {
        xs.push(...s.wavelengths)
        ys.push(...s.reflectance)
    })
    if (xs.length === 0) return null
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY,
        maxY: maxY === minY ? minY + 1 : maxY,
    }
}

/**
 * Maps one selection to an SVG polyline `points` string in the given box.
 * @param {{wavelengths:number[],reflectance:number[]}} selection
 * @param {{minX:number,maxX:number,minY:number,maxY:number}} extent
 * @param {{width:number,height:number,padLeft:number,padBottom:number,padTop:number,padRight:number}} box
 * @returns {string}
 */
export function polylinePoints(selection, extent, box) {
    const { width, height, padLeft, padBottom, padTop, padRight } = box
    const plotW = width - padLeft - padRight
    const plotH = height - padTop - padBottom
    const spanX = extent.maxX - extent.minX || 1
    const spanY = extent.maxY - extent.minY || 1
    return selection.wavelengths
        .map((w, i) => {
            const x = padLeft + ((w - extent.minX) / spanX) * plotW
            const y =
                padTop +
                plotH -
                ((selection.reflectance[i] - extent.minY) / spanY) * plotH
            return `${round(x)},${round(y)}`
        })
        .join(' ')
}

function round(n) {
    return Math.round(n * 100) / 100
}

export function colorFor(index) {
    return SERIES_COLORS[index % SERIES_COLORS.length]
}
