# R5 — Dust storm fronts: authoring a multi-family MMGIS feature

Branch `devin/r5-atmos-1785952360`. **No core changes were needed** — everything
went in `plugins/dust-storms/`.

## 1. What I built / what actually works

All three plugins exist and cooperate on paper. `npm run plugins -- validate` is
clean (only the pre-existing `core/interactions/ChemistryUse` dependency
warning), 12 new plugin unit tests pass, the full `npm run test:unit` (1060)
passes, eslint/prettier clean.

**I never saw it in a browser.** No mission with a `duststormfronts` layer, no
storm GeoJSON fixture — so the render path, the attachment build, the click, the
time-window slide and the histogram are all *untested at runtime*. What is
genuinely tested is the pure maths (motion vector scaling/heading, track
ordering, forward/backward stepping, end-of-track, no-feature and no-archive
cases) and the manifest contracts.

## 2. Files

- `layertypes/DustStormFronts/` — `plugin.json`, `dustStormFronts.js`
  (`source.fetch` + `config.normalize`), `tests/dustStormFronts.spec.js`
- `layerattachments/StormMotion/` — `plugin.json`, `stormMotion.js`
  (`make`/`syncData`/`onConfigChange`), `tests/stormMotion.spec.js`
- `interactions/StormTrack/` — `plugin.json`, `StormTrack.js`, `logic.js`,
  `tests/stormTrack.spec.js`
- `lib/storms.js` — shared, dependency-free storm maths

## 3. The seams

**type → attachment: documented and it fit.** The type declares

```json
"capabilities": {
    "defaultAttachments": {
        "storm_motion": {
            "speedProp": "speed_kmh",
            "headingProp": "heading_deg",
            "intensityProp": "intensity",
            "scale": 1
        }
    }
}
```

and the attachment reads only `ctx.config` — it never touches the host config.
That is exactly what `plugins/README.md:373-385` and
`plugins/core/layertypes/README.md:475-508` tell you to do. I also had to add
`"duststormfronts"` to the attachment's `applicableLayerTypes` — documented, and
`validate` has a test for the case where you forget.

**type → interaction: documented path exists but carries only ids, so I invented
the rest.** `capabilities.defaultInteractions.click: ["storm:track"]` puts the
interaction in the pipeline, but unlike `defaultAttachments` it cannot carry
*settings* — so there is no declarative way to tell the interaction which
property holds the storm id or the observation time. Worse, the interaction needs
the storm's *other* extents, which are by definition not on the map. What I did:
the layer type stashes both on the layer object in `source.fetch` —

```js
layerObj._dustStorms = { all, props }
```

— and `StormTrack` reads `L_.layers.data[layerName]._dustStorms`. The docs
sanction the idea in one line ("or leave something on the layer",
`plugins/README.md:371`) but the key name, the shape, and the fact that it is
only populated after the first fetch are all mine.

## 4. Where I wanted one plugin to reach another and couldn't

- Passing settings to a default interaction (above). Workaround: the
  `_dustStorms` side channel, plus a duplicate `direction` setting in the
  interaction's own `configPath`.
- The attachment only ever sees the *windowed* geojson, so a "ghost of past
  extents" arrow would need the archive too — same `layerObj` side channel, same
  non-contract.
- After the interaction slides the time window, nothing lets it tell the
  attachment to redraw; I rely on core reacquiring the host and calling
  `syncData`. Plausible from the docs, unverified.

## 5. Silent failures I expect

- A click before the type's first `fetch` (or on a layer whose service returned
  nothing) makes `StormTrack` do exactly nothing, with no warning — `validate`
  can't see it, and the interaction is in the pipeline either way.
- I declared `capabilities.time.histogram: true` without implementing anything to
  back it; nothing in validation or the docs says what a type must supply for the
  sparkline to have data, so this may quietly be a no-op.
- `config.normalize` writing `layerObj.time` is unvalidated: a malformed time
  block would just mean an untimed layer.

## 6. Docs friction

- `defaultInteractions` is documented as ids-only
  (`plugins/core/layertypes/README.md:451-471`) right above the section
  explaining why ids-only was the wrong answer for attachments (line 494: "Why
  the settings and not just a list of ids"). The asymmetry is never
  acknowledged, and it is the single biggest gap for a multi-family feature.
- `plugins/core/layerattachments/README.md:158-162` says `ctx.config` is
  "**never** `null` in `make`", yet the scaffold it hands you writes
  `ctx.config?.initialVisibility`. Also `initialVisibility` isn't in any
  documented key table — I copied it from the scaffold on faith.
- `plugins/README.md:591` says the layertype scaffold is "map-only
  (`"globe": false`…)"; the `--extends` manifest it actually generates has no
  `globe` key at all.

## 7. Liked

`create layertype … --extends vector` genuinely made a new data source a one-file
plugin. `defaultAttachments`-with-settings is the right design — the property
names live once. The scaffolds double as documentation, and the `logic.js` /
handler split it suggests made the interaction unit-testable in minutes.
`validate`'s cross-family checks (attachment that refuses your type, unknown
attachmentId) are the kind of error I'd otherwise have found in a browser.

## 8. Top 3 recommendations

1. **Give `defaultInteractions` settings, exactly like `defaultAttachments`**
   (`{"storm:track": {"idProp": "storm_id"}}`), and hand them to the runner as
   `ctx.config` under the interaction's `configPath`. Today a type can name an
   interaction but not tell it anything.
2. **Make the type→family runtime channel a contract, not a convention** — a
   documented, namespaced place (e.g. `layerObj._plugin[typeId]` surfaced as
   `ctx.typeState` for attachments and interactions), with the "not populated
   until first fetch" hazard spelled out. I had to invent `_dustStorms` and no
   one else will guess it.
3. **Ship a way to see a multi-family feature run**: a `create` flag or CLI
   command that drops a sample mission layer + fixture GeoJSON wired to the new
   `typeId`, so the last mile (register → configure → click) isn't a hand-built
   mission. Right now "green validate, never seen it work" is the default
   outcome of an honest 20 minutes.
