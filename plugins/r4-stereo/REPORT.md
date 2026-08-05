# r4-stereo — testing MMGIS's plugin system as a third-party author

Branch: `devin/r4-stereo-1785892984` on JPL-Devin/MMGIS. Container force-added at
`plugins/r4-stereo/`. No PR opened.

## 1. What I built / what actually works

Three cooperating plugins for "what else covers this spot from a different angle?":

- **layertype `ImageFootprints`** (`typeId: imagefootprints`, `extends: vector`) — draws like vector, so the only surface it implements is `config.normalize`, which defaults the viewing-geometry property names and declares `capabilities.defaultInteractions.click: ["stereo:pairs"]`.
- **layerattachment `LookDirection`** (`attachmentId: look_direction`) — a wedge (half-angle grows with emission angle) or a bearing line from each footprint's centroid along its sub-spacecraft azimuth. Implements `make` + `syncData`.
- **interaction `StereoPairs`** (`stereo:pairs`, phase `main`) — on click, indexes the host layer's footprints, keeps the ones whose bbox overlaps the clicked one and whose convergence angle (`cos c = cos e₁cos e₂ + sin e₁sin e₂cos Δaz`) is in range with comparable emission/illumination, and adds a highlight `L.geoJson` overlay + writes the result to `ctx.state.stereoPairs`.

**Verified:** `npm run plugins -- validate` green; 14 new plugin unit tests pass (`npm run test:plugins:unit`), including the real convergence math, the overlap filter and the attachment→interaction handoff; core `npm run test:unit` 1041/1041 pass; prettier clean; eslint clean apart from two `import/no-anonymous-default-export` warnings that the scaffolds' own style produces.

**Untested — be blunt:** I never saw any of it in a browser. No mission with footprint data exists on this box and standing one up (postgres, configure build, admin signup, mission + layer + attachment config) does not fit the 20 minutes. So: nothing is known about whether the wedges render at the right scale, whether `defaultInteractions` actually fires my interaction on a real click, or whether the highlight ends up under the host layer. Treat all rendering/wiring as unverified.

## 2. Files

```
plugins/r4-stereo/layertypes/ImageFootprints/{plugin.json,imageFootprints.js,tests/imageFootprints.spec.js}
plugins/r4-stereo/layerattachments/LookDirection/{plugin.json,lookDirection.js,stereoGeometry.js,tests/lookDirection.spec.js}
plugins/r4-stereo/interactions/StereoPairs/{plugin.json,StereoPairs.js,tests/stereoPairs.spec.js}
```
(`map.js` from the layertype scaffold deleted — the type extends vector.)

## 3. The seams (the interesting part)

- **layertype → interaction** is the one real declarative link: `capabilities.defaultInteractions.click: ["stereo:pairs"]`. It is a bare id string; I saw no cross-check that the named interaction exists or is enabled, and nothing in the docs says what happens if it doesn't.
- **layertype → attachment: no link exists at all.** The dependency only runs the other way — the *attachment* lists `applicableLayerTypes: ["imagefootprints", …]`, so a layertype cannot say "I come with this attachment", and the attachment author must know my `typeId`. A feature that is 3 plugins is therefore *not* installable as a feature: an admin must separately pick the type, choose the interaction (or rely on the type default) and fill in the attachment's `configPath` in a Markers tab.
- **attachment → interaction: no channel.** `ctx.config` is scoped to the reading plugin ("Never read another interaction's settings out of `ctx`"), and `ctx.state` only lives for one event. So the attachment publishes its parsed index as an extra key on the object it returns from `make` (docs guarantee extra keys survive verbatim) and the interaction reads `window.L_.layers.attachments[layerName].look_direction._stereoIndex` — reaching into core's registry with the sublayer key hardcoded as a string literal. It works, and it's ugly: there is no `getAttachment(layerName, attachmentId)` for plugins, and `peerFeaturesFor` is core-dispatched and cross-layer, so it's not usable here. **Yes, the attachment can tell the interaction what it computed — but only through a private-looking key on a global.**
- **…and I still had to be able to recompute it.** The attachment is optional, so the interaction must work without it. Both need the same math, and there is no documented home for code shared between two plugins in one container: no `@plugins` alias (plugins/README.md "Webpack Aliases" lists five, none for plugins, and calls relative paths "fragile"), no container-level `lib/`. I put `stereoGeometry.js` beside the attachment and import it from the interaction as `../../layerattachments/LookDirection/stereoGeometry.js`. That's a hard cross-plugin coupling the plugin system has no opinion about.
- **Config is triplicated by design.** Each family owns its own subtree, so the emission/incidence/azimuth property names would have to be typed three times. I invented a workaround: the layertype's `config.normalize` writes `variables.stereo` and mirrors it into `variables.layerAttachments.lookDirection` and `variables.interactions.stereoPairs` when blank. Nothing in the docs suggests this; it also implies a layertype could *enable* an attachment by creating its `configPath` subtree (presence = enabled), which feels like an undocumented backdoor.
- **Core source I had to read:** how to get the host layer's features from an interaction is documented nowhere — I read `plugins/core/interactions/InfoOpen/FeatureGatherer.js` to learn `L_.layers.layer[name]` may be a layer, an array of layers, or need `eachLayer`. Also `Layers_.js:369` (`window.L_ = L_`) and `Layers_/display/sublayers.js` for the attachment storage shape.
- **Where I wanted one plugin to call another and couldn't:** the interaction wanted to ask the attachment "give me the look geometry for this layer" (and, ideally, "flash the partners' wedges"). There is no plugin-facing way to invoke an operation on another plugin; the only options were the global registry read and duplicating the math.

