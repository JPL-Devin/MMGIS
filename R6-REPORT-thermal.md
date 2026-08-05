# R6 — Stress-testing the MMGIS plugin system: a derived layer type

**Author perspective:** third-party plugin author, using only the documented
authoring path (`npm run plugins -- create …`) and the READMEs.

**Branch:** `devin/r6-thermal-<timestamp>` (off
`devin/1785790516-finalize-layertype-plugins`).
**Container:** `plugins/thermal-inertia/` (gitignored by design; `git add -f`ed
onto the branch to share this WIP).

**Feature:** *Thermal inertia estimated from day/night temperature pairs.* One
feature, three plugins that share a pure module:

- `lib/thermalInertia.js` — the model, no `src/essence` imports. Apparent
  thermal inertia ≈ `scale / ΔT` where `ΔT = temp_day − temp_night`. Physical
  intuition: a high-inertia surface stores heat and swings little day↔night, so
  inertia is inversely proportional to the diurnal amplitude. Colour ramp:
  red = low inertia (big swing), blue = high inertia (small swing).
- `layertypes/ThermalInertia/` — `extends: "vector"`, overriding **exactly one
  operation** (`config.normalize`).
- `layerattachments/ThermalShade/` — shades each host feature by its derived
  inertia.
- `interactions/ThermalExplain/` — click a feature → popup explaining the
  derivation.

Verification status up front: **`validate` clean (61 plugins), 13 new plugin
unit tests pass (`test:plugins:unit --grep @unit`), 1084 core unit tests still
pass (`test:unit`), eslint clean. Not seen in a browser** (see §1).

---

## 1. What I built, and what actually works vs. what is untested

**Works — with evidence:**

| Claim | Evidence |
|---|---|
| Manifests are valid | `npm run plugins -- validate` → "All 61 plugin(s) valid" |
| Module contracts hold (surfaces, required ops, resolvable paths) | same, plus the module-parse pass |
| The inertia model computes correctly | `interactions/.../tests/thermalExplain.spec.js`, `layerattachments/.../tests/thermalShade.spec.js` |
| Overriding `config.normalize` keeps the parent's `config.expand` | `layertypes/.../tests/thermalInertia.spec.js` — asserted against the **real** core merge fn `mergeSurfaces`, not a re-implementation |
| The two-deep chain fails loudly | reproduced at CLI, `validate`, and `activate` (see §6) |
| ESLint clean | `NODE_ENV=development npx eslint plugins/thermal-inertia` → exit 0 |

**Untested / unknown — I have NOT seen it draw:**

- Whether a `thermalinertia` layer actually renders on the map via the inherited
  Vector renderer.
- Whether `capabilities.defaultAttachments` / `defaultInteractions` truly flow
  into each sibling's `ctx.config` at runtime (this is the whole seam — §4 — and
  it is exactly the part `validate` cannot see).
- Whether the ThermalExplain popup opens on click and the ThermalShade circles
  colour as intended.

To see it would require: postgis up, `npm start`, `cd configure && npm run
build`, an admin reference mission with a `thermalinertia` layer whose GeoJSON
points carry `temp_day`/`temp_night`, then a click. I did not have runway for
that inside the time box. **"validate passes" is not "it works"** — I am
reporting the wiring as *plausibly correct and contract-valid*, not *observed*.

---

## 2. Branch name and files in each plugin

Branch: `devin/r6-thermal-<timestamp>` (exact name in the reply message).

```
plugins/thermal-inertia/
├── lib/
│   └── thermalInertia.js                         # shared model: deriveInertia, inertiaOfFeature, colorForInertia, DEFAULTS
├── layertypes/ThermalInertia/
│   ├── plugin.json                               # extends vector; defaultAttachments + defaultInteractions; config tab
│   ├── thermalInertia.js                         # single module: { config: { normalize } }
│   └── tests/thermalInertia.spec.js              # 5 @unit tests
├── layerattachments/ThermalShade/
│   ├── plugin.json                               # attachmentId thermal_shade; configPath variables.layerAttachments.thermalShade
│   ├── thermalShade.js                           # make / syncData / onConfigChange + styleForFeature
│   └── tests/thermalShade.spec.js                # 4 @unit tests
└── interactions/ThermalExplain/
    ├── plugin.json                               # interactionId thermal:explain; phase main; configPath variables.interactions.thermalExplain
    ├── ThermalExplain.js                         # thin handler: explain(ctx) → popup + ctx.state
    ├── logic.js                                  # pure explain(feature, config)
    └── tests/thermalExplain.spec.js              # 4 @unit tests
```

