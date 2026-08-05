# Round 6 — Stratigraphic columns: a third-party author's report on the MMGIS plugin system

Branch: `devin/r6-stratigraphy-1785954601` (off `devin/1785790516-finalize-layertype-plugins`)
Container: `plugins/strat-plugins/` (gitignored by design, committed with `git add -f`)
Core changes: **none**. Nothing under `src/`, `API/`, `configure/` or `plugin-cli/` was touched.
Time: ~25 minutes of work against a 20-minute budget.

---

## 1. What I built, and what actually works

One feature — stratigraphic columns measured at outcrops — spread across the four
families the prompt asked for, in a single container.

| plugin | family | id | what it does |
|---|---|---|---|
| `layertypes/StratColumn` | layertype | `stratcolumn`, `extends: vector` | outcrop points from a GeoJSON / OGC API Features service; owns the unit table, marker horizons and the derived legend |
| `layerattachments/StratColumnBars` | layerattachment | `strat_column_bars` | a stacked, unit-coloured bar at each outcrop. **Shipped configured by the type** via `capabilities.defaultAttachments` |
| `layerattachments/StratUnitLabels` | layerattachment | `strat_unit_labels` | unit names beside the bars. **Off until an admin turns it on** |
| `interactions/StratSection` | interaction | `strat:section` | on click, computes the section penetrated at that outcrop. Shipped *and configured* by the type via `capabilities.defaultInteractions` |
| `lib/unitTable.js` | shared module | — | parses/stacks the unit table; the one fact all four agree on |

### The layer type

`extends: vector`, so drawing, picking, filtering and both globes are inherited.
It declares three surfaces in one module (`stratColumn.js`):

- `source.fetch` — builds the request (`limit`, `bbox` when the layer opts into
  dynamic extent), and stamps a **stable** `stratDepth` property onto every
  feature from whatever property name the admin configured, so the mission's
  `style` can say `prop-stratDepth` and downstream plugins never need the admin's
  property name.
- `config.normalize` — parses the unit table once at parse time.
- `legend.derive` — the unit table *is* the legend; one square swatch per unit,
  top first. Returns `false` when there is no table, per the contract.

Its Configure form is deliberately the hard part, and covers every control class
the prompt named:

| requirement | control | field |
|---|---|---|
| multi-line block of text (unit-colour table) | `textarea`, `rows: 10` | `variables.stratColumn.unitTable` |
| list of repeated sub-objects | `objectarray` (label / depth / colour) | `variables.stratColumn.markerHorizons` |
| dropdown whose options depend on the data | **could not be expressed** — degraded to `text` | `variables.stratColumn.depthProp` (see §3a) |
| a colour | `colorpicker` | `variables.stratColumn.outlineColor` |

plus a second tab (`Stratigraphy`) alongside `Core`, a `number` (`limit`) and a
static `dropdown` (`depthUnit`).

### What is verified, and what is not

Verified:

- `npm run plugins -- validate` — 62/62 valid, **0 errors, 0 warnings** for my four
  plugins (the one dependency warning in the repo is pre-existing:
  `core/interactions/ChemistryUse` depends on a missing `core/tools/ChemistryTool`).
- `NODE_ENV=test npx eslint plugins/strat-plugins` — clean.
- `PLAYWRIGHT_TEST_UNIT_ONLY=true npx playwright test plugins/strat-plugins` —
  **15 passed**. Includes real assertions, not just manifest shape: the unit table
  parses and stacks with comments/blank lines ignored; a section is clipped to the
  outcrop's depth; feet convert to metres; marker horizons filter by depth and can
  be switched off; an unconfigured layer yields `null` rather than throwing;
  `fetch` stamps `stratDepth` and falls back to total thickness; `legend.derive`
  builds entries or returns `false`.
- `npm run test:unit` — 1084 passed (no regressions).
- `npm run plugins -- activate` regenerated `src/pre/layertypes.js`,
  `src/pre/layerattachments.js`, `src/pre/interactions.js` and
  `configure/public/*.json`; I read those files and confirmed `stratcolumn` (both
  config tabs, `defaultAttachments` and `defaultInteractions` intact in its
  `manifest`), `strat_column_bars` and `strat_unit_labels` (both with
  `applicableLayerTypes: ["stratcolumn"]` and their `config.tab`), and
  `strat:section` with its `configPath` and rows.

