// Creates the `Heatmap` and `HeatmapPolar` demo missions through the configure API.
// Requires a running MMGIS (AUTH=local) and an admin user.
// Usage: MMGIS_URL=http://localhost:8888 MMGIS_USER=admin MMGIS_PASS=... \
//        node scripts/heatmap-demo/create-demo-missions.js
// Node 16 has no global fetch, so this uses http.
const http = require("http");
const https = require("https");

const BASE = process.env.MMGIS_URL || "http://localhost:8888";
const USER = process.env.MMGIS_USER || "admin";
const PASS = process.env.MMGIS_PASS;
if (!PASS) {
  console.error("Set MMGIS_PASS");
  process.exit(1);
}

let cookies = "";
function request(method, route, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + route);
    const data = body ? JSON.stringify(body) : null;
    const req = (url.protocol === "https:" ? https : http).request(
      url,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          Cookie: cookies,
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        if (res.headers["set-cookie"])
          cookies = res.headers["set-cookie"].map((c) => c.split(";")[0]).join("; ");
        let out = "";
        res.on("data", (d) => (out += d));
        res.on("end", () => {
          try {
            resolve(JSON.parse(out));
          } catch (e) {
            reject(new Error(`${route}: ${res.statusCode} ${out.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

const vector = (name, url, extra) => ({
  name,
  type: "vector",
  url,
  visibility: true,
  initialOpacity: 1,
  shape: "none",
  style: {
    className: name.toLowerCase(),
    color: "#fff",
    fillColor: "#3388ff",
    weight: 2,
    fillOpacity: 0.6,
    opacity: 1,
  },
  radius: 3,
  variables: {},
  ...extra,
});

const heatmap = (name, variables, extra) => ({
  name,
  type: "heatmap",
  visibility: true,
  initialOpacity: 0.8,
  variables,
  ...extra,
});

const heatmapMission = {
  msv: {
    mission: "Heatmap",
    site: "",
    masterdb: false,
    view: ["-4.668", "137.37", "15"],
    radius: { major: "3396190", minor: "3376200" },
    mapscale: "",
  },
  projection: { custom: false, epsg: "", proj: "", globeproj: "webmercator" },
  look: { pagename: "MMGIS Heatmap Demo", zoomcontrol: true, minimalist: false },
  panels: ["map"],
  time: {
    enabled: true,
    visible: true,
    initiallyOpen: true,
    format: "%Y-%m-%dT%H:%M:%SZ",
    initialstart: "2024-01-01T00:00:00Z",
    initialend: "2024-01-31T00:00:00Z",
  },
  tools: [
    { name: "Layers", icon: "buffer", js: "LayersTool" },
    { name: "Legend", icon: "format-list-bulleted-type", js: "LegendTool" },
    { name: "Info", icon: "information-variant", js: "InfoTool" },
    { name: "Measure", icon: "chart-areaspline", js: "MeasureTool" },
  ],
  layers: [
    heatmap("Rock Density", {
      sourceLayer: "Rocks",
      weightProperty: "size",
      radius: 25,
      blur: 15,
      maxIntensity: 10,
      gradient: { 0.4: "blue", 0.65: "lime", 1: "red" },
      lineSampleSpacingMeters: 5,
      radiusUnits: "px",
    }),
    heatmap("Traverse Density", {
      sourceLayer: "Traverse",
      radius: 20,
      blur: 12,
      maxIntensity: 3,
      gradient: { 0.3: "#2c7bb6", 0.6: "#ffffbf", 1: "#d7191c" },
      lineSampleSpacingMeters: 5,
      radiusUnits: "px",
    }),
    heatmap(
      "Rocks50k Density",
      {
        sourceLayer: "Rocks50k",
        radius: 12,
        blur: 10,
        maxIntensity: 150,
        radiusUnits: "px",
      },
      { visibility: false }
    ),
    vector("Rocks", "Layers/rocks.geojson", {
      radius: 3,
      time: {
        enabled: true,
        type: "local",
        format: "%Y-%m-%dT%H:%M:%SZ",
        startProp: "",
        endProp: "time",
      },
    }),
    vector("Traverse", "Layers/traverse.geojson", {
      style: {
        className: "traverse",
        color: "#ffd166",
        fillColor: "#ffd166",
        weight: 3,
        fillOpacity: 0.2,
        opacity: 1,
      },
    }),
    vector("Rocks50k", "Layers/rocks50k.geojson", {
      visibility: false,
      radius: 2,
    }),
  ],
};

// Mars north-pole stereographic; 2000 km square around the pole, origin at top-left
const polarMission = {
  msv: {
    mission: "HeatmapPolar",
    site: "",
    masterdb: false,
    view: ["89", "0", "3"],
    radius: { major: "3396190", minor: "3376200" },
    mapscale: "",
  },
  projection: {
    custom: true,
    epsg: "MARS:NPOLE",
    proj: "+proj=stere +lat_0=90 +lon_0=0 +k=1 +x_0=0 +y_0=0 +a=3396190 +b=3376200 +units=m +no_defs",
    globeproj: "webmercator",
    xmlpath: "",
    bounds: ["-1000000", "-1000000", "1000000", "1000000"],
    origin: ["-1000000", "1000000"],
    reszoomlevel: "0",
    resunitsperpixel: "7812.5",
  },
  look: {
    pagename: "MMGIS Polar Heatmap Demo",
    zoomcontrol: true,
    graticule: true,
    minimalist: false,
  },
  panels: ["map"],
  time: { enabled: false },
  tools: [
    { name: "Layers", icon: "buffer", js: "LayersTool" },
    { name: "Info", icon: "information-variant", js: "InfoTool" },
    { name: "Measure", icon: "chart-areaspline", js: "MeasureTool" },
  ],
  layers: [
    heatmap("Polar Point Density", {
      sourceLayer: "Polar Points",
      weightProperty: "size",
      radius: 30,
      blur: 20,
      maxIntensity: 30,
      radiusUnits: "px",
    }),
    heatmap("Polar Line Density", {
      sourceLayer: "Polar Line",
      radius: 15,
      blur: 10,
      maxIntensity: 2,
      gradient: { 0.3: "#00e5ff", 0.7: "#ffea00", 1: "#ff1744" },
      lineSampleSpacingMeters: 5000,
      radiusUnits: "px",
    }),
    vector("Polar Points", "Layers/polar_points.geojson", { radius: 3 }),
    vector("Polar Line", "Layers/polar_line.geojson", {
      style: {
        className: "polarline",
        color: "#ffffff",
        fillColor: "#ffffff",
        weight: 2,
        fillOpacity: 1,
        opacity: 1,
      },
    }),
  ],
};

async function createMission(config) {
  const name = config.msv.mission;
  const added = await request("POST", "/API/configure/add", {
    mission: name,
    makedir: "true",
  });
  if (added.status !== "success" && !/already exists/.test(added.message || ""))
    throw new Error(`add ${name}: ${JSON.stringify(added)}`);
  const upserted = await request("POST", "/API/configure/upsert", {
    mission: name,
    config,
  });
  if (upserted.status !== "success")
    throw new Error(`upsert ${name}: ${JSON.stringify(upserted)}`);
  console.log(`${name}: v${upserted.version}`);
}

(async () => {
  const login = await request("POST", "/API/users/login", {
    username: USER,
    password: PASS,
  });
  if (login.status !== "success") throw new Error(`login: ${login.message}`);
  await createMission(heatmapMission);
  await createMission(polarMission);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