---

## 3. Where the system resisted me

**The core resistance: overriding one operation REPLACES it wholesale — there is
no super-call, and "declare only what differs" holds across operations but not
within one.**

Inheritance is per-operation. `mergeSurface`
(`src/essence/Basics/Layers_/registry/typeInheritance.js:29-33`):

```js
export function mergeSurface(parent, own) {
    if (own === undefined) return parent
    if (!_isModule(parent) || !_isModule(own)) return own
    return { ...parent, ...own }     // shallow: own.normalize fully replaces parent.normalize
}
```

So declaring `config: { normalize }` keeps the parent's `config.expand`
(good, and I tested it) — but my `normalize` **entirely replaces** vector's
`normalize`. And vector's `normalize`
(`plugins/core/layertypes/Vector/config.js:165-169`) does real work:

```js
function normalize(layerObj) {
    layerObj.kind = layerObj.kind || 'none'
    layerObj.radius = layerObj.style?.radius || layerObj.radius || 8
    return layerObj
}
```

If I override `normalize` and forget these, a `thermalinertia` layer silently
loses `kind`/`radius` — no error, just subtly wrong defaults (radius, and `kind`
feeds the legacy interaction pipeline). I had to hand-copy them
(`plugins/thermal-inertia/layertypes/ThermalInertia/thermalInertia.js:29-34`):

```js
function normalize(layerObj) {
    // Reproduced from vector.normalize because overriding replaces it.
    layerObj.kind = layerObj.kind || 'none'
    layerObj.radius = layerObj.style?.radius || layerObj.radius || 6
    return layerObj
}
```

The thing I *wanted* to express and could not: **"run the parent's `normalize`,
then also do X."** There is no handle for the parent operation. The obvious
workaround — import the parent module and delegate:

```js
import vectorConfig from '../../../core/layertypes/Vector/config'
function normalize(o) { return myExtra(vectorConfig.normalize(o)) }
```

— is worse than it looks: `Vector/config.js:1` does `import $ from 'jquery'` and
imports `F_`, so importing it makes **my** module pull jQuery and become
**un-importable in a Node unit test** (the scaffold's own contract test does
`import ThermalInertia from '../thermalInertia.js'`). So the choice is: duplicate
the parent's body (brittle — it drifts when core changes), or lose
unit-importability. I chose duplication and documented it in a code comment.
This is the single most valuable finding and it is a **core-design** property,
not a bug in my plugin.

Note the phase form (`{ before, main, after }`, layertypes/README.md:589-626)
does *not* rescue this: `before`/`after` wrap `main`-or-core-default, and
providing `main` is still a full replace of the *core* default — but here the
"default" I want to keep is the **parent plugin's** operation, not core's, and
the phase form gives no access to it.

Secondary resistance: **no way to call another plugin's operation** (by design —
layerattachments/README.md, layertypes/README.md:400 "no way to *call* another
plugin's operations"). This is stated and I agree with it, but combined with the
above it means the *only* sanctioned inter-plugin data path is "leave something
behind and read it," which pushed all my real logic into the shared `lib/`.

---

## 4. The seams between the families

**The fact my layer type knows and its siblings do not:** the property names
`temp_day` / `temp_night` and the model constant `scale`. The attachment needs
them to shade; the interaction needs them to explain; the type is where they are
*known*.

**How it got there — declaratively, exactly as documented.** The type declares
them once (`layertypes/ThermalInertia/plugin.json:12-31`):

```json
"capabilities": {
    "defaultAttachments": {
        "thermal_shade": { "dayTempProp": "temp_day", "nightTempProp": "temp_night", "scale": 1000, "min": 0, "max": 2000 }
    },
    "defaultInteractions": {
        "click": { "thermal:explain": { "dayTempProp": "temp_day", "nightTempProp": "temp_night", "scale": 1000 } }
    }
}
```

Core resolves each block into the *sibling's own* `configPath` and hands it back
as `ctx.config`; the sibling reads `ctx.config` and never learns whether the
type or an admin filled it. The attachment
(`layerattachments/ThermalShade/thermalShade.js`) and interaction
(`interactions/ThermalExplain/logic.js`) both do `config.dayTempProp ||
DEFAULTS.dayTempProp`. This is precisely the pattern the docs prescribe
(layertypes/README.md:373-400 and :454-497; layerattachments/README.md:86-92),
including the explicit warning **not** to have the type write into the
attachment's subtree. **I did not invent this — the docs told me to, and clearly.**

