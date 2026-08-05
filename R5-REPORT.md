# R5 — Ground station coverage: authoring a multi-family MMGIS plugin feature

Branch `devin/r5-dsn-1785952363` (pushed, no PR). Zero core changes.

## 1. What I built / what actually works

Container `plugins/dsn-coverage/` (one container, three families + a shared lib):

- **layertype `GroundStation`** (`typeId: groundstation`, `extends: vector`) — `config.normalize` defaults the property names for antenna diameter, mask elevation and band onto `variables.groundStation`; declares `capabilities.defaultAttachments.horizon_mask` (with those property names + `scale`/`altitudeKm`) and `capabilities.defaultInteractions.click: ["dsn:handover"]`.
- **layerattachment `HorizonMask`** (`applicableLayerTypes: ["groundstation"]`) — one Leaflet `circle` per station, radius computed from that station's own mask elevation/diameter times the settings scale, plus a LithoSphere `clamped` polygon surface for the globe. Implements `make`, `syncData`, `setVisibility`, `onConfigChange`.
- **interaction `Handover`** (`dsn:handover`) — on click, computes which other stations' coverage circles overlap the clicked one (optionally band-matched) and shows it via `CursorInfo`.
- **`lib/coverage.js`** — the mask-radius/haversine/overlap math all three share.

**Honest status:** `npm run plugins -- validate` is clean, `activate` put all three in `src/pre/{layertypes,layerattachments,interactions}.js`, 13 new `@unit` tests pass, the repo's 1060 unit tests pass, `NODE_ENV=test npx eslint plugins/dsn-coverage` is clean. **I never saw it in a browser** — no mission with a `groundstation` layer was configured, no map, no globe. So: the math, the manifest wiring and the registry generation are verified; the rendering, the globe path and the click handler are *not*. The globe half in particular is written by analogy to `UncertaintyEllipses` and is entirely unexercised.

## 2. Files

```
plugins/dsn-coverage/lib/coverage.js
plugins/dsn-coverage/layertypes/GroundStation/{plugin.json,groundStation.js,tests/groundStation.spec.js}
plugins/dsn-coverage/layerattachments/HorizonMask/{plugin.json,horizonMask.js,tests/horizonMask.spec.js}
plugins/dsn-coverage/interactions/Handover/{plugin.json,Handover.js,logic.js,tests/handover.spec.js}
```

## 3. The seams

**type → attachment (property names + size).** Declarative, exactly as documented (`plugins/README.md:373-385`, `core/layertypes/README.md:475-508`):

```json
"defaultAttachments": { "horizon_mask": {
  "diameterProp": "antenna_diameter_m", "maskElevationProp": "mask_elevation_deg",
  "bandProp": "band", "nameProp": "name", "scale": 1, "altitudeKm": 700 } }
```

The attachment just reads `ctx.config` and never knows the type exists. This is the best part of the system — it is the one seam that felt designed rather than worked around.

**type → interaction (which interaction runs).** `capabilities.defaultInteractions.click: ["dsn:handover"]`. Documented, worked.

**type → interaction (property names).** *Not covered by any equivalent mechanism, and this is the real gap.* `defaultAttachments` carries settings; `defaultInteractions` carries only ids. So the interaction cannot be handed `diameterProp` the way the attachment can. What I did: the type writes the names onto the layer in `config.normalize`, and the handler reads `ctx.layerVar?.groundStation` — the layer type's own subtree:

```js
handoversFor(ctx.feature, stationsGeoJSON(ctx.layerName), ctx.config, ctx.layerVar?.groundStation || {})
```

**I invented that.** Nothing in the docs suggests a type should normalize a settings block for its siblings to read; the docs' `configPath` advice ("a plugin owns its subtree and should not write another's") arguably forbids the reverse but is silent on this. It also means the interaction's own `scale`/`altitudeKm` settings must be kept in sync with the attachment's by hand — the admin types the scale twice and nothing warns if they disagree. I flagged that in the field description, which is not a solution.

**interaction → attachment (the other stations).** The interaction needs the whole layer's features, and `ctx` gives it only the clicked one. I read what the attachment left behind, which the docs do bless (`plugins/README.md:371`): `L_.layers.attachments[uuid].horizon_mask.geojson`, hardcoding the sibling's `attachmentId` string, with a `L_.layers.layer[name].toGeoJSON()` fallback for when the attachment is off.

## 4. Where I wanted to call another plugin and couldn't

