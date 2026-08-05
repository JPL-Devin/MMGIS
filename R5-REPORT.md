# Third-party plugin author report — `wind-field` container

Branch: `devin/r5-bundle-1785952417` (JPL-Devin/MMGIS, off `devin/1785790516-finalize-layertype-plugins`). No PR. No core files modified.

## 1. What I built, and what actually works

**Feature: Wind Field** — surface wind observations. Three plugins in one container:

| plugin | files | what it does |
|---|---|---|
| `wind-field/layertypes/WindField` (`typeId: windfield`, `extends: vector`) | `plugin.json`, `windField.js`, `tests/windField.spec.js` | `source.fetch` pulls a GeoJSON feed and normalizes whatever the service calls speed/direction onto `windSpeed` / `windDirection` / `windCategory`; `legend.derive` emits a 5-entry `styleMatching` category legend |
| `wind-field/layerattachments/WindBarbs` (`attachmentId: wind_barbs`) | `plugin.json`, `windBarbs.js`, `tests/windBarbs.spec.js` | a barb polyline per point feature, pointing downwind, length ∝ speed, coloured by category; `syncData` + `onConfigChange` overridden |
| `wind-field/interactions/WindReport` (`interactionId: wind:report`) | `plugin.json`, `WindReport.js`, `logic.js`, `tests/windReport.spec.js` | click → Leaflet popup "14.0 m/s from E (strong)"; leaves the report on `ctx.state.windReport` |
| shared | `lib/wind.js` | pure maths: `barbLine`, `speedCategory`, `CATEGORY_COLORS`, `compass`, `report` |

**Verified:** `npm run plugins -- validate` (61 valid, only the pre-existing ChemistryUse warning); 14 `@unit` tests pass (`PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/wind-field`); `NODE_ENV=test npx eslint plugins/wind-field` clean; uninstall + reinstall from a local path (`install ~/wind-field --container wind-field`) re-discovers all 3 and regenerates `src/pre/{layertypes,layerattachments,interactions}.js`; all three appear in `configure/public/*.json`.

**Not verified — be blunt:** I never saw this in a browser. I did not bring up Postgres + the server, did not log into `/configure`, and did not configure a layer or click a feature. So: the barbs may be geometrically wrong on a real map, the popup may never open, and `defaultAttachments`/`defaultInteractions` may or may not actually reach the runtime — I only checked they are declared and that core generated registries containing them. The 20-minute cap went to reading ~2,500 lines of family docs and authoring; the hand-off walk is the part that got cut. Treat everything below about the *seams* as "what the docs say plus what I wrote", not "what I observed".

## 2. The seams between families

**Type → attachment.** The fact the attachment needs is *which property holds speed/direction and how big to draw the barb*. I passed it with the documented mechanism, in `layertypes/WindField/plugin.json`:

```json
"capabilities": {
  "defaultAttachments": {
    "wind_barbs": { "speedProp": "windSpeed", "directionProp": "windDirection", "scale": 200 }
  }
}
```

and the attachment reads it as `ctx.config` with its own fallbacks (`config?.speedProp || 'windSpeed'`). The docs told me to do exactly this (`plugins/README.md:373-385`, `core/layertypes/README.md:475-508`) and were emphatic about *not* having the type write into the attachment's `configPath`. This is the best part of the design: the fact lives once, in the plugin that knows it.

**Type → interaction.** `capabilities.defaultInteractions.click: ["wind:report"]` — documented (`core/layertypes/README.md:451-471`). **But it carries ids only, no settings.** There is no `defaultInteractions` equivalent of `defaultAttachments`' settings object, so the same two property names had to be *duplicated as literals* in `interactions/WindReport/logic.js`:

```js
return report(feature, {
    speedProp: config?.speedProp || 'windSpeed',
    directionProp: config?.directionProp || 'windDirection',
})
```

Nothing told me to do that — I invented it, and it is the asymmetry I'd fix first. The property names now exist in three places (type manifest, attachment default, interaction default) and only the first two are linked.

**How I kept them agreeing.** By making the layer type *rewrite the data*: `source.fetch` normalizes any feed onto `windSpeed`/`windDirection`, so the downstream defaults are correct by construction. That is a workaround for the missing seam, not a solution — it only works because my type owns data acquisition. A type that inherits vector's plain URL fetch could not do it.

**Attachment → interaction:** nothing. Neither needs the other, and there is no way for them to talk anyway.

## 3. Where I wanted one plugin to call/read another and could not