**Not verified — say it plainly: I never saw any of this in a browser.** PostGIS
and `npm start` were not running, `curl http://localhost:8888/configure` returned
nothing, and I was already past the time limit; the prompt's fallback ("if you
cannot sign in … inspect the generated `configure/public/*.json` instead") is what
I did. So:

- **Registration** is verified — every plugin is in the generated registries and
  in the Configure metaconfig.
- **Rendering is untested.** No bar rectangle has ever been drawn. The
  latitude-offset geometry in `stratColumnBars.js` (`M_PER_DEG = 111320`, units
  stacked northwards from the outcrop) is plausible arithmetic that has never met
  a map, and will be visibly wrong at high latitudes and on non-Earth bodies —
  it uses a flat metres-per-degree constant rather than the mission's radius,
  which I could not find a neutral plugin-facing helper for in the time I had.
- **The click path is untested.** `sectionAt()` is well covered; the two lines of
  `StratSection.use` that read `ctx.config`/`ctx.layerData` and write `ctx.state`
  have never run. Per `plugins/core/interactions/README.md:179-180` — "A green
  manifest and a green runner test do not mean the interaction works — click a
  feature" — I did not click a feature.
- **Nothing was configured through the Configure page**, so the admin-experience
  findings in §5 are read off the metaconfig and the documented Maker semantics,
  not observed in the UI. Where that distinction matters I say so.

---

## 2. Branch and files

Branch `devin/r6-stratigraphy-1785954601`.

```
plugins/strat-plugins/
├── README.md                                             # the seam that is not declarative
├── lib/unitTable.js                                      # parseUnitTable, stackUnits,
│                                                         #   totalThickness, UNIT_TABLE_PATH,
│                                                         #   unitsOfLayer
├── layertypes/StratColumn/
│   ├── plugin.json                                       # typeId, extends, capabilities
│   │                                                     #   (.defaultAttachments,
│   │                                                     #    .defaultInteractions),
│   │                                                     #   supportedData, config.tabs[2]
│   ├── stratColumn.js                                    # source.fetch, config.normalize,
│   │                                                     #   legend.derive
│   └── tests/stratColumn.spec.js                         # 5 @unit tests
├── layerattachments/StratColumnBars/
│   ├── plugin.json                                       # attachmentId, configPath,
│   │                                                     #   applicableLayerTypes:[stratcolumn],
│   │                                                     #   host.order 40
│   ├── stratColumnBars.js                                # make, syncData, onConfigChange
│   └── tests/stratColumnBars.spec.js                     # scaffolded contract test
├── layerattachments/StratUnitLabels/
│   ├── plugin.json                                       # host.order 60,
│   │                                                     #   buildsAfterSiblings: true
│   ├── stratUnitLabels.js                                # make, syncData
│   └── tests/stratUnitLabels.spec.js                     # scaffolded contract test
└── interactions/StratSection/
    ├── plugin.json                                       # interactionId, phase main,
    │                                                     #   order 200, configPath, config.rows
    ├── StratSection.js                                   # use(ctx) — thin adapter
    ├── logic.js                                          # sectionAt() — pure, tested
    └── tests/stratSection.spec.js                        # 6 @unit tests
```

Everything was created with the documented CLI path
(`npm run plugins -- create layertype StratColumn --container strat-plugins --extends vector`,
and `create layerattachment` / `create interaction` for the rest), then edited in
place.

---

## 3. Where the system resisted

### (a) "A dropdown whose options depend on the data" cannot be expressed at all

This was an explicit requirement of the feature, and it is the one thing I
straightforwardly could not do.

`plugins/README.md:812` is the whole specification of the field:

> \| `options` \| required by the dropdown types; an array, or a string Maker parses \|

An array is static and lives in the manifest. There is no callback, no
`optionsFrom`, no way to say "the property names of whatever this layer's URL
returns", and no plugin-supplied provider — the one dynamic control, `button`, is
explicitly closed off at `plugins/README.md:863`:

> \| `button` \| runs a named `action` (populate-from-XML and friends); **actions are core's, not a plugin's** \|

So the single most important field in a stratigraphy layer's configuration —
*which feature property holds the measured depth* — is a bare text box:

