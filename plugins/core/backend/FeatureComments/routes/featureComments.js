const express = require("express");
const router = express.Router();
const Sequelize = require("sequelize");

const logger = require("../../../../../API/logger");
const { FeatureComments } = require("../models/featureComments");

const MAX_BODY_LENGTH = 4000;

function isAdmin(req) {
  return (
    req.session.permission === "111" ||
    req.session.permission === "110" ||
    req.tokenUserPermission === "111"
  );
}

function requireStrings(obj, keys) {
  for (const k of keys) {
    if (typeof obj[k] !== "string" || obj[k].trim() === "")
      return `'${k}' is required and must be a non-empty string.`;
  }
  return null;
}

/** Nest flat rows into threads: top-level comments with `replies` children. */
function buildThreads(rows) {
  const byId = {};
  const roots = [];
  rows.forEach((r) => {
    byId[r.id] = Object.assign({}, r, { replies: [] });
  });
  rows.forEach((r) => {
    const node = byId[r.id];
    if (r.parent_id != null && byId[r.parent_id])
      byId[r.parent_id].replies.push(node);
    else roots.push(node);
  });
  return roots;
}

/**
 * @swagger
 * /api/featurecomments/create:
 *   post:
 *     tags: [FeatureComments]
 *     summary: Create a comment (or reply) on a feature
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mission, layer, feature, body]
 *             properties:
 *               mission: { type: string }
 *               layer: { type: string, description: Layer name }
 *               feature: { type: string, description: Feature id/key }
 *               body: { type: string, maxLength: 4000 }
 *               parent_id: { type: integer, description: Id of comment being replied to }
 *     responses:
 *       200:
 *         description: "{ status: 'success', comment }"
 */
router.post("/create", async (req, res) => {
  const b = req.body || {};
  const err = requireStrings(b, ["mission", "layer", "feature", "body"]);
  if (err) return res.send({ status: "failure", message: err });
  if (b.body.length > MAX_BODY_LENGTH)
    return res.send({
      status: "failure",
      message: `'body' exceeds ${MAX_BODY_LENGTH} characters.`,
    });

  let parent_id = null;
  if (b.parent_id != null) {
    parent_id = parseInt(b.parent_id);
    if (isNaN(parent_id))
      return res.send({ status: "failure", message: "'parent_id' must be an integer." });
    const parent = await FeatureComments.findOne({ where: { id: parent_id } });
    if (
      !parent ||
      parent.mission !== b.mission ||
      parent.layer !== b.layer ||
      parent.feature !== b.feature
    )
      return res.send({
        status: "failure",
        message: "Parent comment not found on this feature.",
      });
  }

  try {
    const comment = await FeatureComments.create({
      mission: b.mission,
      layer: b.layer,
      feature: b.feature,
      author: req.user,
      body: b.body,
      parent_id,
    });
    res.send({ status: "success", comment });
  } catch (e) {
    logger("error", "Failed to create feature comment.", req.originalUrl, req, e);
    res.send({ status: "failure", message: "Failed to create comment." });
  }
});

/**
 * @swagger
 * /api/featurecomments/list:
 *   get:
 *     tags: [FeatureComments]
 *     summary: List threaded comments for a feature
 *     parameters:
 *       - { in: query, name: mission, required: true, schema: { type: string } }
 *       - { in: query, name: layer, required: true, schema: { type: string } }
 *       - { in: query, name: feature, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ status: 'success', total, threads: [ { ...comment, replies: [...] } ] }"
 */
router.get("/list", async (req, res) => {
  const q = req.query || {};
  const err = requireStrings(q, ["mission", "layer", "feature"]);
  if (err) return res.send({ status: "failure", message: err });

  try {
    const rows = await FeatureComments.findAll({
      where: { mission: q.mission, layer: q.layer, feature: q.feature },
      order: [["createdAt", "ASC"]],
      raw: true,
    });
    res.send({ status: "success", total: rows.length, threads: buildThreads(rows) });
  } catch (e) {
    logger("error", "Failed to list feature comments.", req.originalUrl, req, e);
    res.send({ status: "failure", message: "Failed to list comments." });
  }
});

/**
 * @swagger
 * /api/featurecomments/counts:
 *   get:
 *     tags: [FeatureComments]
 *     summary: Comment counts per feature for a layer (for badges)
 *     parameters:
 *       - { in: query, name: mission, required: true, schema: { type: string } }
 *       - { in: query, name: layer, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ status: 'success', counts: { <feature>: <number> } }"
 */
router.get("/counts", async (req, res) => {
  const q = req.query || {};
  const err = requireStrings(q, ["mission", "layer"]);
  if (err) return res.send({ status: "failure", message: err });

  try {
    const rows = await FeatureComments.findAll({
      attributes: ["feature", [Sequelize.fn("COUNT", Sequelize.col("id")), "count"]],
      where: { mission: q.mission, layer: q.layer },
      group: ["feature"],
      raw: true,
    });
    const counts = {};
    rows.forEach((r) => (counts[r.feature] = parseInt(r.count)));
    res.send({ status: "success", counts });
  } catch (e) {
    logger("error", "Failed to count feature comments.", req.originalUrl, req, e);
    res.send({ status: "failure", message: "Failed to count comments." });
  }
});

/**
 * @swagger
 * /api/featurecomments/delete/{id}:
 *   delete:
 *     tags: [FeatureComments]
 *     summary: Delete a comment and its replies (own comment; admins may delete any)
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: "{ status: 'success', deleted: <number of rows removed> }"
 */
router.delete("/delete/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.send({ status: "failure", message: "Invalid id." });

  try {
    const comment = await FeatureComments.findOne({ where: { id } });
    if (!comment) return res.send({ status: "failure", message: "Comment not found." });
    if (comment.author !== req.user && !isAdmin(req))
      return res.send({ status: "failure", message: "Not permitted to delete this comment." });

    const deleted = await FeatureComments.destroy({
      where: { [Sequelize.Op.or]: [{ id }, { parent_id: id }] },
    });
    res.send({ status: "success", deleted });
  } catch (e) {
    logger("error", "Failed to delete feature comment.", req.originalUrl, req, e);
    res.send({ status: "failure", message: "Failed to delete comment." });
  }
});

module.exports = router;
