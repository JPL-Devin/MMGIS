/***********************************************************
 * GeodatasetStats — read-only PostGIS aggregate summaries.
 *
 * Given a geodataset name, returns a compact summary computed entirely
 * server-side (PostGIS aggregates), so a client can understand a dataset's
 * size, extent, geometry mix and temporal span without downloading every
 * feature. Nothing here mutates data — it is SELECT-only.
 **********************************************************/
const express = require("express");
const router = express.Router();

const { sequelize } = require("../../../../../API/connection");
const logger = require("../../../../../API/logger");
const Utils = require("../../../../../API/utils.js");
const geodatasets = require("../../Geodatasets/models/geodatasets");
const Geodatasets = geodatasets.Geodatasets;

// Resolve a geodataset name to its backing table row, or null.
async function findGeodataset(layer) {
  if (typeof layer !== "string" || layer.length === 0) return null;
  const result = await Geodatasets.findOne({ where: { name: layer } });
  return result ? result.dataValues : null;
}

function summary(req, res) {
  const layer = (req.params && req.params.layer) || req.query.layer;

  findGeodataset(layer)
    .then(async (meta) => {
      if (!meta) {
        return res.send({
          status: "failure",
          message: `Geodataset '${layer}' not found.`,
        });
      }

      // Table name comes from our own geodatasets registry, never from user
      // input, but force it alphanumeric+underscore as defense in depth to
      // match how the core Geodatasets routes interpolate the table name.
      const table = Utils.forceAlphaNumUnder(meta.table);

      // Single pass over the table for the spatial + temporal aggregates.
      // ST_Extent gives the 2D bounding box; ST_Centroid over the collected
      // geometry gives an overall centroid. Time columns are BIGINT epoch ms
      // (see Geodatasets model) and may not exist, so guard with to_regclass
      // column checks handled below.
      const q = `
        SELECT
          COUNT(*)                                  AS feature_count,
          ST_XMin(ST_Extent(geom))                  AS minx,
          ST_YMin(ST_Extent(geom))                  AS miny,
          ST_XMax(ST_Extent(geom))                  AS maxx,
          ST_YMax(ST_Extent(geom))                  AS maxy,
          ST_X(ST_Centroid(ST_Collect(geom)))       AS centroid_lng,
          ST_Y(ST_Centroid(ST_Collect(geom)))       AS centroid_lat,
          MIN(start_time)                           AS min_start_time,
          MAX(end_time)                             AS max_end_time
        FROM ${table};
      `;

      // Geometry-type breakdown (Point / LineString / Polygon / ...).
      const gtQ = `
        SELECT geometry_type AS type, COUNT(*) AS count
        FROM ${table}
        GROUP BY geometry_type
        ORDER BY count DESC;
      `;

      try {
        // Some geodataset tables omit start_time / end_time columns entirely
        // (they are only created when the dataset declared time fields).
        const columns = Object.keys(
          await sequelize.getQueryInterface().describeTable(table)
        );
        const hasTime =
          columns.includes("start_time") && columns.includes("end_time");

        const effectiveQ = hasTime
          ? q
          : q
              .replace("MIN(start_time)", "NULL")
              .replace("MAX(end_time)", "NULL");

        const [[agg]] = await sequelize.query(effectiveQ);
        const [geometryTypes] = await sequelize.query(gtQ);

        const featureCount = parseInt(agg.feature_count, 10) || 0;

        const bbox =
          agg.minx != null
            ? [
                parseFloat(agg.minx),
                parseFloat(agg.miny),
                parseFloat(agg.maxx),
                parseFloat(agg.maxy),
              ]
            : null;

        const centroid =
          agg.centroid_lng != null
            ? [parseFloat(agg.centroid_lng), parseFloat(agg.centroid_lat)]
            : null;

        const timeExtent =
          hasTime && agg.min_start_time != null && agg.max_end_time != null
            ? {
                start: new Date(Number(agg.min_start_time)).toISOString(),
                end: new Date(Number(agg.max_end_time)).toISOString(),
                start_ms: Number(agg.min_start_time),
                end_ms: Number(agg.max_end_time),
              }
            : null;

        return res.send({
          status: "success",
          body: {
            name: meta.name,
            table: meta.table,
            featureCount,
            registeredFeatureCount:
              meta.num_features != null ? meta.num_features : null,
            bbox,
            centroid,
            timeExtent,
            geometryTypes: geometryTypes.map((g) => ({
              type: g.type,
              count: parseInt(g.count, 10) || 0,
            })),
          },
        });
      } catch (err) {
        logger(
          "error",
          "Failed to compute geodataset stats.",
          "geodatasetstats",
          null,
          err
        );
        return res.send({
          status: "failure",
          message: "Failed to compute geodataset stats.",
        });
      }
    })
    .catch((err) => {
      logger(
        "error",
        "Failed to look up geodataset.",
        "geodatasetstats",
        null,
        err
      );
      return res.send({
        status: "failure",
        message: "Failed to look up geodataset.",
      });
    });
}

router.get("/summary/:layer", summary);
router.get("/summary", summary);

module.exports = router;