```json
{
    "field": "variables.stratColumn.depthProp",
    "name": "Depth Property",
    "description": "The feature property holding each outcrop's measured depth. A dropdown of the service's own property names is not expressible here — see the container README.",
    "type": "text",
    "width": 4
}
```

Consequences an admin actually feels: no discoverability (they must open the
service's JSON in another tab), no validation, and a typo is silent — my `fetch`
falls back to the table's total thickness, so every outcrop renders a full column
and nothing anywhere says why. The same limitation applies to `depthProp` on the
interaction card. For a *configuration-heavy* layer type, property-name fields are
the majority of the hard fields, and they are exactly the ones the form cannot
help with.

I considered and rejected two workarounds: a `json` control (dumps the problem on
the admin and loses the form entirely), and having the type populate `options` at
runtime by mutating its own manifest (there is no supported point at which a
plugin can do that — `configure/public/layerTypeConfigs.json` is generated at
`activate` time from the static manifest).

### (b) The declarative seam only carries manifest-time facts — so the coupling it removed comes back

This is the finding I would keep if I could keep only one.

`capabilities.defaultAttachments` / `defaultInteractions` are genuinely good, and
they worked exactly as documented for the facts *I* know while writing the
manifest:

```json
"capabilities": {
    "defaultAttachments": {
        "strat_column_bars": { "widthMeters": 40, "exaggeration": 1, "outlineColor": "#222222" }
    },
    "defaultInteractions": {
        "click": { "strat:section": { "depthProp": "measured_depth_m", "depthUnit": "m" } }
    }
}
```

But the central fact of this feature is not manifest-time. It is the unit table,
which an admin types into a `textarea` at configure time:

```
Shale,#7a6a53,12.5
Sandstone,#d8c27a,4
Basalt,#333333,20
```

Both attachments and the interaction need it. The layer type cannot forward it,
because the manifest is static. There is, per `plugins/README.md:400`,
"deliberately no registry lookup by `attachmentId`/`interactionId` for plugins,
and no way to *call* another plugin's operations". So what I did — and I want to
be explicit that **I invented this and suspect it is wrong** — is read the layer
type's subtree off the host layer object that core hands every attachment:

```js
// plugins/strat-plugins/lib/unitTable.js
export const UNIT_TABLE_PATH = ['stratColumn', 'unitTable']

export function unitsOfLayer(layerObj) {
    let node = layerObj?.variables
    for (const key of UNIT_TABLE_PATH) node = node?.[key]
    return stackUnits(parseUnitTable(node))
}
```

```js
// plugins/strat-plugins/layerattachments/StratColumnBars/stratColumnBars.js
function make(ctx) {
    const units = unitsOfLayer(ctx.layerObj)
    if (units.length === 0) return false
    …
}
```

That is a string-literal path into another plugin's config subtree — precisely
what `plugins/core/layertypes/README.md:519-524` says `defaultAttachments` exists
to abolish:

> Why the settings and not just a list of ids: they are the reason this exists.
> The property holding a magnitude is a fact your type knows and the attachment
> does not, and **before this the only way to pass it along was for your type's
> config rows to write into the attachment's subtree — a string-literal
> `configPath` that broke whenever either plugin was renamed.**

The mechanism removes the coupling only when the shared fact is known to a
manifest author. When the shared fact is typed by an admin, the coupling returns
in the mirror-image form: instead of the type writing into the attachment's
subtree, the attachment reads out of the type's. I centralised it in
`lib/unitTable.js` so there is one path rather than three, and documented it in
`plugins/strat-plugins/README.md`, but it is still a rename away from breaking and
nothing — not `validate`, not the docs — would tell me.

The rules as written do not forbid it, which is itself part of the problem:

- `plugins/core/layerattachments/README.md:80` — "**Never read the host's config
  directly** — core resolves `configPath` for you and hands the result to every
  operation as `ctx.config`." This is about *my own* settings. It is silent about
  another plugin's subtree, while `ctx.layerObj` (which contains all of them) is
  handed to me by name in `make`.
- `plugins/README.md:370` — "each plugin's own `configPath` + `config.rows`; a
  plugin owns its subtree and **should not write another's**". Writing is
  forbidden; reading is not mentioned.

The only sanctioned alternative is to give each of the three plugins its own unit
table field, i.e. **make the admin type the whole colour table three times and
keep the copies in sync by hand** — which is exactly the failure mode this round
was asked to look for.

### (c) The `objectarray` marker horizons are weakly specified

`objectarray` itself works and is a good control. What I could not express:

- **No required/validated item fields.** A horizon with a label and no depth is
  accepted; the plugin has to filter it out
  (`.filter((m) => Number.isFinite(m.depth))` in `logic.js`). Note that
  `"required": true` *does* appear on the core `name` row in the scaffolded
  layertype manifest, so the key exists — it is simply not documented in the
  component table at `plugins/README.md:804-816`, and I had no way to know whether
  Maker honours it for a plugin's own rows.
- **No `default` semantics for item components.** The table says `default` is a
  form default written on touch; for an `objectarray` item it is not stated
  whether a newly added item gets its components' defaults. I assumed not.
- **No ordering guarantee or sort control.** Marker horizons are naturally ordered
  by depth; the array's order is whatever the admin typed, so the plugin sorts (or,
  in my case, filters) defensively.
