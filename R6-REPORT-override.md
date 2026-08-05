# R6 — "Can a mission swap out core?" — third-party report

Branch: `devin/r6-override-1785954601` (off `devin/1785790516-finalize-layertype-plugins`)
Container: `plugins/r6-override/` (gitignored; committed with `git add -f`)
No core file (`src/`, `API/`, `configure/`, `plugin-cli/`) was modified.

---

## 1. What I built, and what actually works

**The feature:** a mission that renders `vector` layers with my implementation, plus a
click interaction (`vertex:probe`) that only makes sense on my type because it reads a
per-feature property my type stamps at make time.

**What it became:** a layertype `truevector` that `extends` core `vector`, and the
interaction. It is *not* a supersede of `vector` — see §3. Core `vector` cannot be
claimed, disabled, or shadowed by an external plugin.

| Claim | Status | Evidence |
|---|---|---|
| `npm run plugins -- validate` passes | yes | 60/60 manifests valid; one pre-existing warning (`core/interactions/ChemistryUse` → missing `core/tools/ChemistryTool`) |
| `npm run plugins -- activate` regenerates registries | yes | `src/pre/layertypes.js` gains `'truevector'`, `src/pre/interactions.js` gains `vertex:probe`, `APPLICABLE_LAYER_TYPES`, `INTERACTION_CONFIG_PATHS` |
| Unit tests | yes | 12 plugin tests pass; `npm run test:unit` 1084 pass |
| Lint | yes | `NODE_ENV=test npx eslint plugins/r6-override` clean |
| **A `truevector` layer renders in a browser** | **NO — it silently renders nothing** | see §5 |
| The interaction fires on a click | **untested** — the layer never draws, so there is nothing to click |
| Saving a `truevector` layer through the CMS | **NO — rejected by core** | see §3.4 |

I ran a real server (dev, `:8889`) against the Reference Mission with a duplicated
"Lines Basic" layer retyped to `truevector`. Result: the layer appears in the Layers
tool painted red with a `not-allowed` cursor and **no checkbox** (`layernotfound`),
nothing draws, and **no error or warning appears in the console**.

So: validate is green, activate is green, tests are green, lint is green, and the
feature does not work. That gap is the finding.

---

## 2. Files

### `plugins/r6-override/layertypes/TrueVector/`
- `plugin.json` — `typeId: "truevector"`, `extends: "vector"`, `tier: "community"`,
  `overridable: true`, `capabilities.map.stacking`, `capabilities.defaultInteractions.click["vertex:probe"]`,
  `supportedData`, `module: "./trueVector"`
- `trueVector.js` — single-module surface shape: `{ map: { make: { after(layerObj) } } }`,
  stamps `trueVectorVertexCount` on every feature
- `tests/trueVector.spec.js` — 6 tests (manifest contract, module shape, stamping for
  Point/Polygon, empty-data safety, the interaction settings it publishes)

### `plugins/r6-override/interactions/VertexProbe/`
- `plugin.json` — `interactionId: "vertex:probe"`, `applicableLayerTypes: ["truevector"]`,
  `applicableEvents: ["click"]`, `phase: "main"`, `order: 200`,
  `configPath: "variables.interactions.vertexProbe"`, Configure `config.rows`,
  `pluginDependencies: ["r6-override/layertypes/TrueVector"]`
- `VertexProbe.js` — `use(ctx)`; binds a popup
- `logic.js` — pure `decide(feature, config)` so the behaviour is unit-testable without
  MMGIS singletons
