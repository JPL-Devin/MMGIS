# Code Patterns & Orientation

Copy-paste-modify templates, plus a map of the tree. Rules live in [../AGENTS.md](../AGENTS.md);
plugin contracts live in [../plugins/AGENTS.md](../plugins/AGENTS.md).

## Orientation map

Only the directories you need to find your way. This is deliberately shallow — the authoritative
description of a subsystem is the README next to it.

```
MMGIS/
├── plugins/              # nearly all features (see plugins/AGENTS.md)
│   ├── plugin-cli.js
│   └── core/{tools,backend,components,interactions,layertypes}/
├── API/                  # backend infrastructure (NOT feature code)
│   ├── pluginDiscovery.js pluginValidation.js updateTools.js setups.js
│   ├── connection.js database.js logger.js websocket.js utils.js
│   └── templates/ public/
├── src/
│   ├── design-system/    # generic, reusable UI + theming
│   ├── essence/
│   │   ├── Basics/       # the singletons
│   │   │   ├── Layers_/  # L_ — split by concern: lifecycle/ render/ display/ data/
│   │   │   │              #   features/ registry/ interface/ hierarchy/ inspect/
│   │   │   │              #   commons/ capture/ Filtering/
│   │   │   ├── Map_/ Globe_/ Viewer_/ Formulae_/ TimeControl_/ UserInterface_/
│   │   │   ├── ToolController_/ ComponentController_/ InteractionRunner/
│   │   ├── LandingPage/ mmgisAPI/ services/ essence.js
│   └── pre/              # GENERATED plugin registries — gitignored, never hand-edit
├── configure/            # separate React admin app (own install + build)
├── scripts/              # server.js init-db.js build.js middleware.js
│                         #   resolve-plugin-deps.js
├── tests/                # Playwright: unit/ e2e/ ci/ pages/ fixtures/ helpers/
├── configuration/        # webpack config (incl. plugin aliases like @basics)
├── blueprints/           # reference mission templates
├── docs/pages/           # Jekyll user documentation
├── Missions/             # mission data at runtime
├── adjacent-servers/     # TiTiler, STAC, TiPG, Veloserver proxy configs
├── auxiliary/ private/ spice/   # GDAL tiling, Python raster scripts, SPICE kernels
├── .specify/ specs/      # spec-kit infra; specs/archive/ is historical only
└── AGENTS.md CLAUDE.md   # agent context (CLAUDE.md just imports AGENTS.md)
```

Key distinction: **`API/` is infrastructure, `plugins/core/backend/` is features.** A new endpoint
group goes in the latter.

## Express route handler

`plugins/core/backend/<Feature>/routes/<feature>.js`

```javascript
const express = require("express");
const router = express.Router();
const logger = require("../../../../../API/logger");
const Utils = require("../../../../../API/utils");

router.post("/get", function (req, res) {
  // Sanitize anything that reaches SQL or the filesystem
  const name = Utils.forceAlphaNumUnder(req.body.name);

  Model.findAll({ where: { name } })
    .then((rows) => res.send({ status: "success", body: { rows } }))
    .catch((err) => {
      logger("error", "Failed to get.", req.originalUrl, req, err);
      res.send({ status: "failure", message: "Failed to get." });
    });
});

module.exports = router;
```

## Backend plugin entry point

`plugins/core/backend/<Feature>/plugin.js` — mounts the router and runs migrations.

```javascript
const router = require("./routes/feature");

let setup = {
  // Once the app initializes
  onceInit: (s) => {
    s.app.use(
      s.ROOT_PATH + "/api/feature",
      s.ensureUser(),
      s.checkHeadersCodeInjection,
      s.setContentType,
      router
    );
  },
  // Once the server starts
  onceStarted: (s) => {},
  // Once all tables sync — run schema migrations here
  onceSynced: (s) => {
    require("./models/feature").up();
  },
};

module.exports = setup;
```

Pair it with a `plugin.json` declaring at least `name`, `type: "backend"`, and
`routes: { prefix, auth }`. Scaffold both with
`npm run plugins -- create backend Feature --container my-plugins`.

## Sequelize model + migration

`plugins/core/backend/<Feature>/models/<feature>.js`

