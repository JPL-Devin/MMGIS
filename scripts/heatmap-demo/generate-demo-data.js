// Generates the GeoJSON used by the `Heatmap` and `HeatmapPolar` demo missions.
// Usage: node scripts/heatmap-demo/generate-demo-data.js [--rocks50k]
//   Missions/Heatmap/Layers/{rocks,traverse}.geojson      (committed, small)
//   Missions/Heatmap/Layers/rocks50k.geojson              (50k points, not committed)
//   Missions/HeatmapPolar/Layers/{polar_points,polar_line}.geojson
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");

// Deterministic PRNG so committed files are reproducible
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fc(features) {
  return { type: "FeatureCollection", features };
}
function writeJSON(rel, obj, pretty) {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, pretty ? JSON.stringify(obj, null, 1) : JSON.stringify(obj));
  const kb = (fs.statSync(p).size / 1024).toFixed(0);
  console.log(`${rel}  (${obj.features.length} features, ${kb} KB)`);
}

// Gale crater area (matches MMGIS default view)
const CENTER = { lng: 137.37, lat: -4.668 };
const T0 = Date.parse("2024-01-01T00:00:00Z");
const T1 = Date.parse("2024-01-31T00:00:00Z");

// Points in a few gaussian clusters plus uniform background, with numeric `size` and a `time`
function makeRocks(n, seed, spread) {
  const rnd = mulberry32(seed);
  const gauss = () =>
    Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const clusters = [];
  for (let c = 0; c < 6; c++)
    clusters.push({
      lng: CENTER.lng + (rnd() - 0.5) * spread,
      lat: CENTER.lat + (rnd() - 0.5) * spread,
      sd: spread * (0.03 + rnd() * 0.08),
    });
  const features = [];
  for (let i = 0; i < n; i++) {
    let lng, lat;
    if (rnd() < 0.75) {
      const c = clusters[Math.floor(rnd() * clusters.length)];
      lng = c.lng + gauss() * c.sd;
      lat = c.lat + gauss() * c.sd;
    } else {
      lng = CENTER.lng + (rnd() - 0.5) * spread;
      lat = CENTER.lat + (rnd() - 0.5) * spread;
    }
    const size = Math.round(Math.pow(rnd(), 3) * 9.9 * 100) / 100 + 0.1;
    const time = new Date(T0 + rnd() * (T1 - T0)).toISOString();
    features.push({
      type: "Feature",
      properties: { id: i, size, time, class: size > 5 ? "boulder" : "rock" },
      geometry: {
        type: "Point",
        coordinates: [+lng.toFixed(6), +lat.toFixed(6)],
      },
    });
  }
  return fc(features);
}

function makeTraverse() {
  const c = CENTER;
  const d = 0.004;
  const line = (id, pts) => ({
    type: "Feature",
    properties: { id, kind: "traverse", sol: id },
    geometry: { type: "LineString", coordinates: pts },
  });
  const poly = (id, pts) => ({
    type: "Feature",
    properties: { id, kind: "workspace", area_class: id },
    geometry: { type: "Polygon", coordinates: [pts.concat([pts[0]])] },
  });
  return fc([
    line(1, [
      [c.lng - 2 * d, c.lat - 2 * d],
      [c.lng - d, c.lat - d],
      [c.lng, c.lat - 1.5 * d],
      [c.lng + d, c.lat - 0.5 * d],
    ]),
    line(2, [
      [c.lng + d, c.lat - 0.5 * d],
      [c.lng + 1.5 * d, c.lat + 0.5 * d],
      [c.lng + 0.5 * d, c.lat + 1.5 * d],
      [c.lng - 0.5 * d, c.lat + 2 * d],
    ]),
    line(3, [
      [c.lng - 2 * d, c.lat + 2 * d],
      [c.lng - 1.5 * d, c.lat + 0.5 * d],
      [c.lng - 0.5 * d, c.lat],
    ]),
    line(4, [
      [c.lng - 2.5 * d, c.lat],
      [c.lng + 2.5 * d, c.lat + 0.2 * d],
    ]),
    poly(1, [
      [c.lng - 1.2 * d, c.lat - 1.2 * d],
      [c.lng - 0.6 * d, c.lat - 1.3 * d],
      [c.lng - 0.5 * d, c.lat - 0.7 * d],
      [c.lng - 1.1 * d, c.lat - 0.6 * d],
    ]),
    poly(2, [
      [c.lng + 0.8 * d, c.lat + 0.6 * d],
      [c.lng + 1.6 * d, c.lat + 0.7 * d],
      [c.lng + 1.4 * d, c.lat + 1.4 * d],
      [c.lng + 0.7 * d, c.lat + 1.2 * d],
    ]),
    poly(3, [
      [c.lng - 2.2 * d, c.lat + 1.2 * d],
      [c.lng - 1.6 * d, c.lat + 1.1 * d],
      [c.lng - 1.7 * d, c.lat + 1.8 * d],
      [c.lng - 2.3 * d, c.lat + 1.7 * d],
    ]),
  ]);
}

// Points clustered around the north pole (lat 84..90, all longitudes)
function makePolarPoints(n, seed) {
  const rnd = mulberry32(seed);
  const features = [];
  for (let i = 0; i < n; i++) {
    const lng = rnd() * 360 - 180;
    const lat = 90 - Math.pow(rnd(), 1.5) * 6;
    features.push({
      type: "Feature",
      properties: { id: i, size: +(rnd() * 10).toFixed(2) },
      geometry: {
        type: "Point",
        coordinates: [+lng.toFixed(5), +Math.min(lat, 89.999).toFixed(5)],
      },
    });
  }
  return fc(features);
}

// A line that passes straight over the pole (lon 0 -> lon 180) plus one along a parallel
function makePolarLines() {
  return fc([
    {
      type: "Feature",
      properties: { id: 1, name: "Pole crossing" },
      geometry: {
        type: "LineString",
        coordinates: [
          [0, 82],
          [0, 89.9],
          [180, 89.9],
          [180, 82],
        ],
      },
    },
    {
      type: "Feature",
      properties: { id: 2, name: "Antimeridian crossing" },
      geometry: {
        type: "LineString",
        coordinates: [
          [150, 85],
          [179.9, 85],
          [-179.9, 85],
          [-150, 85],
        ],
      },
    },
  ]);
}

writeJSON("Missions/Heatmap/Layers/rocks.geojson", makeRocks(2000, 1, 0.02));
writeJSON("Missions/Heatmap/Layers/traverse.geojson", makeTraverse(), true);
writeJSON("Missions/HeatmapPolar/Layers/polar_points.geojson", makePolarPoints(400, 7));
writeJSON("Missions/HeatmapPolar/Layers/polar_line.geojson", makePolarLines(), true);
if (process.argv.includes("--rocks50k"))
  writeJSON("Missions/Heatmap/Layers/rocks50k.geojson", makeRocks(50000, 2, 0.03));