## 4. Failed silently

- I changed the layertype from `map.js` to `extends` + one `module` and deleted `map.js`. `src/pre/layertypes.js` kept a static import of the deleted file, and **`plugins -- validate` still reported "All 61 plugin(s) valid"** — that stale import would break the webpack build. `plugins -- activate` fixed it. (plugins/README.md:341 warns this bites on the second change; validate does detect the *opposite* case — a plugin added without activate — so it looks like a one-sided check.)
- `syncData` is handed `geojson`/`onlyClear` but **not `config`**, so a derived attachment must stash its own settings in `make` (`_config`) or silently re-render with defaults. Nothing warns.
- `make` returning `false` because no feature had usable angles is indistinguishable, from the UI, from the attachment not being configured — an admin with a typo'd property name gets nothing and no message.

## 5. Docs: confusing / contradictory

- `plugins/core/interactions/README.md:65-67` says import singletons by alias so the module "still loads in a unit test", but `:129-134` admits an alias import fails in Node — and the scaffolded spec imports the module. Both cannot hold. I used `window.L_` per call, which the layertypes README (`:416-420`) explicitly discourages.
- `plugins/core/layerattachments/README.md:162-170`: the per-operation ctx additions are prose; the missing `config` on `syncData` deserves to be called out (see above).
- `plugins/core/layertypes/README.md:424-444` (`defaultInteractions`): doesn't say whether ids are validated, what happens when the named interaction is disabled, or how it interacts with the layer's `kind` when the type has no kind at all.
- Nothing anywhere about sharing code between plugins, which any multi-family feature needs.

## 6. What I liked

- `extends: "vector"` is excellent: my "layertype" collapsed to a 40-line `config` surface and inherited drawing, picking, filtering and both globes.
- Attachment `make` returning an object that core stores verbatim and hands back to every op — stashing state there is obvious and it's the only reason the cross-family handoff was possible at all.
- Scaffolds are real files with the whole operation vocabulary commented, with the default each op replaces. Module-level static validation (rejecting unknown op names) is the right instinct.
- The pure-function testability advice pays off immediately: the real geometry is unit tested in Node in seconds.

## 7. Top 3 recommendations

1. **A plugin-facing bus for cross-family state.** Something like `LayerAttachmentRegistry.instance(layerName, attachmentId)` (or `ctx.attachments` on interaction ctx, and `ctx.interactions`), documented as the supported channel, so an interaction can consume what an attachment computed without literal registry keys — plus a resolved shared-code story (a `@plugins` alias, or a declared container `lib/`).
2. **Let a feature be declared as a set.** Allow a layertype to declare the attachments it comes with and their default config (as it can already declare `defaultInteractions`), and let the three families share one config subtree (or declare "reads `variables.stereo`"), so a mission author enables one thing and the property names are typed once.
3. **Make `validate` cover the generated registries.** It caught neither the stale import of a deleted module nor (apparently) an unknown `defaultInteractions` id; a `validate` that diffs `src/pre/*.js` against the manifests, and warns on interaction ids/typeIds nobody provides, would convert both of my silent failures into messages.
