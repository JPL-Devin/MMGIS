// GeoJSON geometries -> weighted samples [lng, lat, weight]. Lines are densified
// geodesically (great-circle); polygons = densified boundary + local-plane interior grid.
import F_ from '@basics/Formulae_/Formulae_'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI

function toVec(lng, lat) {
    const φ = lat * D2R
    const λ = lng * D2R
    const c = Math.cos(φ)
    return [c * Math.cos(λ), c * Math.sin(λ), Math.sin(φ)]
}

function fromVec(v) {
    const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) * R2D
    const lng = Math.atan2(v[1], v[0]) * R2D
    return [lng, lat]
}

// Great-circle distance in meters.
export function geodesicDistance(a, b) {
    return F_.lngLatDistBetween(a[0], a[1], b[0], b[1])
}

// Samples along the great circle from a to b (excluding b) every `spacing` m.
function densifySegment(a, b, spacing, out) {
    const dist = geodesicDistance(a, b)
    out.push([a[0], a[1]])
    if (!(dist > spacing) || !(spacing > 0)) return
    const n = Math.floor(dist / spacing)
    const va = toVec(a[0], a[1])
    const vb = toVec(b[0], b[1])
    const dot = Math.max(
        -1,
        Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2])
    )
    const ω = Math.acos(dot)
    if (ω === 0) return
    const sinω = Math.sin(ω)
    for (let i = 1; i <= n; i++) {
        const t = (i * spacing) / dist
        if (t >= 1) break
        const s0 = Math.sin((1 - t) * ω) / sinω
        const s1 = Math.sin(t * ω) / sinω
        out.push(
            fromVec([
                s0 * va[0] + s1 * vb[0],
                s0 * va[1] + s1 * vb[1],
                s0 * va[2] + s1 * vb[2],
            ])
        )
    }
}

export function densifyLine(coords, spacing) {
    const out = []
    for (let i = 0; i < coords.length - 1; i++)
        densifySegment(coords[i], coords[i + 1], spacing, out)
    if (coords.length)
        out.push([coords[coords.length - 1][0], coords[coords.length - 1][1]])
    return out
}

// Interior grid of a ring, sampled in a local azimuthal-equidistant plane
// centered on the ring so the grid is uniform in meters (not degrees).
function sampleRingInterior(ring, approxCount) {
    if (ring.length < 3 || !(approxCount > 0)) return []
    let cx = 0
    let cy = 0
    let cz = 0
    for (const c of ring) {
        const v = toVec(c[0], c[1])
        cx += v[0]
        cy += v[1]
        cz += v[2]
    }
    const len = Math.hypot(cx, cy, cz) || 1
    const center = fromVec([cx / len, cy / len, cz / len])
    const R = F_.radiusOfPlanetMajor
    const φ0 = center[1] * D2R
    const λ0 = center[0] * D2R

    const local = ring.map((c) => {
        const φ = c[1] * D2R
        const λ = c[0] * D2R
        const cosc =
            Math.sin(φ0) * Math.sin(φ) +
            Math.cos(φ0) * Math.cos(φ) * Math.cos(λ - λ0)
        const cc = Math.acos(Math.max(-1, Math.min(1, cosc)))
        const k = cc === 0 ? 1 : cc / Math.sin(cc)
        return [
            R * k * Math.cos(φ) * Math.sin(λ - λ0),
            R *
                k *
                (Math.cos(φ0) * Math.sin(φ) -
                    Math.sin(φ0) * Math.cos(φ) * Math.cos(λ - λ0)),
        ]
    })
    let minx = Infinity
    let miny = Infinity
    let maxx = -Infinity
    let maxy = -Infinity
    for (const p of local) {
        if (p[0] < minx) minx = p[0]
        if (p[0] > maxx) maxx = p[0]
        if (p[1] < miny) miny = p[1]
        if (p[1] > maxy) maxy = p[1]
    }
    const w = maxx - minx
    const h = maxy - miny
    if (!(w > 0) || !(h > 0)) return []
    const step = Math.sqrt((w * h) / approxCount)
    const out = []
    for (let y = miny + step / 2; y < maxy; y += step) {
        for (let x = minx + step / 2; x < maxx; x += step) {
            if (!pointInRing(x, y, local)) continue
            // Inverse azimuthal equidistant back to lng/lat.
            const ρ = Math.hypot(x, y) / R
            if (ρ === 0) {
                out.push([center[0], center[1]])
                continue
            }
            const φ = Math.asin(
                Math.cos(ρ) * Math.sin(φ0) +
                    (y * Math.sin(ρ) * Math.cos(φ0)) / (ρ * R)
            )
            const λ =
                λ0 +
                Math.atan2(
                    x * Math.sin(ρ),
                    ρ * R * Math.cos(φ0) * Math.cos(ρ) -
                        y * Math.sin(φ0) * Math.sin(ρ)
                )
            out.push([λ * R2D, φ * R2D])
        }
    }
    return out
}

