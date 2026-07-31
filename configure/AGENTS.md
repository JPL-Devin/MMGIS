# AGENTS.md — `configure/`

This is the Configure page (the admin CMS served at `/configure`) — a **separate React application**
with its own `package.json`, dependencies, and build. It is not part of the main app's bundle and does
not hot-reload with it.

- **It must be built before `/configure` works:** `cd configure && npm install && npm run build`.
  A blank or splash-only `/configure` almost always means this step was skipped.
- **It is served from port 8888 (the Express server), not 8889.** The dev server on 8889 only serves
  the main app. After changing anything here, rebuild and reload 8888.
- **`/api/configure/*` requires an admin session even when `AUTH=off`.** Read-only exceptions are
  `/api/configure/get`, `/api/configure/missions`, `/api/geodatasets/get`, `/api/geodatasets/search`.
  To get an admin on a fresh database, start the server with `AUTH=local` and
  `POST /api/users/first_signup` — the first user becomes a Site Admin.
- **Do not write raw SQL to create or change missions or layers.** Use this UI or the API.
- **The layer configuration UI is generated, not hand-written.** A layer type's form comes from that
  plugin's `metaconfig.json` (`plugins/core/layertypes/<Type>/metaconfig.json`) and a tool's fields
  come from the `config` block in its `plugin.json`. To change what admins can configure for a layer
  type, edit that plugin's metaconfig — not this app.
- E2E coverage: `npm run test:e2e:configure`.

See [../AGENTS.md](../AGENTS.md) for project-wide rules and
[../plugins/AGENTS.md](../plugins/AGENTS.md) for the plugin contracts behind the generated forms.
