# r4-telemetry — plugin-system usability report

Done. Built the telemetry feature as three cooperating plugins in container `r4-telemetry`, pushed to branch `devin/r4-telemetry-1785892987` (no PR). **No core changes needed.** `validate` = 61/61 valid, plugin unit tests 13/13, core `test:unit` 1041/1041, eslint 0 errors. **Not browser-tested** — no mission was configured within the timebox, so "it works" below means logic + validation, not a click in the app.

## 1. What I built (works vs. untested)
- **layertype `telemetry`** (`extends: vector`, one `source` surface). Fetches the full GeoJSON once, caches it on the layer config, and refilters to the current window on every re-acquire. *Pure refilter logic unit-tested; the fact that core re-invokes `source.fetch` on a plain time move is read from `LayerCapturer`/`dynamicExtent`, not seen in a browser.*
- **layerattachment `telemetry_trail`**: polyline through the points in time order + per-point opacity faded by age vs. the playhead. Sort + fade math unit-tested; live fade untested.
- **interaction `telemetry:scrub`** (`main`): click → move the mission clock so the feature's timestamp is the playhead (window duration preserved; `center`/`endAt` modes). Window math + no-feature safety unit-tested; the actual `TimeControl.setTime` call untested.

## 2. Files
- `layertypes/Telemetry/`: `plugin.json`, `source.js`, `lib/timeWindow.js`, `tests/telemetry.spec.js`
- `layerattachments/TelemetryTrail/`: `plugin.json`, `telemetryTrail.js`, `lib/fade.js`, `tests/telemetryTrail.spec.js`
- `interactions/TelemetryScrub/`: `plugin.json`, `TelemetryScrub.js`, `lib/scrub.js`, `tests/telemetryScrub.spec.js`

## 3. The seams between families
The three **never reference each other**. They meet only at two core-owned pieces of state: the mission clock (`TimeControl`) and the layer's `time.{startProp,endProp,enabled}` config. Flow: interaction moves `TimeControl` → core reloads the time-enabled layer → my `source.fetch` refilters → attachment re-fades. That's elegant when it works, but I had to **read core source** (`LayerCapturer.js`, `dynamicExtent.js sourceCtx`, `TimeControl.setTime`) to learn the contract; the docs don't spell out "move the clock and everything downstream recomputes."

Places I wanted one plugin to reach another and couldn't:
- All three need the same "what timestamp does this feature have" logic. There's no supported way to share a helper across families/containers, so I **reimplemented `featureTime` three times**.
- The attachment wants the layertype's "in-window?" decision; no channel, so it recomputes independently.
- The interaction can't tell the attachment "I scrubbed" except via the global clock.

## 4. Failed silently / traps
- **The attachment has no time hook.** The layerattachment op table has nothing that fires when the playhead moves without the host's data changing. To fade I had to `TimeControl.subscribe` in `make` and `unsubscribe` in `destroy` myself — undocumented for attachments. If I'd relied on `syncData`/`onConfigChange` (the documented reactive ops), the trail would silently never re-fade on an in-window scrub.
- **`source.fetch` `trigger` is misleading.** layertypes/README says `fetch` runs on time change with `trigger:'time'`, but `LayerCapturer` only passes `'time'` for **dynamic-extent** layers; a normal time-enabled layer gets `trigger:'make'` on a time reload. Anyone branching on `ctx.trigger=='time'` for the common case gets nothing.

## 5. Docs confusion (file:line)
- `plugins/core/layerattachments/README.md:101-116` — operation table has no time/playhead operation, yet `plugins/README.md:904-927` frames time as a first-class shared surface for "a plugin of any family." An attachment author reasonably expects a parallel hook and there is none.
- `plugins/core/layertypes/README.md:204,220` — `fetch` "time change / trigger 'time'" vs. the actual dynamic-extent-only behavior in `dynamicExtent.js:77` + `LayerCapturer.js:150-153`.
- **Two contradictions that cost real time:**
  1. eslint's `import/no-anonymous-default-export` wants `const x={}; export default x`, but the plugin **module validator rejects that** ("no `export default {…}` renderer object found") and requires an object literal. You cannot satisfy both.
  2. That validator static-matches the **first textual `export default {` in the file — including inside a comment.** A doc comment I wrote containing that snippet made `validate` report "missing required 'make'" while the real export was correct. Very confusing error.

## 6. What I liked
`extends: vector` made the layertype a genuine one-file plugin — I wrote only `source.fetch` and inherited drawing/picking/styling/filtering/globes. The pure-helper-in-`lib/` + read-globals-off-`window` pattern let me unit-test every plugin's real logic in Node. Scaffolds are honest (real files, sensible tests).

## 7. Top 3 recommendations (ranked)
1. **Give layer attachments a real time hook** (e.g. a `timeChange(attachment, ctx)` op with the playhead), the twin of the layertype `time` surface. Manually subscribing to `TimeControl` from an attachment is the single biggest thing I had to invent, and it's the easiest to get wrong (leaked subscriptions).
2. **A supported shared-utility path across families/containers** (e.g. an exported `@basics/time` `featureTime`/`filterByWindow`, or a documented way for a container to share `lib/`). I wrote the same timestamp reader three times.
3. **Fix the export/validator friction**: make the module validator accept a named-const default export (aligning with eslint) and stop matching `export default` inside comments — and make its "missing make" error point at what it actually parsed.
