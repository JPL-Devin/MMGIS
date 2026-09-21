---
name: mmgis-configure-runtime-testing
description: Run real Configure UI and mission-permission runtime checks with local authentication.
---

# MMGIS Configure runtime testing

## Setup

- Read the environment blueprint and AGENTS.md first. Use an existing dedicated test database (`mmgis-test`) and application APIs/UI for fixture data; do not manipulate data with SQL.
- Run the backend on 8888 and development map on 8889. Configure is a separate React build: run `npm run build` in `configure` when its build is absent or changed.
- Supply test database settings and `AUTH=local` through process environment; avoid changing a shared `.env`. Check for orphaned server children before restarting an occupied port.
- Use `/configure` for the admin login. The map root has a separate login presentation, not `/login`.

## Historical config checks

- Create a mission with distinguishable saved versions. From Configure → mission → Home, use the exact historical row's Preview, Download, and Set controls.
- Verify a real downloaded JSON file and its historical marker, not just a toast. Verify restore creates a new current version and latest reads match the restored content.
- Capture requests, console errors, and page errors when testing preview. Development Configure and map use different ports; a successful historical API response does not prove iframe rendering.
- Default frame policy can block preview. Local process-only `FRAME_SRC` / `FRAME_ANCESTORS` overrides may permit framing but cannot remove the browser same-origin restriction on `contentWindow.mmgisAPI`. Do not disable browser security to claim preview passes.

## Permission evidence

- Use separate SuperAdmin, mission-admin, restricted-viewer, and anonymous sessions. Ensure the mission admin manages one mission but can only view another.
- Use native UI for roles, downloads, and mission selectors. Run explicit API checks through same-origin browser fetch without extracting cookies.
- If development map navigation loops/reloads, capture the failed requests and screen, then isolate API checks on a stable backend API document. Do not equate API success with a working map.
- A guest under local auth may see the login gate rather than a landing list. Record that actual UI and independently check empty mission names and denied export.

## Devin Secrets Needed

- Existing test DB credentials through `DB_USER_TEST` / `DB_PASS_TEST` where available, or lead-approved process environment for the dedicated test DB.
- An existing local test SuperAdmin login if first-signup has already been used. Never put passwords into the skill or evidence files.