```javascript
const Sequelize = require("sequelize");
const sequelize = require("../../../../../API/connection");

const Feature = sequelize.define(
  "features",
  {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    mission: { type: Sequelize.STRING, allowNull: false },
    props: { type: Sequelize.JSONB },
  },
  { timestamps: true, freezeTableName: true }
);

// sequelize.sync() runs WITHOUT alter:true, so it never adds columns to an
// existing table. Additive schema changes go here and are called from
// plugin.js -> onceSynced. Prefer awaiting it: unawaited up() calls race
// queries made immediately after startup.
Feature.up = async function () {
  await sequelize.query(
    `ALTER TABLE features ADD COLUMN IF NOT EXISTS props JSONB;`
  );
};

module.exports = Feature;
```

## Frontend tool plugin

`plugins/core/tools/<Name>/<Name>Tool.js` (scaffold with
`npm run plugins -- create tool Name --container my-plugins`). Import core through webpack aliases,
not deep relative paths.

```javascript
import $ from "jquery";
import F_ from "@basics/Formulae_/Formulae_";
import L_ from "@basics/Layers_/Layers_";
import Map_ from "@basics/Map_/Map_";

const markup = [`<div id="nameTool">`, `</div>`].join("\n");

const NameTool = {
  height: 0,
  width: 300,
  MMGISInterface: null,
  make: function () {
    this.MMGISInterface = new interfaceWithMMGIS();
  },
  destroy: function () {
    this.MMGISInterface.separateFromMMGIS();
  },
  getUrlString: function () {
    return "";
  },
};

function interfaceWithMMGIS() {
  this.separateFromMMGIS = function () {
    separateFromMMGIS();
  };

  const tools = $("#toolPanel");
  tools.css("background", "var(--color-k)");
  tools.empty();
  tools.html('<div style="height: 100%">' + markup + "</div>");

  // Bind event handlers here

  function separateFromMMGIS() {
    // Unbind everything bound above — destroy() must leave no listeners
  }
}

export default NameTool;
```

Its `plugin.json` needs `name`, `paths` (`{ "NameTool": "./NameTool" }`), and a `config` block if
admins should be able to configure it on the Configure page.

## Interaction plugin

`plugins/core/interactions/<Name>/<Name>.js` — one step of a feature click/hover pipeline.

```javascript
const FeatureGlow = {
  use(ctx) {
    if (!ctx.feature) return;
    // ctx: Map_, feature, layer, layerName, layerData, layerVar, event,
    //      eventType, additional, state (pass data downstream), stop (halt)
  },
};

export default FeatureGlow;
```

`plugin.json` declares `interactionId`, `phase` (`preamble`/`main`/`postamble`), `order`, and
optionally `suppresses` / `kindAlias`. See [../plugins/AGENTS.md](../plugins/AGENTS.md).

## Layer type renderer

`plugins/core/layertypes/<Type>/map/<type>.js`. Only `make` is required — core defaults cover the
rest. See [../plugins/core/layertypes/README.md](../plugins/core/layertypes/README.md) for the full
contract.

```javascript
import L_ from "@basics/Layers_/Layers_";
import MapRenderer from "@basics/Map_/MapRenderer";

function make(layerObj, ctx = {}) {
  const mctx = MapRenderer.context(ctx.mapContext);
  // Build the layer with neutral primitives (MapRenderer.addTile/addVector),
  // dropping to mctx.raw only for engine-specific work. Assign it to
  // L_.layers.layer[layerObj.name], then mark it loaded.
  L_._layersLoaded[L_._layersOrdered.indexOf(layerObj.name)] = true;
  L_.Map_.allLayersLoaded();
}

export default { make };
```

## WebSocket message handler

`API/websocket.js`

```javascript
ws.on("message", function (message) {
  try {
    const msg = JSON.parse(message);

    if (!msg.type || !msg.room) {
      return ws.send(JSON.stringify({ error: "Invalid message format" }));
    }
    if (!isAuthenticated(ws.userId)) {
      return ws.send(JSON.stringify({ error: "Unauthorized" }));
    }

    switch (msg.type) {
      case "draw":
        broadcastToRoom(msg.room, msg, ws);
        break;
      default:
        ws.send(JSON.stringify({ error: "Unknown message type" }));
    }
  } catch (err) {
    ws.send(JSON.stringify({ error: "Invalid JSON" }));
  }
});
```

Requires `ENABLE_MMGIS_WEBSOCKETS=true`.