- Combined with `plugins/README.md:818-821` ("A value an admin clears is written as
  an empty string rather than removed, so a `number` field can reach a plugin as
  `""`"), every numeric item field must be read through a `parseFloat` guard. I did
  this everywhere (`num(v, fallback)` appears in four files) but it is boilerplate
  the system could absorb.

### (d) An interaction's form is one flat card, with no structure

`plugins/README.md:870-875`: "**An interaction takes `rows` and nothing else.**"
For `strat:section` that was survivable (three controls in one row), but a
configuration-heavy interaction — which is what the prompt asked for — has no
`tab`, no `order`, no `subname` grouping documented, and no way to hang a block of
controls off its own sub-switch except by pointing `disableSwitch` at one of its
own fields. If interactions are meant to carry real settings, they will outgrow
this quickly.

### (e) No way to declare that two plugins of a feature belong together operationally

`pluginDependencies` exists and is advisory-plus (it gates registry inclusion),
but there is no way to express "the labels attachment is meaningless without the
bars attachment", or "this attachment requires the host layer's unit table to be
non-empty". My labels attachment degrades quietly to the bar's *defaults* when the
bars attachment is off:

```js
function barGeometry(siblings) {
    const bars = siblings?.strat_column_bars
    return {
        widthMeters: num(bars?._opts?.widthMeters, 40),
        exaggeration: num(bars?._opts?.exaggeration, 1),
    }
}
```

If an admin turns the bars off but leaves the labels on, the labels are drawn at
positions computed from defaults that no longer match anything. Nothing warns.

### (f) A minor one: no plugin-facing planetary-radius helper I could find

Both attachments convert metres to degrees with a hard-coded
`M_PER_DEG = 111320`. MMGIS is explicitly multi-body, and a mission's radius is
core state, but I found no documented neutral accessor for it in any of the five
READMEs I read. The alternative was importing an MMGIS singleton, which
`plugins/core/layerattachments/README.md:349-352` explicitly warns against for an
attachment ("Importing an MMGIS singleton — `F_` included — pulls jQuery and makes
the module un-importable in a unit test"). So the correct thing and the testable
thing are in tension, and I chose testable-and-wrong-on-Mars.

---

## 4. The seams between the families

The facts that had to cross a plugin boundary, and how each one got there:

| fact | from → to | mechanism | did the docs tell me? |
|---|---|---|---|
| `depthProp`, `depthUnit` | layertype → interaction | `capabilities.defaultInteractions.click: { "strat:section": { … } }` (object form) | **Yes** — `plugins/core/layertypes/README.md:476-496` and `plugins/core/interactions/README.md:131-141`. Worked exactly as described; `validate` cross-checks the id. |
| `widthMeters`, `exaggeration`, `outlineColor` | layertype → bars attachment | `capabilities.defaultAttachments.strat_column_bars: { … }` | **Yes** — `plugins/core/layertypes/README.md:500-533`. Also verified `validate` would have caught an `applicableLayerTypes` mismatch. |
| bar geometry (resolved `widthMeters`, `exaggeration`) | bars attachment → labels attachment | `capabilities.host.buildsAfterSiblings: true`, then `ctx.siblings.strat_column_bars._opts` | **Partly — I invented the important half.** The docs support extra keys surviving ("hands back to every per-instance operation, **verbatim** — so keys beyond the four below survive, and stashing what a later operation needs on it … is the intended way to keep state", `layerattachments/README.md:145-151`) and they document `siblings` as "what exists" (`:175-178`). But they never say a sibling may *read* another's stashed state, and never state what `siblings` is keyed by. I guessed `attachmentId` (consistent with `L_.layers.attachments[host][sublayerKey]` at `plugins/README.md:371`). I am reading `_opts`, an underscore-prefixed private field of another plugin — the same shape of coupling as (b), one level down. |
| the unit/colour/thickness table | layertype → both attachments **and** the interaction | direct read of `layerObj.variables.stratColumn.unitTable`, centralised in `lib/unitTable.js` | **No. Entirely invented**, and I believe it is the wrong thing that the system currently leaves no right way to do. See §3b. |
| `stratDepth` (a stable property name) | layertype's `fetch` → its own inherited renderer, and anything downstream | the type stamps it onto every feature in `source.fetch`, so `style` can say `prop-stratDepth` and no sibling needs the admin's property name | **Hinted** — `plugins/core/layertypes/README.md:269-283` ("the cheapest way to style live data is to compute the property you want to style by in `fetch`"). Extending that idea to *insulate siblings from an admin-typed property name* is mine, and it is the one workaround in this container I am happy with. |
| marker horizons | layertype → interaction | read off `layerObj.variables.stratColumn.markerHorizons` in `logic.js` | same problem as the unit table (§3b) |

The shape of the answer: **the declarative seams carry everything a manifest
author knows, and nothing an admin types.** Half of this feature's cross-plugin
facts fell on the wrong side of that line.

---

## 5. Things that failed silently

1. **`tests/helpers/browser-globals.js` does not stub `window.location`.** The
   obvious way to resolve a possibly-relative layer URL in `source.fetch` is
   `new URL(ctx.url, window.location.href)`. That throws only inside the unit
   test, as:

   ```
   TypeError: Cannot read properties of undefined (reading 'href')
     at plugins/strat-plugins/layertypes/StratColumn/stratColumn.js:23
   ```

   The helper's docstring lists exactly which globals it deliberately leaves
   undefined (`window.L`, `window.Cesium`, `window.THREE`) and `location` is not
   among them, so this reads as an oversight rather than a decision. Worked around
   with `window.location?.href` and a comment. Cost: several minutes chasing what
   looked like a bug in my own module.

2. **A type-shipped attachment's true state is unrepresentable in its own
   Configure form.** `plugins/README.md:398` states the rule: "the Configure form
   for that attachment shows *empty* fields on such a layer — empty means 'as the
   type declared'". So on a `stratcolumn` layer, the bars attachment is on and
   configured, and its form shows blanks. I set `"defaultChecked": true` on its
   Enabled switch to hint at that, which is **misleading in the opposite
   direction**: a `default`/`defaultChecked` is a *form* default that is never
   written (`plugins/README.md:811`), so the switch's rendered position is not
   evidence of anything. There is no way to render "inherited: on, from the layer
   type". An admin cannot distinguish inherited-on from default-off, and toggling
   the switch to write an explicit value is the only way to find out. (Read from
   the docs and metaconfig; not observed in the UI, since I never loaded it.)

3. **`configure/public/interactionConfigs.json` is keyed by plugin *name*, every
   other registry by family id.** Mine appears as `"StratSection"`, while
   `layerTypeConfigs.json` uses `"stratcolumn"` and `layerAttachmentConfigs.json`
   uses `"strat_column_bars"` / `"strat_unit_labels"`. Not incorrect, but it broke
   my first attempt to grep for my own plugin and would break anything scripted
   against the set of registries uniformly.

4. **`validate` cannot see the coupling in §3b at all.** Four plugins, one of which
   hard-codes a path into another's config subtree, and the result is
   `✓ All 62 plugin(s) valid`, 0 warnings. Rename `variables.stratColumn.unitTable`
   in the layer type and every bar silently stops being drawn (`make` returns
   `false` when there are no units) with a green validate and no console output.
   This is the "green validation, nothing happens" case the prompt asked about,
   and it is a direct consequence of there being no sanctioned mechanism to
   declare the relationship.

5. **`slider` min/max/step are unchecked.** I gave the exaggeration slider
   `min: 0.1, max: 20, step: 0.1`; `validate` neither requires nor validates them,
   so a slider missing them would presumably render broken with a green manifest.
   Untested — I did not deliberately break it, being out of time.

6. **An attachment returning `false` from `make` is indistinguishable from a
   misconfigured one.** Both of mine return `false` when the unit table is empty,
   which is correct per `plugins/core/layerattachments/README.md:150-151` ("Return
   `false`, not `{}`, when there is nothing to add") — but the admin-facing result
   of "you enabled the attachment and forgot to fill in the unit table" is an empty
   map with nothing anywhere saying so. There is no documented channel for an
   attachment to surface a configuration complaint.

---

## 6. Documentation: confusing, missing or contradictory

All line numbers as of commit `b2b7e1aa` on `devin/1785790516-finalize-layertype-plugins`.

1. **`plugins/README.md:812`** — `options`: "required by the dropdown types; an
   array, **or a string Maker parses**". The string syntax is never given anywhere
   in any of the five READMEs. It is unusable as written, and it is the field I
   most wanted to push on (§3a).

2. **`plugins/README.md:398` vs `plugins/core/layerattachments/README.md:266`** —
   contradictory accounts of the enabled switch for a type-shipped attachment.
   The first: "the Configure form for that attachment shows *empty* fields on such
   a layer — empty means 'as the type declared', and typing a value overrides it …
   a blank or missing field leaves the type's value standing; `false` and `0` are
   answers and do override." The second: "`<configPath>.enabled` is the switch that
   turns the attachment on." Read together, it is unclear whether an untouched
   switch on a type-shipped attachment means "on (inherited)" or "off"; the first
   implies the former, the second reads as the latter. This is the mechanism
   directly behind silent failure #2.

3. **`plugins/core/layerattachments/README.md:175-178`** — `ctx.siblings` is
   described only as "the other attachments … it is built last and is handed what
   exists". Its **keys are never specified** (attachmentId? sublayerKey? plugin
   name?), and there is no statement about whether reading a sibling's stashed
   fields is sanctioned. I guessed `attachmentId` from the unrelated
   `L_.layers.attachments[<host>][<sublayerKey>]` note at `plugins/README.md:371`.
   This is a documented capability with an undocumented contract — and it is one of
   the two inter-plugin seams in my feature (§4).

4. **`plugins/README.md:804-816`** (the component-field table) — omits
   `required`, `min`, `max`, `step`, `defaultChecked` (mentioned only in passing in
   the `default` row), `subname` and `forceHeight`, all of which appear in
   scaffolded or core manifests. The scaffold is effectively a second, richer
   specification of the same table, and the two do not agree.

5. **`plugins/core/layertypes/README.md:632`** — the new-type checklist says
   "`plugin.json` — `typeId`, `capabilities.renderers`, `modules`,
   **`supportedData`**", but `supportedData`'s schema is documented nowhere: not
   its keys, not which are required, not the vocabulary of `category`
   (`vector` / `raster` / `raster-data` / `model` / `none` all appear in core
   manifests), not `procurement` or `requiresServices`. I filled it in by copying
   `plugins/core/layertypes/Data/plugin.json`. `validate` accepted whatever I
   wrote, which means it is also unenforced.

6. **`plugins/README.md:1071-1075`** (lint needs `NODE_ENV`) is filed under
   "Validation", three sections after "Testing Plugins". It is exactly the kind of
   thing an author hits on their first lint, and I only knew about it because I had
   read the whole file first. Worth a cross-reference from the testing section.

7. **`plugins/core/layertypes/README.md:634`** — "Add only the other operations
   your engine can't do uniformly for you" is good advice that sits *after* the
   surface tables it applies to, and there is no equivalent warning attached to the
   non-render surfaces (`config`, `legend`, `source`) where the same
   "an empty implementation silently overrides a working one" trap applies. The
   attachment README does have that warning inline
   (`plugins/core/layerattachments/README.md:106-107`); the layertype one does not.

8. **Nothing anywhere documents how a plugin gets the mission's planetary
   radius** (§3f), despite metres-to-degrees being the single most common piece of
   arithmetic an attachment will need, and despite the attachment README explicitly
   discouraging the singleton import that would supply it.

---

## 7. What I liked, and what was easier than expected

- **`create layertype <Name> --extends vector` is the best thing in the system.**
  It validated the parent as I typed it, wrote a single-module scaffold whose keys
  are *surfaces*, and its "Next steps" output told me the three things I actually
  had to do. Going from zero to a working three-surface layer type was minutes.
- **The scaffolded tests are real tests, not placeholders.** The layertype spec
  already asserted that the module's keys are surfaces rather than renderer
  operations — a mistake I would plausibly have made — and the interaction spec
  already covered "an event with no feature". I kept both and built on them.
- **The `logic.js` / handler split the interaction scaffold ships** is the single
  design decision that made a genuine unit test free. I wrote six meaningful
  assertions about stratigraphy without ever touching Leaflet or `L_`.
- **`validate`'s cross-family checks are better than I expected.** It resolves
  `defaultAttachments` / `defaultInteractions` ids against enabled plugins, checks
  that a declared default attachment actually accepts my type as a host, and warns
  about a tab of one's own. That is real static checking of a *distributed* config.
- **`activate` regenerating `configure/public/*.json`** meant I could confirm the
  entire Configure-facing surface — tabs, rows, configPaths, capabilities — without
  a build, a database or a browser. Given that I never got the app up, this is the
  only reason §1 has any verification in it at all.
- **`extends` is genuinely one level of inheritance done right.** Declaring
  `source` + `config.normalize` + `legend.derive` and inheriting drawing, picking,
  filtering and both globes is a huge amount of leverage for one file, and the
  per-operation (not per-surface) merge meant I never worried about clobbering
  Vector's `config.expand`.
- **`applicableLayerTypes: ["stratcolumn"]` doing double duty** — restricting the
  runner *and* hiding my attachments from every other layer's Configure form — is
  one declaration solving two problems, and I did not have to think about it.

---

## 8. Top three recommendations, ranked

### 1. Let a dropdown's `options` be resolved at configure time

The highest-value change for exactly the class of plugin this round was about.
Concretely: an `optionsFrom` on dropdown components, with at minimum a
`"featureProperties"` provider that Configure populates by sampling the layer's
own URL, plus a documented string grammar for the "string Maker parses" already
promised at `plugins/README.md:812`. Every property-name field in every
data-driven layer type is a raw text box today, and each one is a silent failure
waiting for a typo. Second-best and much cheaper: let a plugin declare a
`propertyPicker` component type that core implements once against the layer's
resolved URL.

### 2. Make the type→sibling seam able to carry admin-typed values

`defaultAttachments`/`defaultInteractions` solved the manifest-time half of the
problem and named the string-literal `configPath` as the thing to kill
(`plugins/core/layertypes/README.md:519-524`). Finish it with a reference form
resolved by core at layer-parse time:

```jsonc
"capabilities": {
    "defaultAttachments": {
        "strat_column_bars": { "unitTable": "$ref:variables.stratColumn.unitTable" }
    }
}
```

Core already walks the layer config at parse time and already merges these
settings field-by-field into the attachment's `configPath`; resolving a `$ref`
against the same layer object is a small addition to a mechanism that exists.
The payoff is that the *declaring* plugin owns the path — so a rename is one
plugin's problem — and `validate` gains something to check. Without it, any
feature whose plugins share an admin-typed fact either duplicates the field (the
admin types it N times) or hard-codes a foreign path (what I did), and the system
cannot see either.

### 3. Make inheritance visible in the Configure form

An attachment or interaction that a layer type ships configured should not render
as blank fields and a meaningless `defaultChecked`. Render the type-declared value
as the control's placeholder or greyed value with a "from layer type" affordance,
show the attachment's *actual* enabled state, and let an admin revert an override
back to inherited. This is the difference between "empty means as the type
declared" being a documented rule an admin must have read, and it being something
they can see. It also removes the contradiction in §6.2 by making the answer
visible rather than textual.

*(Runners-up, if there is appetite: specify `ctx.siblings`' keys and whether
cross-reading a sibling's stashed state is sanctioned (§4); add `window.location`
to `tests/helpers/browser-globals.js` (§5.1); document `supportedData`'s schema
(§6.5); and expose a plugin-facing planetary-radius helper that does not require
importing a jQuery-pulling singleton (§3f).)*