**What I *did* invent (nothing told me to):**
- The shared `lib/thermalInertia.js` module and importing it relatively. The
  README mentions a `lib/` convention (plugins/README.md:349-361) but the model
  itself, its function shape, and the decision to keep it dependency-free were
  mine.
- The exact `configPath` field names (`dayTempProp`, `nightTempProp`, `scale`,
  `min`, `max`). **Nothing enforces that the string the type declares matches
  the string the sibling reads** — see §5.

---

## 5. Anything that failed silently (green validation, nothing happens)

1. **The seam has no key-level contract.** The type declares
   `defaultAttachments.thermal_shade.dayTempProp` and the attachment reads
   `config.dayTempProp`. These agree only because I typed the same string in two
   files. `validate` cross-checks the *id* `thermal_shade` exists and that its
   `applicableLayerTypes` accept my type (confirmed by
   `tests/unit/pluginCliE2e.spec.js:805-897`), but it does **not** check the
   settings *keys*. A typo (`dayTemProp`) → the attachment silently falls back to
   the default `temp_day`, colours look plausible, nothing errors. Green
   validate, wrong-but-not-obviously-wrong picture. This is the most dangerous
   silent failure because it hides *inside* the feature working "well enough."

2. **"valid but absent from the registry" is a warning, not a failure.** When a
   plugin is on disk but not in the generated `src/pre/layertypes.js` (e.g. you
   added a module key and didn't re-run `activate`), `validate` prints
   `⚠ … valid but absent from src/pre/layertypes.js — the app will not load it`
   and still concludes with a green "valid" line. A reader scanning for the ✓
   will think they are done; the plugin simply never loads. The docs do warn
   about this (plugins/README.md:335-347 "You're not done when validate passes"),
   so the *concept* is documented — but the CLI output itself invites the
   misread.

3. **Overriding `normalize` and dropping `kind`/`radius`** (§3) is a silent
   failure of exactly this kind: no error, just missing defaults.

---

## 6. Confusing / missing / contradictory docs (with file:line)

1. **The `normalize`-replaces-parent footgun is undocumented.**
   `plugins/core/layertypes/README.md:86-95` explains that inheritance is
   per-operation and that adding `config.normalize` "keeps the parent's
   `config.expand`" — framed entirely as *what you keep*. It never says that
   your `normalize` **fully replaces** the parent's `normalize`, so anything the
   parent's `normalize` established (vector sets `kind`/`radius`,
   `Vector/config.js:165-169`) is silently lost. A reader following "declare only
   what differs" will assume additive behaviour within the operation too. This is
   the doc gap behind the §3 resistance and the §5.3 silent failure.

2. **Two test entrypoints; the task/AGENTS one does not run plugin tests.**
   `package.json` defines `test:unit` = `playwright test tests/unit` (core only)
   and `test:plugins:unit` = `playwright test plugins --grep @unit`. The plugin
   READMEs correctly say "run `npm run test:plugins:unit`"
   (e.g. `plugins/core/layertypes/README.md` test scaffold header;
   `plugins/core/interactions/README.md:170-180`), but the round instructions
   and `AGENTS.md` steer toward `test:unit`. A plugin author who runs `test:unit`
   sees green having executed **zero** of their plugin's tests. Not contradictory
   in the docs themselves, but a real trap where the two layers of guidance
   diverge.

3. **Two `defaultIcon` icon systems, silent fallback.**
   `plugins/README.md:682-686`: tools/components use MDI names, but **layer
   types are drawn with MUI icons** resolved via
   `configure/src/core/layerTypeVisuals.js`, and "a name that isn't in that map —
   including any MDI name — silently falls back to the generic layers icon." I
   picked `Polyline` (in the MUI map) deliberately; an author who reads only the
   `defaultIcon` default (`"puzzle-outline"`, an MDI name) and copies it will get
   a silent fallback for a layertype. Documented, but the default value itself is
   a trap for the layertype case.

4. **`activate` aborts globally on one invalid plugin** — behaviour not
   documented. See §6-experiment below; a single invalid extends-chain prevents
   registry regeneration for *every* plugin.

### The expected-to-fail experiment: a chain two deep

I created `ThermalInertiaPro` with `extends: "thermalinertia"` (which itself
extends `vector`). The failure is **loud and legible in three places**:

