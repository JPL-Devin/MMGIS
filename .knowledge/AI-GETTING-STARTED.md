# AI Getting Started Guide

A comprehensive guide for AI coding agents (Devin, Copilot Workspace, Cursor, etc.) to quickly set up and navigate the MMGIS codebase.

---

## 1. Quick Start (non-Docker, development mode)

### Prerequisites

- **Node.js >= 22**
- **PostgreSQL 16+** with the **PostGIS** extension enabled

### Steps

```bash
# 1. Copy the environment template and configure your database credentials
cp sample.env .env
# Edit .env — at minimum set DB_NAME, DB_USER, DB_PASS to match your PostgreSQL instance

# 2. Install main application dependencies
npm install

# 3. Build the configure sub-app (separate React app for the /configure admin page)
cd configure && npm install && npm run build && cd ..

# 4. Initialize the database (creates the database, enables PostGIS, creates session table)
node scripts/init-db.js

# 5. Start the server in development mode
npm start
# Or explicitly:
# PORT=8888 AUTH=none NODE_ENV=development node scripts/server.js
```

---

## 2. Port Map

| Port | Service                                                  | Notes                                                        |
| ---- | -------------------------------------------------------- | ------------------------------------------------------------ |
| 8888 | Express API server, `/configure` admin UI, static assets | Always running                                               |
| 8889 | Webpack dev server (main React app)                      | Development mode only — **this is where you browse the app** |

> In development mode, `PORT+1` (8889) is used by webpack-dev-server for the main React front-end. The Express API on port 8888 still handles all API requests, and the dev server proxies to it automatically.

---

## 3. Key Commands

| Command               | Description                                                                           |
| --------------------- | ------------------------------------------------------------------------------------- |
| `npm start`           | Run `init-db` then start the server (development mode)                                |
| `npm run start:prod`  | Run `init-db` then start the server (production mode; requires `npm run build` first) |
| `npm run build`       | Build the main app for production                                                     |
| `npm test`            | Run Playwright tests (`playwright test`)                                              |
| `npm run test:unit`   | Run unit tests only                                                                   |
| `npm run test:e2e`    | Run E2E tests only                                                                    |
| `npm run test:headed` | Run Playwright tests in headed mode                                                   |
| `npm run test:debug`  | Run Playwright tests in debug mode                                                    |
| `npm run test:ui`     | Run Playwright tests with UI                                                          |
| `npm run test:report` | Show the Playwright test report                                                       |
| `npm run start:test`  | Start the server in test mode (`NODE_ENV=test PORT=8888`)                             |

---

## 4. Creating a Mission

- **Via UI (the normal path):** Navigate to `http://localhost:8888/configure`, create an admin account (the first user is automatically the Administrator), then click **"New Mission"**.
- **Reference Mission:** Check the **"Setup Reference Mission Demo"** checkbox when creating a new mission to prepopulate it with sample data. Pick a variant (Earth Default or Lunar South Pole) and click **Make Mission**. See [../blueprints/README.md](../blueprints/README.md).
- **Via API:** the same thing the UI does is `POST /api/configure/add` with `{ mission, setupReferenceMission: true, referenceMissionVariant }`. There is no CLI. It needs an admin session — see the auth note below — and the UI remains the supported path.
- **Tip:** If only one mission exists, the landing page auto-redirects to the map. Use `?forcelanding=true` in the URL to force the landing page to display.
- **Auth:** `/api/configure/*` requires an admin session **even when `AUTH=off`**. On a fresh database, start with `AUTH=local` and `POST /api/users/first_signup` — the first user becomes a Site Admin.

---

## 5. Architecture Overview

```
plugins/core/          -- nearly all features: tools/ backend/ components/
                          interactions/ layertypes/   (see ../plugins/AGENTS.md)
src/essence/           -- React + jQuery front-end
  Basics/              -- core GIS singletons: Layers_ (L_), Map_, Globe_, Viewer_, TimeControl_
  LandingPage/         -- mission selection landing page
src/design-system/     -- generic, reusable UI components
src/pre/               -- GENERATED plugin registries (gitignored — never hand-edit)
API/                   -- backend infrastructure: connection, logger, plugin discovery/validation
configure/             -- separate React CMS app (needs its own npm install + build)
scripts/server.js      -- main Express entrypoint
scripts/init-db.js     -- database initialization (creates DB, extensions, tables)
blueprints/            -- reference mission templates
sample.env             -- environment variable template (copy to .env)
adjacent-servers/      -- proxy logic for TiTiler, STAC, and OGC services
docs/pages/            -- user-facing documentation
```

