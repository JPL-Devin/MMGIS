# R5 — Spectral sampling points across three plugin families

Report — spectral sampling points across three plugin families (20 min, stopped on time).

Branch: `devin/r5-spectra-1785952413` (pushed, no PR). **No core changes.**

## 1. What I built / what actually works

- `plugins/r5-spectra/layertypes/SpectraPoints/` — `plugin.json`, `spectraPoints.js` (`source.fetch` only), `synthesize.js`, `tests/spectraPoints.spec.js`. `extends: vector`. Data is **synthesised, not fetched**: deterministic seeded points whose reflectance is a continuum plus two Gaussian absorption bands over 400–2500 nm at 50 nm steps — VSWIR-*shaped* (EMIT/CRISM-like), not real measurements. A `url` is honoured if configured.
- `plugins/r5-spectra/interactions/SpectraSelect/` — `plugin.json`, `SpectraSelect.js`, `logic.js`, `tests/spectraSelect.spec.js`. `spectra:select`, main/200, toggles a clicked point in/out of a capped comparison set.
- `plugins/r5-spectra/tools/Spectra/` — `plugin.json`, `SpectraTool.js`, `plot.js`, `SpectraTool.css`, `tests/spectraTool.spec.js`. SVG overplot of the selected spectra with per-series legend, remove and clear.

Verified: `plugins -- validate` clean (61 plugins), `NODE_ENV=test eslint` clean, `npm run test:unit` 1060 passed, my 24 `@unit` tests pass, and all three appear in the generated `src/pre/{tools,interactions,layertypes}.js`. **Not verified: I never saw it in a browser.** No server/mission was stood up in the time budget, so the whole runtime path — `defaultInteractions` actually landing in the pipeline, `source.fetch` being called for an extending type, the React panel rendering, `getTool('SpectraTool')` resolving at click time — is untested. Treat the feature as unproven.

## 2. Branch and files

Branch `devin/r5-spectra-1785952413`. Files per plugin as listed in section 1.

## 3. The seams

- *Layertype → interaction (which property holds the spectrum).* There is **no channel**. `capabilities.defaultAttachments` passes *settings* to an attachment (layertypes/README.md:483-500, explicitly "the property holding a magnitude is a fact your type knows and the attachment does not"), but `capabilities.defaultInteractions` (:459-470) takes **ids only**. So I invented one: the type writes its resolved facts onto the layer and the interaction reads them back —
  `stampMeta()`: `layerObj.variables.spectra = spectraMeta(layerObj)`; `resolveMeta(layerVar, config)`: `{ ...FALLBACK_META, ...(layerVar?.spectra || {}) }`, with the interaction's own `configPath` settings winning. The docs did not tell me to do this; it is exactly the string-literal coupling `defaultAttachments` was created to kill, just pointed at `variables.spectra` instead of another plugin's `configPath`.
- *Where that stamping had to go.* I first put it in a `config.normalize` surface. That is a trap: `LayerTypeRegistry._effectiveModules` merges modules **per surface, shallowly**, so declaring `config` to add one line replaces Vector's entire `config` module and silently drops its `expand` (STAC expansion) and `normalize`. Nothing warns. I moved the stamp into `source.fetch` and added a test asserting `SpectraPoints.config === undefined` with the reason.
- *Interaction → tool (the selection set).* No bus, no shared store. The tool module owns `selections` and exposes `addSelection`; the interaction calls `ToolController_.getTool('SpectraTool').addSelection?.(selection, meta.maxSelections)` and declares `pluginDependencies: ["r5-spectra/tools/Spectra"]`. Copied from core's `ChemistryUse` (`TC_.getTool('ChemistryTool').use(ctx.layer)`) — a pattern I found by reading core, not from docs; the READMEs never say how a tool learns what an interaction did. Note the two names disagree: the dependency id is `.../tools/Spectra` (plugin name) while the runtime key is `SpectraTool` (the `paths` key). Nothing checks the latter.

## 4. Wanted and couldn't

- Read the *live tool state* from the interaction (is the panel open? already 4 selected?) — only via the tool module's own fields, which is exactly the "one plugin reaching into another's internals" the family split is meant to avoid. I kept the cap logic on both sides instead, so `nextSelections()` in `logic.js` and `addSelection()` in `SpectraTool.js` are **duplicated implementations of the same rule** (both unit-tested; nothing will catch them drifting) because two plugins have nowhere to share a module.
- Open the tool when the first point is clicked: `ToolController_.openTool('Spectra')` exists (plugins/README.md:630-637) but I couldn't confirm behaviour without a browser, so the tool silently accumulates selections until the user opens it.
- Give the tool the mission's spectral metadata directly. It only ever sees what the interaction copied into each selection object.

## 5. Failed silently

- `getTool()` returns `{ use: function () {} }` for an unknown name (ToolController_.js:106) — a wrong tool key is a green build and a dead click. My `?.` on `addSelection` is the same hazard.
- The `config.normalize` surface-shadowing above: green validate, green tests, STAC expansion quietly gone.
- Metadata mismatch generally: rename `spectrumProp` and the interaction just returns `null` — no feature, no error, no console warning.
- Pre-existing: `validate` warns `core/interactions/ChemistryUse` depends on `core/tools/ChemistryTool`, which does not exist in `plugins/core/tools/` — so the one core example of interaction→tool is itself excluded from the registry.

## 6. Docs issues

- No section anywhere on interaction→tool or tool→interaction communication; `ctx.state` (interactions/README.md:57) only spans one pipeline run. This is the single biggest gap for a multi-family feature.
- Asymmetry between layertypes/README.md:459 (`defaultInteractions`, ids only) and :483 (`defaultAttachments`, ids **and settings**) is never called out, though the rationale at :494 applies verbatim to interactions.
- `providesInteractions` is a recognised manifest field (API/pluginValidation.js:584) and core's Info tool uses it, but it appears nowhere in the `plugin.json` reference.
- The per-surface shallow merge under `extends` is described as an inheritance win (layertypes/README.md:86-92) without warning that declaring a surface to add one operation discards the parent's whole module for it.
- CLI scaffold warts: `create tool SpectraTool` produces the module key `SpectraToolTool` (name the tool `Spectra`); `create layertype` writes `"defaultIcon": "Layers"`, which is not an MDI name (docs: lowercase, no `mdi-` prefix).

## 7. What I liked

The scaffolds are genuinely good — the generated tests already encode the traps (`config` arriving as `''`, `logic.js` split so something is Node-testable, `unresolvedModules`), and the CLI validated `--extends vector` as I typed it. `extends` + `source.fetch` made a new data-bearing layer type ~80 lines. `configPath` + `config.rows` giving a Configure form with zero Configure code is excellent. `validate`'s cross-family id checks and the "left out of the registry" wording on `pluginDependencies` are the kind of docs that save an hour.

## 8. Top 3 recommendations

1. **Give `defaultInteractions` settings, like `defaultAttachments` has.** `"click": { "spectra:select": { "spectrumProp": "vswir" } }` and the runner merges them into `ctx.config`. This is the exact fact-passing problem already solved for attachments, unsolved for interactions, and it is why I had to invent `variables.spectra`.
2. **Define a supported interaction↔tool surface** — a tiny named store or event channel core owns (`PluginState.get/set/subscribe(pluginId, …)`), plus a `getTool` that throws/warns on an unknown name instead of returning a no-op stub. Today the only route is calling methods on another plugin's module by string.
3. **Make `extends` merge at the *operation* level, or warn when a child surface omits operations the parent implements.** Adding one `normalize` should not silently delete the parent's `expand`.
