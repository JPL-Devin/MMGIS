#!/usr/bin/env node
// Generates the GeoJSON for the Heatmap / HeatmapPolar reference mission blueprints.
//   node scripts/generate-heatmap-demo-data.js            # small committed files
//   node scripts/generate-heatmap-demo-data.js --with-50k # also the (uncommitted) 50k perf file
// Deterministic (seeded) so re-running produces identical output.
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const HEATMAP_DIR = path.join(ROOT, 'blueprints/Missions/Heatmap/Layers')
const POLAR_DIR = path.join(ROOT, 'blueprints/Missions/HeatmapPolar/Layers')

// mulberry32: small seeded PRNG
function rng(seed) {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
function gaussian(rand) {
    const u = 1 - rand()
    const v = rand()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
const fc = (features) => ({ type: 'FeatureCollection', features })
const round = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d

const T0 = Date.UTC(2024, 0, 1)
const T1 = Date.UTC(2024, 0, 20)
const isoBetween = (rand) =>
    new Date(T0 + rand() * (T1 - T0)).toISOString().replace(/\.\d{3}Z$/, 'Z')

// SF Bay Area clusters (lng, lat, sigma degrees, share)
const BAY_CLUSTERS = [
    [-122.42, 37.78, 0.02, 0.35],
    [-122.27, 37.87, 0.015, 0.2],
    [-122.16, 37.45, 0.03, 0.2],
    [-122.3, 37.62, 0.05, 0.25],
]

function rocks(count, seed) {
    const rand = rng(seed)
    const features = []
    for (let i = 0; i < count; i++) {
        let r = rand()
        let c = BAY_CLUSTERS[BAY_CLUSTERS.length - 1]
        for (const cl of BAY_CLUSTERS) {
            if (r < cl[3]) {
                c = cl
                break
            }
            r -= cl[3]
        }
        const lng = c[0] + gaussian(rand) * c[2]
        const lat = c[1] + gaussian(rand) * c[2] * 0.8
        features.push({
            type: 'Feature',
            properties: {
                id: i,
                name: `Rock ${i}`,
                size: round(
                    Math.max(0.1, Math.abs(gaussian(rand)) * 3 + 0.5),
                    2
                ),
                time: isoBetween(rand),
            },
            geometry: { type: 'Point', coordinates: [round(lng), round(lat)] },
        })
    }
    return fc(features)
}

function traverse() {
    const line = (name, coords, priority) => ({
        type: 'Feature',
        properties: { name, priority },
        geometry: { type: 'LineString', coordinates: coords },
    })
    const poly = (name, ring, priority) => ({
        type: 'Feature',
        properties: { name, priority },
        geometry: { type: 'Polygon', coordinates: [ring.concat([ring[0]])] },
    })
    return fc([
        line(
            'Sol 1-40 drive',
            [
                [-122.51, 37.77],
                [-122.47, 37.79],
                [-122.43, 37.775],
                [-122.4, 37.79],
                [-122.39, 37.76],
            ],
            3
        ),
        line(
            'Bay crossing',
            [
                [-122.39, 37.79],
                [-122.33, 37.82],
                [-122.29, 37.86],
            ],
            1
        ),
        {
            type: 'Feature',
            properties: { name: 'Peninsula legs', priority: 2 },
            geometry: {
                type: 'MultiLineString',
                coordinates: [
                    [
                        [-122.42, 37.72],
                        [-122.4, 37.68],
                        [-122.38, 37.63],
                    ],
                    [
                        [-122.3, 37.58],
                        [-122.25, 37.53],
                        [-122.18, 37.47],
                    ],
                ],
            },
        },
        poly(
            'Golden Gate Park survey',
            [
                [-122.51, 37.766],
                [-122.455, 37.766],
                [-122.455, 37.774],
                [-122.51, 37.774],
            ],
            2
        ),
        poly(
            'Berkeley hills survey',
            [
                [-122.27, 37.86],
                [-122.24, 37.85],
                [-122.22, 37.88],
                [-122.25, 37.9],
            ],
            4
        ),
        poly(
            'Alameda survey',
            [
                [-122.29, 37.76],
                [-122.24, 37.75],
                [-122.25, 37.78],
                [-122.28, 37.79],
            ],
            1
        ),
    ])
}

// Points clustered within ~3 degrees of the north pole, every longitude.
function polarPoints(count, seed) {
    const rand = rng(seed)
    const features = []
    for (let i = 0; i < count; i++) {
        const lng = round(rand() * 360 - 180)
        const lat = round(90 - Math.abs(gaussian(rand)) * 1.2)
        features.push({
            type: 'Feature',
            properties: {
                id: i,
                intensity: round(Math.abs(gaussian(rand)) * 5 + 1, 2),
            },
            geometry: {
                type: 'Point',
                coordinates: [lng, Math.min(lat, 89.99)],
            },
        })
    }
    return fc(features)
}

// A line that goes up meridian -120 over the pole and down meridian 60, plus a ring.
function polarLines() {
    const ring = []
    for (let lng = -180; lng <= 180; lng += 15) ring.push([lng, 86.5])
    return fc([
        {
            type: 'Feature',
            properties: { name: 'Pole crossing' },
            geometry: {
                type: 'LineString',
                coordinates: [
                    [-120, 84],
                    [-120, 88],
                    [60, 88],
                    [60, 84],
                ],
            },
        },
        {
            type: 'Feature',
            properties: { name: '86.5N ring' },
            geometry: { type: 'LineString', coordinates: ring },
        },
    ])
}

function write(file, data) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(data))
    const kb = (fs.statSync(file).size / 1024).toFixed(0)
    console.log(
        `wrote ${path.relative(ROOT, file)} (${data.features.length} features, ${kb} KB)`
    )
}

write(path.join(HEATMAP_DIR, 'rocks.geojson'), rocks(2000, 1))
write(path.join(HEATMAP_DIR, 'traverse.geojson'), traverse())
write(path.join(POLAR_DIR, 'polar-points.geojson'), polarPoints(600, 7))
write(path.join(POLAR_DIR, 'polar-lines.geojson'), polarLines())
if (process.argv.includes('--with-50k'))
    write(path.join(HEATMAP_DIR, 'rocks-50k.geojson'), rocks(50000, 42))