Feature code goes in `plugins/`, not `API/` or `src/essence/`. See
[../plugins/AGENTS.md](../plugins/AGENTS.md).

---

## 6. Environment Variables

All options are documented in `sample.env`. The critical ones:

| Variable       | Description                                          | Default       |
| -------------- | ---------------------------------------------------- | ------------- |
| `DB_HOST`      | PostgreSQL host                                      | `localhost`   |
| `DB_PORT`      | PostgreSQL port                                      | `5432`        |
| `DB_NAME`      | Database name                                        | `name`        |
| `DB_USER`      | Database user                                        | `user`        |
| `DB_PASS`      | Database password                                    | `password`    |
| `PORT`         | Server port                                          | `8888`        |
| `AUTH`         | Authentication mode (`off`, `none`, `local`, `csso`) | `none`        |
| `NODE_ENV`     | Environment (`development` or `production`)          | `development` |
| `SECRET`       | Session secret                                       | `aSecretKey`  |
| `MAIN_MISSION` | Auto-load a specific mission (skips landing page)    | _(empty)_     |
| `HIDE_CONFIG`  | Disable the `/configure` page                        | `false`       |

---

## 7. Common Pitfalls

- **`configure/` is a separate app:** The `configure/` directory has its own `package.json`. You must run `npm install && npm run build` inside it separately, or the `/configure` admin page will not work.

- **`cross-env` availability:** Some npm scripts (e.g., `start:prod`) use `cross-env`, which is listed as a dependency but may cause issues in certain environments. As an alternative, set environment variables directly:

  ```bash
  PORT=8888 AUTH=none NODE_ENV=production node scripts/server.js
  ```

- **PostGIS extension required:** The PostGIS extension must be enabled in your PostgreSQL instance. The `init-db.js` script attempts to create it (`CREATE EXTENSION postgis;`), but the PostgreSQL instance must have PostGIS installed for this to succeed.

- **Session table created by `init-db.js`:** The session table is created by `init-db.js`, not by the server on first boot. Always run `node scripts/init-db.js` (or `npm start`, which runs it automatically) before starting the server directly with `node scripts/server.js`.

- **Dev mode uses port 8889:** In development mode, the main app is served on port **8889** (webpack-dev-server), NOT port 8888. Port 8888 is the Express API server. The dev server proxies API requests to 8888 automatically.

- **`.env` file is required:** The server silently uses defaults from `sample.env` values (e.g., `DB_NAME=name`, `DB_USER=user`) that won't match any real database. The `cp sample.env .env` step is easy to miss.

- **A new plugin won't show up until its registry is regenerated:** `npm run plugins -- activate`
  covers tools, components, and interactions; layer types are only regenerated on a server start or
  `npm run build`. `src/pre/*` is generated and gitignored — never hand-edit it.

- **`init-db.js` also creates extensions:** The script creates both the `postgis` and `btree_gist` extensions, along with the session table and spatial indexes. If the database or extensions already exist, it gracefully continues.

---

## 8. Testing

- **Playwright runs everything — there is no Jest.** `npm run test:unit` is
  `PLAYWRIGHT_TEST_UNIT_ONLY=true playwright test tests/unit`.
  ```bash
  npx playwright test
  ```
- Test files live in `tests/unit/`, `tests/e2e/`, and `tests/ci/`; plugin tests are colocated under
  `plugins/**/tests/` and run with `npm run test:plugins`.
- Tests run against `mmgis-test` / `mmgis-stac-test` only. The database safety rules in
  [../AGENTS.md](../AGENTS.md) apply.
- The accessibility test (`tests/e2e/accessibility/`) scans the landing page and map interface for WCAG 2.1 AA violations.
- Use `npm run test:headed` to see tests run in a visible browser, or `npm run test:debug` to step through tests interactively.

---

## 9. Database Safety

The database safety rules are non-negotiable and live in one place: **[../AGENTS.md](../AGENTS.md)**.
Read them before touching anything that issues SQL.