- I wanted to ask HorizonMask "what radius did you draw for this station?" so the click answer and the drawn rings can never disagree. There is no way to call an attachment operation and no registry lookup by `attachmentId` (`plugins/README.md:387`). **Instead** I duplicated the computation: both call `maskRadiusMeters` in `lib/coverage.js`. That works *because* they are in one container — a third-party interaction over someone else's layer type could not do it at all.
- I wanted the interaction to receive settings from the layer type. Couldn't (see above); used the type's normalized subtree.
- The docs say "two plugins that must run in a fixed order are one plugin" — but a layer type, an attachment and an interaction of one feature *cannot* be one plugin, since the families are separate. The rule doesn't have an answer for this shape.

## 5. Silent failures I hit or nearly hit

- `plugins -- activate` printed **"No changes."** after I rewrote all three manifests (new `typeId` behaviour, `defaultAttachments`, new `interactionId` `dsn:handover`). It had in fact regenerated correctly — I only found that out by grepping `src/pre/`. A no-op-looking message after a real change is exactly the thing that makes you stop trusting the command.
- `create interaction Handover` derived `interactionId: "handover"`, not the namespaced `dsn:handover` the docs use everywhere. If I had left it, it would have silently collided in a namespace-free key space.
- The scaffolded attachment/layertype tests import the module for real. Core's own `UncertaintyEllipses` imports `L_` and `F_` by alias — the documented way to reach singletons — but that makes the module **un-importable in the scaffolded test**. I used `window.L_?.Globe_?.litho` instead, contradicting the layertype README's explicit "reach it with `import L_` … rather than `window.L_`" (`core/layertypes/README.md:444-447`). One of the two pieces of advice has to give, and nothing says which.
- `defaultAttachments` settings never appear in the Configure form (documented at `plugins/README.md:385` as "empty means as the type declared"). Green everywhere; an admin looking at empty fields has no way to see the effective values.

## 6. Docs: confusing / missing / contradictory

- `core/layertypes/README.md:534-535` — `defaultInteractions` takes ids only while `defaultAttachments` takes settings, with no explanation of the asymmetry and no alternative for an interaction that needs a fact from its type. This is the single biggest documentation hole for a multi-family feature.
- `core/layertypes/README.md:444-447` vs `core/layerattachments/README.md:340-342` — "import `L_` by alias, not `window.L_`" vs "read the global per call so the module is importable in a unit test". For an attachment that touches `L_.Globe_.litho`, these are mutually exclusive.
- `plugins/README.md:387` "a plugin that needs another's work should read what it left behind" — but the only address is a hardcoded `attachmentId` string, which is the very brittleness `defaultAttachments` was introduced to remove (`core/layertypes/README.md:494-499`).
- `plugins/README.md:349-361` ("One feature, several plugins") shows exactly my shape — layertype + attachment + interaction + `lib/` — and then never says how the interaction gets its settings. That section is where the answer belongs.
- Minor: `plugins/README.md:333` says `git add -f` is "the exception", while the task's own instructions require it; not wrong, just worth noting for anyone told to share WIP.

## 7. What I liked

- `create <type> --extends vector` producing a manifest, a surface-keyed module, and a *tagged, already-passing* unit test that checks the manifest contract — I deleted almost none of it.
- `extends: vector` genuinely made the layer type ~10 lines. I wrote no renderer at all and still get picking, styling, filtering and both globes.
- `defaultAttachments` carrying settings, and the field-by-field override on top. It solves a real problem and it solved mine.
- `validate` cross-checking `applicableLayerTypes`/`defaultAttachments` ids between families — it caught things a manifest schema check wouldn't.
- The family READMEs are written against the exact scaffold you're handed, so reading and doing line up.

## 8. Top 3 recommendations

1. **Let `defaultInteractions` carry settings, like `defaultAttachments` does.** `{"click": {"dsn:handover": {"maskElevationProp": "mask_elevation_deg", "scale": 1}}}`, merged under the layer's own `variables.interactions.<x>` before the runner reads it. This removes the one seam I had to invent, and removes the duplicated `scale` an admin can currently set to two different values.
2. **Give a container a shared settings subtree** — one block the type declares once (`variables.<container>` or an explicit `featureConfig`) that every family in that container receives on its `ctx` alongside its own `config`. Today the *only* way for three plugins to agree on a fact is either a manifest-level per-family push or a private convention like the one I invented.
3. **Make cross-family reads addressable rather than string-typed.** If reading an attachment's left-behind object is the sanctioned path, give it an accessor (`ctx.attachments?.horizon_mask`, or `L_.getAttachment(layerName, id)`) and have `validate` check the id — the current `L_.layers.attachments[L_.asLayerUUID(name)].horizon_mask` is three pieces of core-internal knowledge in one expression and will break silently.

Runner-up: make `activate` say what it regenerated instead of "No changes." when manifests changed.
