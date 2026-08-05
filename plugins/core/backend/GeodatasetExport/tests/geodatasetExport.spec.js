/**
 * GeodatasetExport backend — unit tests.
 * npx cross-env PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/core/backend/GeodatasetExport/tests/
 */
const { test, expect } = require("@playwright/test");
const path = require("path");

const manifest = require(path.resolve(__dirname, "..", "plugin.json"));
const setup = require(path.resolve(__dirname, "..", "plugin.js"));
const {
  serialize,
  parseBbox,
  csvEscape,
} = require(path.resolve(
  __dirname,
  "..",
  "routes",
  "geodatasetExport.js"
)).__test;

const ROWS = [
  {
    properties: { name: "Crater A", depth: 12 },
    geojson: '{"type":"Point","coordinates":[1,2]}',
    wkt: "POINT(1 2)",
  },
  {
    properties: { name: 'Ridge, "B"', depth: null },
    geojson: '{"type":"Point","coordinates":[3,4]}',
    wkt: "POINT(3 4)",
  },
];

test("plugin.json is valid @unit", () => {
  expect(manifest.name).toBe("GeodatasetExport");
  expect(manifest.type).toBe("backend");
  expect(manifest.routes.prefix).toBe("/api/geodatasetExport");
});

test("lifecycle hooks are functions @unit", () => {
  for (const hook of ["onceInit", "onceStarted", "onceSynced"])
    expect(typeof setup[hook]).toBe("function");
});

test("onceInit mounts under ROOT_PATH behind an auth gate @unit", () => {
  const mounts = [];
  const gate = () => "gate";
  setup.onceInit({
    app: {
      use: (route, ...middleware) => mounts.push({ route, middleware }),
    },
    ROOT_PATH: "/root",
    ensureUser: gate,
    ensureAdmin: gate,
    checkHeadersCodeInjection: "checkHeaders",
    setContentType: "setContentType",
  });

  expect(mounts.length).toBe(1);
  expect(mounts[0].route).toBe("/root/api/geodatasetExport");
  expect(mounts[0].middleware).toContain("gate");
});

test("parseBbox validates @unit", () => {
  expect(parseBbox(null)).toBe(null);
  expect(parseBbox("1,2,3")).toBe(false);
  expect(parseBbox("1,2,a,4")).toBe(false);
  expect(parseBbox("3,2,1,4")).toBe(false);
  expect(parseBbox("1,2,3,4")).toEqual({ minx: 1, miny: 2, maxx: 3, maxy: 4 });
});

test("csvEscape quotes commas and quotes @unit", () => {
  expect(csvEscape(null)).toBe("");
  expect(csvEscape("a,b")).toBe('"a,b"');
  expect(csvEscape('he said "hi"')).toBe('"he said ""hi"""');
});

test("serialize geojson @unit", () => {
  const fc = JSON.parse(serialize(ROWS, "geojson", null));
  expect(fc.type).toBe("FeatureCollection");
  expect(fc.features.length).toBe(2);
  expect(fc.features[0].geometry).toEqual({ type: "Point", coordinates: [1, 2] });
  expect(fc.features[0].properties.depth).toBe(12);
});

test("serialize geojson honors property selection @unit", () => {
  const fc = JSON.parse(serialize(ROWS, "geojson", ["name"]));
  expect(fc.features[0].properties).toEqual({ name: "Crater A" });
});

test("serialize csv @unit", () => {
  const lines = serialize(ROWS, "csv", null).trim().split("\n");
  expect(lines[0]).toBe("name,depth,wkt");
  expect(lines[1]).toBe("Crater A,12,POINT(1 2)");
  expect(lines[2]).toBe('"Ridge, ""B""",,POINT(3 4)');
});

test("serialize wkt @unit", () => {
  expect(serialize(ROWS, "wkt", null)).toBe("POINT(1 2)\nPOINT(3 4)\n");
});
