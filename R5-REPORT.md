# R5 — Geologic contacts & units: multi-family plugin report

Branch `devin/r5-geology-1785952362` pushed to JPL-Devin/MMGIS (no PR). Container
`plugins/geology/`, force-added. `validate`, `test:unit` (1060), the 14 new
`@unit` tests, eslint and prettier all pass. **No core files modified.** I did
NOT run it in a browser (needs Postgres + a built mission + a real contacts
dataset; out of the time budget) — so everything below is "green tests," not
"seen working."

## 1. What I built / what works vs. untested

One feature, three plugins in one container:

- `layertypes/GeologicUnits` (extends `vector`) — `legend.derive` builds a
  categorical legend from the distinct unit codes in the layer's rendered
  features (`buildUnitLegend`, deterministic colour per code, `styleMatching` so
  it also colours the polygons). **Tested:** the pure derivation. **Untested:**
  that `derive` actually reads `window.L_.layers.layer[name].toGeoJSON()` on a
  live map and that `styleMatching` colours polygons — I asserted the entry
  shape the README documents, not the render.
- `layerattachments/ContactTicks` — for each line feature, a strike/dip tick at
  the midpoint + a certainty-driven dash on the contact line; skips polygons.
  **Tested:** geometry (`contactRenderables`, `tickEndpoints`,
  `dashForCertainty`). **Untested:** that ticks land correctly on the map —
  ticks are sized in **degrees**, an admitted approximation, because a
  pixel/metre-accurate tick needs the live projection a pure module doesn't
  have.
- `interactions/ContactUnits` — click a contact, popup names the two units
  (`decide`). **Tested:** the decision. **Untested:** the popup actually opening
  (`ctx.Map_.map` + `L.popup`).

## 2. Branch & files

`devin/r5-geology-1785952362`

- `layertypes/GeologicUnits/`: `plugin.json`, `geologicUnits.js`,
  `lib/unitLegend.js`, `tests/geologicUnits.spec.js`
- `layerattachments/ContactTicks/`: `plugin.json`, `contactTicks.js`,
  `lib/contactGeometry.js`, `tests/contactTicks.spec.js`
- `interactions/ContactUnits/`: `plugin.json`, `ContactUnits.js`, `logic.js`,
  `tests/contactUnits.spec.js`

## 3. The seams (facts crossing families)

- **type → attachment (property names):** the type declares, in its manifest,
  `capabilities.defaultAttachments.contact_ticks = { strikeProp:"strike",
  dipProp:"dip", certaintyProp:"certainty", tickSizeDeg:0.02 }`. Core merges that
  under the attachment's own `configPath` and hands it back as `ctx.config`; the
  attachment reads `ctx.config.strikeProp` etc. and never looks at the type.
  **This is exactly the documented path** (plugins/README.md §"One feature,
  several plugins", lines ~373-385) — I did not invent it, and `validate` even
  cross-checks it (a declared default whose attachment refuses the type is an
  error). This felt good.
- **type → interaction:** `capabilities.defaultInteractions.click =
  ["contact:units"]`. Documented and works. **But see #4** — this seam carries
  *only ids*, no settings.
- **interaction → the units it names:** it reads the contact feature's *own*
  `unit_left`/`unit_right` properties (defaulted in `logic.js`, overridable via
  the interaction's `configPath`). No cross-plugin fact needed, so no seam.

## 4. Wanted to call/read another plugin and couldn't

Two real ones:

- **`defaultInteractions` can't carry settings.** `defaultAttachments` is
  `{id: {settings}}`; `defaultInteractions` is `{event: [ids]}` (enforced in
  `API/pluginValidation.js:1149-1170`). So the type can *turn on* `contact:units`
  but cannot tell it which property holds the left/right unit — the asymmetry
  with attachments is surprising. Workaround: the interaction defaults the
  property names itself and exposes a form. Fine here because the names live on
  the contact feature; it would hurt if a type needed to hand an interaction a
  fact only the type knows.
- **The interaction can't ask the units layer "what unit is under this point?"**
  The docs are explicit that there's no way to call another plugin and you should
  "read what it left behind" (plugins/README.md:387). A contact line and the unit
  polygons are different layers, so there's nothing left on the contact feature
  from the polygons. I sidestepped it by requiring the contact features to carry
  `unit_left`/`unit_right` themselves rather than doing a spatial lookup against
  the polygon layer.

## 5. Failed silently

Biggest risk, and the docs warn about it (plugins/README.md:335-347): **green
`validate` + nothing on screen.** Specifically, `derive` only runs if a layer's
`type` is `geologicunits` AND the LegendTool asks AND features are loaded; the
ticks only draw if a host layer actually fills
`variables.layerAttachments.contactTicks` (or inherits it as a `geologicunits`
layer); the interaction only fires if it's in the layer's click pipeline. I
verified all three are in the generated `src/pre/*.js` registries and enabled,
but I could not verify any of them fire — that's the honest gap.

## 6. Confusing / contradictory in docs

- The **units-are-polygons vs contacts-are-lines modelling tension** is never
  addressed. The whole "one feature = type + attachment + interaction" narrative
  assumes they act on *the same layer's features*, but a geologic map has units
  (polygons) and contacts (lines) as naturally *separate* layers.
  `defaultAttachments`/`defaultInteractions` only wire onto layers *of the type*,
  so to use the documented seam at all I had to make one `geologicunits` layer
  hold both polygons and lines (attachment/interaction skip polygons). If
  contacts are their own `vector` layer, the type cannot ship anything onto them
  and the headline seam mechanism doesn't apply. This is the single biggest doc
  gap for a multi-family feature.
- The `defaultInteractions`-carries-no-settings asymmetry (#4) isn't called out
  anywhere.
- Minor: layerattachment README (line 344) says importing `F_` makes a module
  un-importable in unit tests, but doesn't mention `window.L_` is a safe lazy
  global for the *layertype* legend case — I had to find `window.L_ = L_`
  (Layers_.js:369) myself.

## 7. What I liked

The `create … --extends vector` scaffold + the `logic.js`/`lib/` split are
excellent — testable-by-construction, and the scaffolded specs told me exactly
how to write `@unit` tests. `validate`'s cross-family checks (attachment↔type
host compatibility, unresolved interaction ids) caught the seam mistakes I'd
otherwise have found only in a browser. The `defaultAttachments` "property names
live once, field-by-field override" design is genuinely nice.

## 8. Top 3 recommendations (ranked)

1. **Let `defaultInteractions` carry settings**, mirroring `defaultAttachments`
   (`{event: {interactionId: {settings}}}`), so a type can hand an interaction
   the facts only the type knows — closes the #4 asymmetry.
2. **Document (and support) the multi-layer feature.** Either a way for a
   type/feature to declare a *companion* layer (units + contacts as one
   installable unit spanning two layers), or an explicit worked example
   acknowledging contacts-are-a-separate-vector-layer and showing how the
   attachment/interaction reach it. This is the real-world shape and the docs
   don't cover it.
3. **A "does anything actually use this?" check** beyond `validate` — e.g.
   `plugins -- info <id>` reporting "0 layers configured to use this" — to attack
   the green-validate-blank-screen failure mode head-on.
