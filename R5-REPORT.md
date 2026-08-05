# R5 — Communication windows over a surface asset: plugin-system report

Branch `devin/r5-comms-1785952356` (pushed, no PR). Container `plugins/comms/` — all three families built.

## 1. What works vs. not

`npm run plugins -- validate` is clean (only the pre-existing `core/interactions/ChemistryUse` warning), `NODE_ENV=test npx eslint plugins/comms` clean, `npm run test:unit` 1060 passed, and 13 new `@unit` tests pass (`PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/comms`). **I never loaded it in a browser** — no mission configured, and I hit the 20-minute limit. So: the geometry, the time-clipping and the manifest contracts are tested; the actual drawing (`make` returning a Leaflet layerGroup), the interaction firing on a click, and `TimeControl.setTime` moving the clock are **unverified**. Treat "it renders" as unknown.

## 2. Files

- `layertypes/GroundTrack/` — `plugin.json` (`typeId: groundtrack`, `extends: vector`, `capabilities.time: true`, `defaultInteractions.click: ["comms:next_window"]`), `groundTrack.js` (`source.fetch`, clips to `ctx.time`, synthesizes an orbit when no url), `tests/groundTrack.spec.js`
- `layerattachments/VisibilityFootprint/` — `plugin.json` (`attachmentId: visibility_footprint`, `configPath: variables.layerAttachments.visibilityFootprint`), `visibilityFootprint.js` (`make`, `syncData`), `tests/…`
- `interactions/NextCommWindow/` — `plugin.json` (`comms:next_window`, `applicableLayerTypes: ["groundtrack"]`), `NextCommWindow.js`, `logic.js`, `tests/…`
- `shared/comms.js` — the geometry all three need; `README.md`

## 3. The seams — this is the finding

The documented channel for "the type knows a fact the attachment needs" is `capabilities.defaultAttachments` (layertypes README ~L482-505: *"The property holding a magnitude is a fact your type knows and the attachment does not"*). **It does not apply here**, because it only reaches attachments hosted on layers *of that type*. My footprint hangs off the **asset** layer (a plain vector lander layer); the altitude that sizes it belongs to the **track** layer. Nothing in any README covers a fact crossing between two *different layers*. What I invented: the host names the track layer, and the attachment reads that peer's config off `L_`:

```js
export function resolveAltitudeMeters(config, layersData) {
    const peer = config?.trackLayerName ? layersData?.[config.trackLayerName] : null
    return num(peer?.variables?.altitudeMeters ?? config?.altitudeMeters, 400000)
}
// make(): resolveAltitudeMeters(config, window.L_?.layers?.data)
```

That is a string layer *name* in config — exactly the fragile coupling `defaultAttachments` was introduced to kill, one level up. Note also I had to use `window.L_`: the attachment docs say to read `window.L` per call so the module stays Node-importable, and importing `@basics/Layers_/Layers_` would break the unit test the same docs ask for. So the peer read is doubly off-contract.

Same problem for the interaction: it must compute the *same* circle the attachment drew. It reads the attachment's own `configPath` subtree off the asset layer:

```js
const footprintCfg = L_.layers.data[assetLayerName]?.variables?.layerAttachments?.visibilityFootprint || {}
```

i.e. a string-literal copy of another plugin's `configPath` — the interactions README (L485) forbids exactly this shape for other *interactions* ("Never read another interaction's settings out of `ctx`") but is silent about attachments. The elevation mask therefore exists in two places (the attachment's config and the interaction's own optional override), and a third if the type ever gains one.

The one seam that *is* documented and worked cleanly: type → interaction, via `capabilities.defaultInteractions.click: ["comms:next_window"]`, plus `applicableLayerTypes: ["groundtrack"]` on the interaction. That one needed no invention.

## 4. Wanted to call/read another plugin and couldn't

Yes, three times: (a) the interaction wanted to ask the attachment "what radius did you draw?" — there is no way to call an attachment operation, and although the built attachment instance is on `L_.layers.attachments[host][id]` with my `_radius` on it, that is the *asset* layer's instance reached from a track-layer click, so I recomputed instead; (b) the attachment wanted the track layer's altitude (above); (c) all three needed the same math and there is no sanctioned place to put shared code — I made `shared/comms.js` and imported it with `../../shared/comms`, which no README mentions and which `validate` neither blesses nor complains about.

## 5. Silent failures

The scaffolded interaction manifest ships `applicableLayerTypes: ["vector","vectortile","query"]`. My type is `groundtrack`, which extends vector — had I left the default, the runner's `layerTypeChain` would have saved me, but if I'd written a standalone type the interaction would have been silently dropped with only a console warning. Separately: `npm run plugins -- activate` printed "No changes" after I renamed `interactionId` from the scaffold's `next:comm:window` to `comms:next_window` — the registry *was* correct when I checked `src/pre/interactions.js`, but the CLI's own next-steps text tells you to re-run `activate` after changing `interactionId`, and it reports nothing, so you cannot tell from the output whether it took.

## 6. Docs

(a) The `defaultAttachments` gap above — layertypes README L474-505 presents it as *the* answer to cross-family facts without saying it is same-layer only. (b) layerattachments README L374-377 says to avoid importing singletons so the module stays unit-testable, but gives no alternative for reading anything outside the host — the peer read has no sanctioned form. (c) Nothing anywhere on sharing code between plugins in one container. (d) The interactions README has no `ctx` field for "the attachments of some other layer", and `ctx.layerData` is only the clicked layer's.

## 7. Liked

The CLI scaffolds are genuinely good — `create layertype … --extends vector` produced a manifest and a surfaces-keyed module with correct comments, and the generated tests were the right *shape* (contract assertions + `unresolvedModules`), so I edited rather than wrote them. `extends: vector` meant the whole ground-track renderer was a 40-line `source.fetch`. `validate`'s cross-family checks (attachment id nobody provides, a type an attachment refuses) are the right idea. And the pure-`logic.js` split for interactions is a convention worth keeping — it is the only reason I have unit tests at all.

## 8. Recommendations, ranked

1. Make a cross-*layer* fact channel. Either let an attachment/interaction declare a config row of type `layer` (a picker returning a layer reference core resolves, not a name string), or give `ctx` a resolved `ctx.peer[<role>]` from such a row. Today every multi-layer feature degenerates to hardcoded layer names.
2. Let one plugin ask another for a derived value — e.g. an attachment may export a pure `describe(config, env)` that core exposes as `ctx.attachments[attachmentId].describe(...)`. My footprint radius is computed twice by two plugins from two copies of the same setting; that will drift.
3. Bless a `shared/` (or `lib/`) directory per container in `plugins/README.md`, with a webpack alias, and have `validate` check its imports. Multi-family features always have shared math and everyone will invent their own layout.

One caveat: `plugins -- create` wrote `src/pre/*.js` registry files; those are gitignored, so only `plugins/comms/` is on the branch (added with `git add -f`). No core files were modified.