function pointInRing(x, y, ring) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0]
        const yi = ring[i][1]
        const xj = ring[j][0]
        const yj = ring[j][1]
        const above_i = yi > y
        const above_j = yj > y
        const crosses = above_i !== above_j
        if (crosses && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
            inside = !inside
    }
    return inside
}

export function sampleGeometry(geometry, weight, opts, out) {
    if (geometry == null) return
    const spacing = opts.spacingMeters
    switch (geometry.type) {
        case 'Point': {
            const c = geometry.coordinates
            out.push([c[0], c[1], weight])
            break
        }
        case 'MultiPoint':
            for (const c of geometry.coordinates) out.push([c[0], c[1], weight])
            break
        case 'LineString': {
            const pts = densifyLine(geometry.coordinates, spacing)
            for (const p of pts) out.push([p[0], p[1], weight])
            break
        }
        case 'MultiLineString':
            for (const line of geometry.coordinates)
                sampleGeometry(
                    { type: 'LineString', coordinates: line },
                    weight,
                    opts,
                    out
                )
            break
        case 'Polygon': {
            const outer = geometry.coordinates[0] || []
            const boundary = densifyLine(outer, spacing)
            const interior = sampleRingInterior(
                outer,
                opts.polygonInteriorSamples
            )
            for (const p of boundary) out.push([p[0], p[1], weight])
            for (const p of interior) out.push([p[0], p[1], weight])
            break
        }
        case 'MultiPolygon':
            for (const poly of geometry.coordinates)
                sampleGeometry(
                    { type: 'Polygon', coordinates: poly },
                    weight,
                    opts,
                    out
                )
            break
        case 'GeometryCollection':
            for (const g of geometry.geometries || [])
                sampleGeometry(g, weight, opts, out)
            break
        default:
            break
    }
}

export function featureWeight(feature, weightProperty, weightMin, weightMax) {
    let w = 1
    if (weightProperty) {
        const props = feature.properties || {}
        const raw =
            weightProperty.indexOf('.') === -1
                ? props[weightProperty]
                : F_.getIn(props, weightProperty)
        const v = parseFloat(raw)
        w = Number.isFinite(v) ? v : 0
    }
    const hasMin = Number.isFinite(weightMin)
    const hasMax = Number.isFinite(weightMax)
    if (hasMin && w < weightMin) w = weightMin
    if (hasMax && w > weightMax) w = weightMax
    if (hasMin && hasMax && weightMax > weightMin)
        w = (w - weightMin) / (weightMax - weightMin)
    return w
}

/**
 * GeoJSON FeatureCollection -> Float64Array-friendly sample list
 * [[lng, lat, weight], ...] plus the set of numeric property names seen.
 */
export function sampleFeatureCollection(geojson, options) {
    const opts = {
        spacingMeters: options.spacingMeters > 0 ? options.spacingMeters : 10,
        polygonInteriorSamples:
            options.polygonInteriorSamples >= 0
                ? options.polygonInteriorSamples
                : 64,
    }
    const out = []
    const numericProps = new Set()
    const features = geojson?.features || []
    for (const f of features) {
        if (!f || !f.geometry) continue
        const props = f.properties || {}
        for (const k in props) {
            if (
                typeof props[k] === 'number' ||
                (typeof props[k] === 'string' &&
                    props[k] !== '' &&
                    !isNaN(props[k]))
            )
                numericProps.add(k)
        }
        const w = featureWeight(
            f,
            options.weightProperty,
            options.weightMin,
            options.weightMax
        )
        if (w <= 0) continue
        sampleGeometry(f.geometry, w, opts, out)
    }
    return { samples: out, numericProps: [...numericProps].sort() }
}