- **Interaction wanting the attachment's settings.** The popup should say "this barb is 200×" or reuse the same scale/colour the barb was drawn with. `ctx.config` is deliberately only *this* interaction's subtree (`core/interactions/README.md:61-63`), and there is no registry lookup by `attachmentId`. Workaround: both import `lib/wind.js` so at least the *colour ramp and categories* are one definition; the property names are duplicated.
- **Interaction wanting to know which attachment instance was clicked** (`L_.layers.attachments[layerName].wind_barbs` is documented as readable) — I chose not to reach for `L_` at all because importing a singleton makes the module untestable in Node (`core/interactions/README.md:65-69`). So there is a real tension: the documented cross-plugin channel is a singleton, and touching the singleton costs you your unit tests.
- **Attachment wanting to know the layer type it is hosted on.** `make(ctx)` gets `layerObj`, so `layerObj.type` is reachable, but nothing says that is legitimate. I didn't use it.

## 4. Things that failed silently / nearly did

- `create layertype … --extends vector` scaffolds `applicableLayerTypes: ["vector","query"]` on the *attachment* scaffold, which does **not** include my new `windfield` type. If I had left it, `defaultAttachments` would have been silently refused (the docs do warn `validate` catches this — I added `"windfield"` before ever running it, so I did not confirm the warning fires).
- The interaction scaffold ships `applicableLayerTypes: ["vector","vectortile","query"]`. On a `windfield` layer that *happens* to work because the type chain includes `vector` — meaning a wrong-but-plausible value is indistinguishable from a right one.
- `plugins -- activate` printed **"No changes"** right after I edited three manifests, because `create` had already activated them. That is a genuinely alarming message when you're checking whether your edits registered; I had to grep `src/pre/*.js` to confirm.
- No error anywhere for a `pluginDependencies` id that names your own siblings across a rename. I pinned `--container wind-field` on install as the docs instruct, but if I hadn't, `wind-field/layerattachments/WindBarbs` would have gone unresolved and the *layer type* would have vanished from the registry while still listing as enabled.

## 5. Docs: confusing / missing / contradictory

- `plugins/README.md:363-371` (seam table) says "type → interaction: `capabilities.defaultInteractions`", side by side with "type ships an attachment … which also carries the attachment's settings". The parallel reads as if both carry settings. They don't. This is the single most misleading line for a multi-family author.
- `plugins/README.md:387` — "There is deliberately no registry lookup by `attachmentId`/`interactionId`" — is a clear rule, but the very next family doc (`core/layerattachments/README.md:144-149`) tells you core stores your attachment at `L_.layers.attachments[host][id]` "verbatim", which reads like an invitation to do exactly the lookup that was just forbidden.
- `core/layertypes/README.md:607` checklist says a new type needs `capabilities.renderers` + `modules`, but an `extends` type legitimately declares `module` (singular) and inherits renderers — the checklist never mentions the extending case it spends a page on at line 71.
- Nowhere is there a worked example of a *container* with more than one family in it. `plugins/README.md:349-361` shows the directory tree of one and then stops; the hazard-zones example is a tree, not code. A 40-line end-to-end example would have saved most of my reading.
- `core/layerattachments/README.md:158-162` says `config` is never `null` in `make`; the scaffold it generates writes `ctx.config?.initialVisibility`. Small, but the scaffold contradicts the contract.
- `initialVisibility` appears in the scaffold and the worked example but is documented nowhere as a setting an admin can set — it is not in any generated `config.rows`, so it is effectively dead unless the plugin adds a row for it.

## 6. What I liked

- `--extends vector` is excellent. A new data source really is one file, and the CLI validating the parent as you type it (refusing a parent that itself extends) caught a class of error before it existed.
- `defaultAttachments` carrying settings is the right answer to the shared-facts problem, and the docs explain *why* the obvious alternative is wrong — rare and valuable.
- The scaffolds are honest: every operation is listed as a comment with the core default it would replace, so "write only what differs" is actionable rather than aspirational.
- The `logic.js` split in the interaction scaffold, with the test already written against it, is opinionated in the right direction — my unit tests existed before my code did.
- `validate` distinguishing "manifest valid" from "registered" and saying so out loud (`plugins/README.md:335-347`) set expectations correctly.

## 7. Top 3 recommendations

1. **Let a layer type hand settings to its default interactions, exactly as it does to attachments** — `"defaultInteractions": { "click": { "wind:report": { "speedProp": "windSpeed" } } }`, merged into the interaction's `configPath` the same field-by-field way. Today the settings seam exists for one family out of two, and the workaround is duplicated string literals.
2. **A container-level manifest** (`plugins/<container>/container.json`: name, version, shared `variables` defaults, the plugin list). It gives one place for facts several families share, one version for the thing an admin installs, and it would let `install` warn "this container's plugins reference each other — pinning `--container wind-field`" instead of leaving a rename to break dependencies silently.
3. **A "feature" view in Configure, and in `plugins -- info`**: when an admin sets a layer's type to `windfield`, show what came with it — the attachment turned on, the settings it inherited, the interactions in its pipeline — instead of making them find three separate tabs and guess which empty field is "empty means the type decided". `info <container>` printing the whole container as one unit would do the CLI half in an afternoon.
