/**
 * GeodatasetExport — backend plugin lifecycle.
 *
 * Reads are public (allowGets) so the app and scripts can download exports the
 * same way /api/geodatasets/get is reachable; there are no write routes.
 */
const router = require("./routes/geodatasetExport");

let setup = {
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/geodatasetExport",
      s.ensureAdmin(false, false, true),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  onceStarted: (s) => {},
  onceSynced: (s) => {},
};

module.exports = setup;
