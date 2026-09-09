const router = require("./routes/featureComments");
const { up } = require("./models/featureComments");

let setup = {
  //Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/featurecomments",
      s.ensureUser(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  //Once the server starts
  onceStarted: (s) => {},
  //Once all tables sync
  onceSynced: (s) => {
    up();
  },
};

module.exports = setup;
