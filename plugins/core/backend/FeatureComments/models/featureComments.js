const Sequelize = require("sequelize");
const { sequelize } = require("../../../../../API/connection");
const logger = require("../../../../../API/logger");

const attributes = {
  mission: { type: Sequelize.STRING, allowNull: false },
  layer: { type: Sequelize.STRING, allowNull: false },
  feature: { type: Sequelize.STRING, allowNull: false },
  author: { type: Sequelize.STRING, allowNull: false },
  body: { type: Sequelize.TEXT, allowNull: false },
  parent_id: { type: Sequelize.INTEGER, allowNull: true },
};

const FeatureComments = sequelize.define("feature_comments", attributes, {
  timestamps: true,
  indexes: [{ fields: ["mission", "layer", "feature"] }],
});

/** Idempotent schema migrations for existing installs. */
const up = async () => {
  await sequelize
    .query(
      `ALTER TABLE feature_comments ADD COLUMN IF NOT EXISTS parent_id integer NULL;`
    )
    .catch((err) => {
      logger(
        "error",
        "Failed to migrate feature_comments. DB tables may be out of sync!",
        "feature_comments",
        null,
        err
      );
    });
};

module.exports = { FeatureComments, up };