1. **CLI refuses at creation:**
   ```
   $ npm run plugins -- create layertype ThermalInertiaPro --container thermal-inertia --extends thermalinertia
   'thermalinertia' itself extends another type — inheritance is one level only.
   ```
   (`plugin-cli/cli.js:2041-2043`.) So the documented path never lets you make
   one.

2. **`validate` hard-errors (exit 1)** for a hand-written one:
   ```
   ✗ Layer type 'thermalinertiapro': extends 'thermalinertia', which itself
     extends 'vector' — inheritance is one level only
   1 error(s) across 62 plugin(s). 62 passed.
   ```
   (`API/pluginValidation.js:1811-1815`, `validateLayerTypeInheritance`.)

3. **Runtime would have been silent, but it never gets there.** Had it loaded,
   `LayerTypeRegistry._effectiveModules`
   (`src/essence/Basics/Layers_/registry/LayerTypeRegistry.js:73-83`) resolves the
   parent via `_ownModules(parentId)` — the parent's **own** modules only, not
   the parent's *effective* (inherited) modules. So a grandchild would inherit
   `thermalinertia`'s `{ config: { normalize } }` but **not** vector's renderer →
   no `make` → the layer would silently never draw. This is exactly the
   silent-failure class the one-level rule exists to prevent, and it is caught
   upstream instead.

**One real gotcha found here:** `activate` does not skip the offender — it
**aborts entirely**:
```
Failed to activate frontend plugins: Layer type 'thermalinertiapro': extends
'thermalinertia', which itself extends 'vector' — inheritance is one level only
```
So a single broken chain-two-deep type blocks registry regeneration for **every**
plugin in the install until it is removed. I deleted the experiment before
committing; the branch contains no `ThermalInertiaPro`.

---

## 7. What I liked, and what was easier than expected

- **`create … --extends vector` is excellent.** It scaffolds a surface-keyed
  single module (not a renderer's `map.js`), a **passing** contract test, and it
  **validates the parent as you type** — a `typeId` no plugin provides, or one
  that itself extends, is refused immediately (`plugin-cli/cli.js:2041-2043`)
  rather than left for `validate`. The scaffold *is* the tutorial.
- **The declarative seam is genuinely elegant.** Three plugins agreed on a
  property name with **zero cross-imports and no runtime lookup** — the type
  declares, core resolves, siblings read `ctx.config`. Easier and cleaner than I
  expected; I braced for a registry-lookup dance and there wasn't one.
- **`mergeSurfaces` is exported as a pure function** with no registry
  dependency, so I could unit-test the exact "sibling preserved" property against
  the real core code, in Node, without a browser. That the inheritance rule was
  deliberately factored out for testability (its own file header says so) made
  the round's "verify by test" instruction trivial to satisfy honestly.
- **The "read Leaflet from `window.L` per call" convention** (documented in the
  attachment scaffold) kept every module Node-importable, which is what made 13
  real unit tests possible at all.

---

## 8. Top 3 recommendations, ranked

1. **Make "extend one operation" additive, or warn loudly when it isn't.**
   Today, overriding `config.normalize` silently discards the parent plugin's
   `normalize` body (§3, §5.3, §6.1). Either (a) give a child a handle to the
   parent operation (a `super`-like `ctx.parent.normalize(layerObj)`), so it can
   *wrap* rather than *replace*; or (b) at minimum, have `validate` warn when a
   child overrides an operation whose parent version exists, nudging the author
   to confirm they meant to replace it. And document the replace semantics in
   `layertypes/README.md:86-95`, which currently only describes what you keep.

2. **Give the cross-family seam a key-level contract.** `validate` already
   cross-checks ids and `applicableLayerTypes` between a type and its declared
   attachments/interactions (`tests/unit/pluginCliE2e.spec.js:805-897`); extend
   that to the *settings keys* — warn when a `defaultAttachments` /
   `defaultInteractions` block names a field the target plugin's `config.rows`
   never declares. That closes the silent-typo failure in §5.1, which is the most
   dangerous because it degrades gracefully into a plausible-but-wrong result.

3. **Fix `activate`'s blast radius and unify the test entrypoint.** (a) One
   invalid extends-chain aborts `activate` for *all* plugins (§6); it should skip
   the offender, emit its error, and regenerate the rest. (b) Fold plugin `@unit`
   tests into `npm run test:unit` (or align the task/AGENTS guidance with the
   plugin READMEs), so an author running the "obvious" command doesn't get a
   green result having executed none of their tests (§6.2).
