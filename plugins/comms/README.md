# comms — communication windows over a surface asset

Three plugins, one feature:

| plugin | family | what it does |
|---|---|---|
| `GroundTrack` (`groundtrack`) | layertype (extends `vector`) | an orbiter ground track clipped to the mission clock's window; with no url it propagates a circular orbit from its `variables` |
| `VisibilityFootprint` (`visibility_footprint`) | layerattachment | a circle around each surface asset, sized from an elevation mask and the orbiter's altitude |
| `NextCommWindow` (`comms:next_window`) | interaction | clicking a track reports the next window over the clicked asset and offers to move the clock to its start |

`shared/comms.js` holds the geometry all three need. That file is this
container's own convention — the plugin docs describe no way for plugins of
different families to share code.

## The seams

- **Type → attachment.** `capabilities.defaultAttachments` is the documented way
  for a type to hand an attachment its settings, but it only reaches attachments
  of layers *of that type*. Here the footprint hangs off the **asset** layer,
  while the altitude that sizes it belongs to the **track** layer, so the
  mechanism does not apply. The host names the track layer
  (`…visibilityFootprint.trackLayerName`) and the attachment reads that peer
  layer's `variables.altitudeMeters` off `L_.layers.data`. Invented, not
  documented.
- **Attachment → interaction.** The interaction must draw the same circle the
  attachment drew, so it reads the attachment's own `configPath` subtree on the
  asset layer (`variables.layerAttachments.visibilityFootprint`) and lets its own
  settings override it. Also invented; the interaction docs explicitly say never
  to read *another interaction's* settings but say nothing about attachments.
