/**
 * GeodatasetExport — download a PostGIS-backed geodataset as a file.
 *
 * GET /api/geodatasetExport/formats
 * GET /api/geodatasetExport/export/:name?format=geojson|csv|wkt&bbox=&limit=&properties=
 */
const express = require("express");
const router = express.Router();

const { sequelize } = require("../../../../../API/connection");
const logger = require("../../../../../API/logger");
const Utils = require("../../../../../API/utils.js");

const FORMATS = {
  geojson: { ext: "geojson", contentType: "application/geo+json" },
  csv: { ext: "csv", contentType: "text/csv" },
  wkt: { ext: "wkt", contentType: "text/plain" },
};

const MAX_LIMIT = 100000;
const DEFAULT_LIMIT = 10000;

function parseBbox(raw) {
  if (raw == null) return null;
  const parts = String(raw).split(",").map(Number);
  if (parts.length !== 4 || parts.some((p) => !Number.isFinite(p))) return false;
  const [minx, miny, maxx, maxy] = parts;
  if (minx > maxx || miny > maxy) return false;
  return { minx, miny, maxx, maxy };
}

function csvEscape(v) {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function lookupTable(name) {
  const [rows] = await sequelize.query(
    'SELECT "table" AS tablename FROM geodatasets WHERE name = :name',
    { replacements: { name } }
  );
  if (!rows || rows.length === 0) return null;
  return Utils.forceAlphaNumUnder(rows[0].tablename);
}

router.get("/formats", (req, res) => {
  res.json({ status: "success", formats: Object.keys(FORMATS) });
});

router.get("/export/:name", async (req, res) => {
  const name = req.params.name;
  const format = String(req.query.format || "geojson").toLowerCase();
  if (!FORMATS[format])
    return res.status(400).json({
      status: "failure",
      message: `Unsupported format '${format}'. Supported: ${Object.keys(
        FORMATS
      ).join(", ")}`,
    });

  const bbox = parseBbox(req.query.bbox);
  if (bbox === false)
    return res.status(400).json({
      status: "failure",
      message: "Malformed bbox. Expected minx,miny,maxx,maxy.",
    });

  let limit = parseInt(req.query.limit);
  if (Number.isNaN(limit)) limit = DEFAULT_LIMIT;
  limit = Math.min(Math.max(limit, 1), MAX_LIMIT);

  const only =
    typeof req.query.properties === "string" && req.query.properties.length > 0
      ? req.query.properties.split(",").map((p) => p.trim())
      : null;

  let table;
  try {
    table = await lookupTable(name);
  } catch (err) {
    logger("error", "Failed to look up geodataset.", "geodatasetExport", req, err);
    return res
      .status(500)
      .json({ status: "failure", message: "Failed to look up geodataset" });
  }
  if (table == null)
    return res
      .status(404)
      .json({ status: "failure", message: `Unknown geodataset '${name}'` });

  const where = bbox
    ? "WHERE geom && ST_MakeEnvelope(:minx, :miny, :maxx, :maxy, 4326)"
    : "";
  const replacements = bbox ? bbox : {};

  let rows;
  try {
    [rows] = await sequelize.query(
      `SELECT properties, ST_AsGeoJSON(geom) AS geojson, ST_AsText(geom) AS wkt
       FROM ${table} ${where} LIMIT ${limit}`,
      { replacements }
    );
  } catch (err) {
    logger("error", "Failed to export geodataset.", "geodatasetExport", req, err);
    return res
      .status(500)
      .json({ status: "failure", message: "Failed to export geodataset" });
  }

  const safeName = String(name).replace(/[^\w.-]/g, "_");
  res.setHeader("Content-Type", FORMATS[format].contentType);
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeName}.${FORMATS[format].ext}"`
  );

  res.send(serialize(rows, format, only));
});

function pickProps(properties, only) {
  const props = properties || {};
  if (!only) return props;
  const out = {};
  only.forEach((k) => {
    if (k in props) out[k] = props[k];
  });
  return out;
}

function serialize(rows, format, only) {
  if (format === "geojson") {
    return JSON.stringify({
      type: "FeatureCollection",
      features: rows.map((r) => ({
        type: "Feature",
        properties: pickProps(r.properties, only),
        geometry: r.geojson ? JSON.parse(r.geojson) : null,
      })),
    });
  }

  if (format === "wkt")
    return rows.map((r) => r.wkt || "").join("\n") + (rows.length ? "\n" : "");

  // csv
  const keys = only
    ? only.slice()
    : Array.from(
        rows.reduce((set, r) => {
          Object.keys(r.properties || {}).forEach((k) => set.add(k));
          return set;
        }, new Set())
      );
  const header = keys.concat(["wkt"]).map(csvEscape).join(",");
  const lines = rows.map((r) => {
    const props = r.properties || {};
    return keys
      .map((k) => csvEscape(props[k]))
      .concat([csvEscape(r.wkt)])
      .join(",");
  });
  return [header].concat(lines).join("\n") + "\n";
}

module.exports = router;
module.exports.__test = { serialize, parseBbox, csvEscape, pickProps };
