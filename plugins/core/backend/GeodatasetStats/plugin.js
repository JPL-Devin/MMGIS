const router = require("./routes/geodatasetStats");

let setup = {
  // Mount the read-only stats router. Reuses the same admin gate and
  // header/content-type middleware as the core Geodatasets module so the
  // contract matches the rest of the geodataset API surface.
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/geodatasetstats",
      s.ensureAdmin(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  onceStarted: (s) => {},
  onceSynced: (s) => {},
};

module.exports = setup;