- `tests/vertexProbe.spec.js` — 6 tests (manifest contract, every config field under
  `configPath`, no-feature, stamped count, fallback count, settings arriving from the
  layertype's `defaultInteractions`)

### `plugins/r6-override/lib/`
- `vertices.js` — `VERTEX_COUNT_PROP` + `vertexCountOf(feature)`, shared by both plugins

### Repo root
- `R6-REPORT-override.md` (this file)

Generated files (`src/pre/layertypes.js`, `src/pre/interactions.js`,
`configure/public/*.json`) are gitignored on this branch and are not committed; they are
reproduced by `npm run plugins -- activate`.

---

## 3. Where the system resisted

### 3.1 Two plugins cannot claim one `typeId` — hard stop at activate

I renamed my plugin so it declared `"typeId": "vector"` with no `extends`.
`validate` had nothing to say. `activate` threw:

```
Duplicate typeId 'vector' declared by: Vector, TrueVector
```

from `API/updateTools.js` → `generateLayerRegistry()`:

```js
const duplicates = findDuplicateIds(
  Object.entries(registry).map(([name, manifest]) => ({ name, [idField]: manifest[idField] })),
  idField
);
if (duplicates.length > 0) { … throw new Error(messages.join("; ")); }
```

This is a good failure: loud, deterministic, at build time, and it names both owners.
It also means the documented "last-discovered plugin wins when names collide" rule in
`plugins/README.md` **does not apply to layer types** — the stable-ID check runs first
and refuses the build outright.

### 3.2 Same *name* collision does not override either — it does nothing

Second attempt: external plugin literally named `Vector` (`plugins/r6-override/layertypes/Vector/`)
with `typeId: "vector"`, hoping the "last discovered wins" name rule would let my
container replace core's plugin of the same name. `registerPlugin()` refuses:

```js
if (isOverride && registry[name].overridable === false) {
  logger("error", `${…} '${name}' is marked overridable:false and cannot be overridden by ${source}`, loggerCategory);
  return false;
}
```

and core `Vector`'s manifest is `"overridable": false`. The CLI printed
**"Frontend plugins activated. No changes."** and `src/pre/layertypes.js` still pointed
`vector` at core's modules. Core wins, deterministically. The refusal is logged by the
API logger, but the CLI's summary line said "No changes" — I had to diff the generated
file to learn that my plugin had been dropped.

### 3.3 Core cannot be disabled to make room

```
$ npm run plugins -- disable core/layertypes/Vector
Cannot disable core plugin 'core/layertypes/Vector'.
```

So the escape hatch of "turn core's off, turn mine on" does not exist for layer types.
`overridable: false` is doing three jobs at once (no name override, no disable, no
destroy) and there is no per-mission dimension to any of them: **there is no way for one
mission to use a different implementation of a type than another mission.** `tier` and
`priority` had no observable effect on layer-type precedence in any experiment — I found
no code path where a layertype's `tier` or `priority` is compared against another's.

### 3.4 Even a *distinct* type cannot be saved into a mission

Having given up on `vector` and settled for `truevector`, the CMS refused the config:

```
POST /api/configure/upsert
{"status":"failure","valid":false,
 "errors":[{"reason":"Unknown layer type: 'truevector'","invalidFields":["layers[layer].type"]}]}
```

`plugins/core/backend/Config/validate.js:82-112` is a hardcoded `switch (layer.type)`
over the built-in types with

```js
default:
  errs = errs.concat(err(`Unknown layer type: '${layer.type}'`, ["layers[layer].type"]));
```

and `configure/src/core/validators.js:177-181` has the same hardcoded switch on the
frontend. Neither consults the generated layer-type registry, which is right there in
`configure/public/layerTypeConfigs.json`.

**This is the single most valuable finding: a third-party layer type can be authored,
validated, activated and imported into the bundle, but a mission cannot be saved that
uses it.** The plugin system's front door is open and its back door is nailed shut. I
could only get a `truevector` layer in front of a browser by bypassing the CMS entirely
with `FORCE_CONFIG_PATH=Missions/Reference-Mission/r6config.json` — which is exactly the
"something I suspect is wrong" the brief asked about. No core change was needed for that,
but no mission operator would accept it.

### 3.5 `make.after` cannot be added without redefining `make`

`plugins/core/layertypes/README.md:86-95` says resolution is "per operation, not per
surface", which I read as: declare `map.make.after`, keep the parent's `map.make.main`.
It is not. `src/essence/Basics/Layers_/registry/typeInheritance.js:28-32`:

```js
export function mergeSurface(parent, own) {
    if (own === undefined) return parent
    if (!_isModule(parent) || !_isModule(own)) return own
    return { ...parent, ...own }          // ← one level: surface → operation
}
```

`make` **is** the operation. My `map.make = { after }` replaces Vector's `make` whole,
phases included, so `main` disappears. There is no documented way for an extending type
to add a phase to an operation it wants to keep; the only route is to re-declare `main`
and delegate by hand to `LayerTypeRegistry.get('vector').map.make.main`, which the docs
never mention and which defeats the "declare only what differs" promise for the one
operation authors are most likely to want to wrap.

---

## 4. The seams between the families

The fact my layertype knows and the interaction needs: **the name of the feature property
holding the vertex count** (`trueVectorVertexCount`), and the label property to display.

The route it travels, all of it documented:

1. `TrueVector/plugin.json` declares
   `capabilities.defaultInteractions.click["vertex:probe"] = { property, vertexCountProp }`
   — the layertype README's "default interactions" section.
2. Core normalizes that (`registry/interactionDefaults.js`) and resolves it into the
   interaction's own `configPath` (`variables.interactions.vertexProbe`), which
   `VertexProbe/plugin.json` declares.
3. The interaction reads `ctx.config.vertexCountProp` — never the layertype's manifest.
4. The stamped value is written by the layertype in `map.make.after`.

That is a genuinely good seam: the layertype states the contract, core carries it, the
interaction consumes it through its own config, and a mission can retune either end in
Configure without touching code. I did not have to invent it.

What I *did* invent, because nothing suggested otherwise, is `plugins/r6-override/lib/vertices.js`
— a plain module both plugins import relatively so the property name and the counting
function have exactly one definition. `plugins/README.md` blesses "one feature, several
plugins" but says nothing about shared code between them; there is no `lib/` convention,
no path alias, and `validate` neither knows nor cares that the file exists.

The seam that is **missing** is the one in §3.4: nothing carries the set of known
`typeId`s to the config validators, so the families agree with each other and disagree
with core's own gatekeeper.

---

## 5. What failed silently

**The main event.** A `truevector` layer, with everything green, draws nothing and says
nothing.

`Map_.js:779-782` resolves `make.main`; because inheritance dropped it (§3.5) it is
`null`, and `Map_.js:809-815` reads that as "this type is globe-only":

```js
} else if (rt) {
    // A registered type with no map renderer is globe-only
    // (e.g. model, 3dtiles). Nothing to draw on the 2D map;
    // mark it loaded so allLayersLoaded() can resolve.
    L_._layersLoaded[…] = true
    allLayersLoaded()
} else {
    console.warn('Unknown layer type: ' + layerObj.type)
}
```

The layer is marked **loaded**. Only a genuinely unregistered type gets the `console.warn`;
a registered type that renders nothing gets silence. Verified live over CDP:
`L_.layers.data[uuid].type === 'truevector'`, `L_.layers.on[uuid] === true`,
`L_.layers.layer[uuid] === undefined`, zero console errors.

Downstream, `LayersTool.js:1414` marks the row `layernotfound` when
`L_.layers.layer[name] == null`, and `LayersTool.css:705-714` paints it `#541d1d` with
`pointer-events: none` and no working checkbox. The user-visible symptom is "the layer is
broken", with no clue that the cause is an inheritance rule in a registry.

Two smaller silent ones:

- **"Frontend plugins activated. No changes."** after core refused my same-named plugin
  (§3.2). The refusal is logged through the API logger, not surfaced by the CLI. A
  plugin author sees a success line and an unchanged registry.
- The generated `layerTypeConfigs['truevector']` carries **no `capabilities.renderers`**
  (inheritance is applied at runtime by `LayerTypeRegistry.capabilities()`, not baked in).
  Anything that reads the generated JSON directly rather than going through the registry
  — Configure does — sees a type that renders nothing, and says nothing about it.

---

## 6. Docs: confusing, missing, contradictory

1. **`plugins/core/layertypes/README.md:86-95`** — "Resolution … happens **per operation,
   not per surface**" with the example "declaring a `config.normalize` keeps the parent's
   `config.expand`". Both true, but the sentence reads as though phases merge too. They
   do not (§3.5). It needs one explicit line: *an operation is replaced whole; declaring
   `make.after` drops the parent's `make.main`.*
2. **`plugins/core/layertypes/README.md:71-84`** — the `extends` example is a `source`
   type, the one case where the parent's operations genuinely are all kept. Every other
   shape of extension hits (1). A counter-example would be worth more than the example.
3. **`plugins/README.md`, "last-discovered plugin wins when names collide"** — contradicted
   for layer types by the duplicate-stable-ID throw (§3.1) and by `overridable: false`
   (§3.2). Nowhere does it say that **no core layer type is overridable**, which is the
   single fact a third-party author most needs before starting.
4. **No documentation anywhere of the CMS type whitelist** (§3.4). Neither `plugins/README.md`
   nor the layertypes README mentions that a new `typeId` must also be known to
   `plugins/core/backend/Config/validate.js` and `configure/src/core/validators.js`. From
   the docs, `create → validate → activate` reads as the complete path, and it isn't.
5. **`overridable`, `tier`, `priority`** are named in manifests but their precedence
   semantics are not specified in one place. I could only establish `overridable`'s
   behaviour by experiment; I never found a code path that reads `tier` or `priority`
   for layer-type precedence at all. If they are inert for layertypes, say so.
6. **Shared code between plugins of one feature is undocumented** (§4). No convention,
   no alias, no mention.

---

## 7. What I liked

- **The CLI is genuinely good.** `npm run plugins -- create layertype TrueVector --container r6-override --extends vector`
  scaffolds a manifest, a module and a test directory, and it validates `--extends`
  *as you type it* — a parent that itself extends, or doesn't exist, is refused at create
  time rather than left for `validate`. Being told "no" early is the nicest thing a
  scaffolder can do.
- **The manifest is the contract.** `applicableLayerTypes`, `applicableEvents`,
  `configPath`, `pluginDependencies`, and Configure's form rows all live in one JSON file,
  and `validate` checks all of them, including that every `config.rows` field sits under
  the declared `configPath`. I got that wrong once and was told exactly where.
- **`defaultInteractions` is the best idea in the system.** A layertype shipping the
  interaction it needs, pre-configured, and the mission still able to retune it, is a
  real answer to a hard coupling problem.
- **Testing was easier than expected.** Keeping the decision in a pure `logic.js` and
  importing the manifest in a spec meant 12 meaningful tests with no MMGIS bootstrap and
  no DOM.
- The duplicate-`typeId` error naming *both* owners saved me a debugging session.

---

## 8. Top 3 recommendations

**1. Make the config validators read the layer-type registry.**
`plugins/core/backend/Config/validate.js:82-112` and `configure/src/core/validators.js:143-181`
should switch on known `typeId`s from the generated registry (already emitted to
`configure/public/layerTypeConfigs.json`) with the per-type checks as an optional,
registry-declared extra, rather than a hardcoded `switch`. Until this lands, **no external
layer type can be used by any mission**, and everything else in the layertype plugin
family is unreachable. This is a small change with the largest possible payoff.

**2. Fail loudly when a registered type renders nothing.**
`Map_.js:809` should distinguish "declares no map renderer" (`capabilities.renderers.map === false`
— model, 3dtiles: correct, stay quiet) from "should have a map renderer and resolved
none" (warn, once, naming the type and the missing operation). Better still, have
`validate` catch it: an `extends`-ing type whose effective `map.make` has no `main` is a
build-time error, not a mystery at runtime. Green-everything-then-nothing is the worst
failure mode a plugin system can have.

**3. Decide what "supersede" means, then document it.**
Either (a) support per-mission type implementations — a mission config naming a provider
for a `typeId`, with core as the default — or (b) state plainly in `plugins/README.md`
that core types are final, that `overridable: false` means no override / no disable / no
same-`typeId` claim, and that the supported path is a **new** `typeId` that `extends`.
Today the manifests advertise `overridable`, `tier` and `priority` as though (a) exists
and the code implements (b). Whichever way it goes, also fix the `extends` phase-merge
doc (§3.5) and either make phases merge inside an operation or give authors a documented
way to call the parent's implementation.

---

## Getting back to a working state

Yes, trivially. Every experiment was contained in `plugins/r6-override/` plus a
regenerated registry: deleting the container and re-running `npm run plugins -- activate`
restores core exactly. Nothing I did could damage core `vector` — which is, in fairness,
precisely what `overridable: false` is for.
