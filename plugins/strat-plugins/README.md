# strat-plugins — stratigraphic columns at outcrops

One feature, four plugins:

| plugin | family | id |
|---|---|---|
| `layertypes/StratColumn` | layertype | `stratcolumn` (extends `vector`) |
| `layerattachments/StratColumnBars` | layerattachment | `strat_column_bars` — shipped *configured* by the type |
| `layerattachments/StratUnitLabels` | layerattachment | `strat_unit_labels` — an admin turns it on |
| `interactions/StratSection` | interaction | `strat:section` — shipped configured by the type |
| `lib/unitTable.js` | shared module | parses/stacks the unit table; the only thing all four agree on |

## The seam that is not declarative

`capabilities.defaultAttachments` / `defaultInteractions` carry what a *manifest
author* knows — `depthProp`, a bar width. They cannot carry what an *admin*
types, and the central fact of this feature is exactly that: the unit-colour
table (`variables.stratColumn.unitTable`).

Both attachments therefore read the layer type's own subtree off `ctx.layerObj`:

```js
// lib/unitTable.js
export const UNIT_TABLE_PATH = ['stratColumn', 'unitTable']
export function unitsOfLayer(layerObj) { … }
```

`plugins/core/layerattachments/README.md:80` says "**Never read the host's config
directly** — core resolves `configPath` for you". We are not reading *our*
config that way; we are reading another plugin's, which the docs do not cover and
which `plugins/README.md:370` ("a plugin owns its subtree and should not write
another's") only forbids *writing*. It is the string-literal coupling the
`defaultAttachments` feature was introduced to remove, reappearing because the
value is runtime rather than manifest-time. See the round-6 report.

The one genuinely declarative cross-plugin fact here is `strat_column_bars`'
geometry: `StratUnitLabels` declares `capabilities.host.buildsAfterSiblings` and
reads `ctx.siblings.strat_column_bars._opts`, which the attachment README's
"anything else … is yours verbatim" contract does support.
