# Rover Traverse — plugin-system field report

Branch: `devin/r4-traverse-1785892982` (off `devin/1785790516-finalize-layertype-plugins`). No PR.
Container: `plugins/traverse/` (gitignored on purpose; committed with `git add -f`).

Status: all three families built, `validate` clean (61 valid), 13 `@unit` tests pass, eslint clean. **Not seen in a browser** — see #1.

## 1. What I built / what actually works

One feature, three cooperating plugins in the `traverse/` container:

- **layertype `RoverTraverse`** (`typeId: "traverse"`, `extends: "vector"`). One `config` module (`traverse.js`) whose `normalize` fills `variables.traverse` prop-names (sol/site/drive/order) and pre-enables the attachment; `capabilities.defaultInteractions.click = ["traverse:step"]` wires the click behaviour.
- **layerattachment `WaypointSol`** (sublayer). `make` builds a `layerGroup` of a `sol N` divIcon per waypoint + a bearing arrow (rotated glyph) at each segment midpoint, ordered by `orderProp`. `syncData` rebuilds.
- **interaction `TraverseStep`** (`traverse:step`, main/click). Orders the layer's point sublayers, anchors on the clicked/active feature, `setActiveFeature` on next (prev with shift or `direction:"previous"`), pans the map. Pure `stepIndex` split into its own file.

Verified: `validate`, module resolution, generated `src/pre/{interactions,layertypes,layerattachments}.js` all include them, and unit tests of the pure logic (ordering, bearing, stepping, normalize defaults/opt-out). **Untested: the actual on-map render, selection, and pan** — I did not stand up Postgres + Configure + a mission with a traverse layer in the time box, so "it draws / it walks" is unproven. Arrow/label divIcons may also need CSS to not show Leaflet's default white box (cosmetic).

## 2. Files

(see branch)

- `layertypes/RoverTraverse/{plugin.json, traverse.js, tests/roverTraverse.spec.js}`
- `layerattachments/WaypointSol/{plugin.json, waypointSol.js, tests/waypointSol.spec.js}`
- `interactions/TraverseStep/{plugin.json, TraverseStep.js, stepIndex.js, tests/traverseStep.spec.js}`

## 3. The seams between families — how they find each other & share state

- **layertype→interaction:** clean, declarative. `capabilities.defaultInteractions` (documented in layertypes README) is the intended handshake; no code.
- **layertype→attachment:** I had to *invent* the wiring. There is no "this type turns on that attachment" mechanism, so the layertype's `config.normalize` writes `variables.layerAttachments.waypointSol = { enabled:true }` by string path. That works because "the key's presence is the request," but it couples the layertype to the attachment's `configPath` by hand.
- **shared config:** the attachment and interaction both need the sol/order property names. Nothing passes config *between* plugins, so both independently read `layerObj.variables.traverse` (attachment via `ctx.layerObj`, interaction via `ctx.layerVar`) — a subtree the layertype owns. That's the only shared-state channel: the layer config object. `ctx.config`/`ctx.state` are per-plugin/per-event and don't cross families.
- **ordering duplicated:** both the attachment and the interaction sort waypoints by `orderProp`, with the same tie-break — copied in two files because there's no shared helper reachable from a gitignored plugin.
- **Wanted one plugin to call another, couldn't:** the interaction can't ask the attachment "which waypoint is index N / give me its marker"; it re-derives order from the raw Leaflet group. I read core source (`Layers_.js` `setActiveFeature`, `Map_.map.panTo`, `L_.layers.layer[name]`) to learn the runtime shape — none of that is in the family READMEs.

## 4. Failed silently

- Nothing silently broke *yet*, but the whole design has the documented trap: `validate` is green and every registry lists the plugins, which proves nothing about behaviour. The layertype→attachment auto-enable in particular would fail invisibly if the attachment's `configPath` ever changed — no validation links them.

## 5. Docs — confusing / missing / contradictory

- The layertype `create` scaffold hardcodes `typeId` to the lowercased name (`rovertraverse`) and generates a standalone `map.js`; for the "extends vector" case (the README's own recommended path, `plugins/core/layertypes/README.md:94-98`) you must delete `map.js`, swap `modules`→`module`, and fix `typeId` — the scaffold actively fights the common case.
- The scaffolded layertype **unit test** (`tests/roverTraverse.spec.js`) asserts `manifest.capabilities.renderers.map` — but an `extends` type declares no `renderers`, so the generated test throws until rewritten. Scaffold + its own test disagree with the extends guidance.
- No doc anywhere on how one plugin should enable/co-configure another (the layertype↔attachment seam). `plugins/core/layerattachments/README.md:80-85` says "never read the host's config directly," which is clear for the attachment's *own* subtree, but silent on reading a *sibling* config like `variables.traverse`.
- Minor: `plugins/core/interactions/README.md:129-134` says a module importing `L_` "fails on the first alias" in Node — correct, but the scaffolded interaction test imports the module and calls `use()`, which would break the moment you add `import L_`. Had to move logic to a pure file.

## 6. What I liked

- `extends` + a single `config` module made a real new layer type ~40 lines with full vector rendering/picking/time inherited — genuinely good.
- `defaultInteractions` as a declarative click wiring is elegant; the interaction pipeline (preamble select → main traverse:step) composed exactly as documented.
- The pure-function testing story (`stepIndex.js`, exported `orderWaypoints`/`bearing`) + `plugin-contract.js` helpers made unit tests fast and honest.
- READMEs are unusually candid ("validate passes is not it works").

## 7. Top 3 recommendations (ranked)

1. **A declarative way for a layertype to require/enable companion plugins** (e.g. `defaultAttachments`/`requires` in the manifest, resolved by core), so a multi-family feature doesn't rely on a layertype hand-writing another plugin's `configPath`.
2. **A small shared-state/lookup channel across families** — e.g. expose an ordered-features/active-index helper (or let the attachment publish an index the interaction can read) so families stop each re-deriving order and reading raw Leaflet/core internals.
3. **Fix the layertype scaffold + its test for the `extends` path** (offer `create layertype --extends vector`, emit `module` not `map.js`, and a test that doesn't assume `renderers`), and add a short "authoring a multi-family feature" section documenting the config object as the sanctioned cross-plugin channel.
