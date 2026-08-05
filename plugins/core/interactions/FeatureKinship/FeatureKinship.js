import L_ from "@basics/Layers_/Layers_";
import { DEFAULTS, partitionKin } from "./kinship";

const collect = (group) => {
  const out = [];
  if (!group) return out;
  const groups = Array.isArray(group) ? group : [group];
  groups.forEach((g) => {
    if (g && typeof g.eachLayer === "function")
      g.eachLayer((l) => {
        if (l && typeof l.eachLayer === "function")
          l.eachLayer((i) => out.push(i));
        else out.push(l);
      });
  });
  return out;
};

const remember = (l) => {
  if (l.__kinshipSaved) return;
  l.__kinshipSaved = {
    options: { ...(l.options || {}) },
    opacity: l.options?.opacity,
  };
};

const restore = (l) => {
  if (!l.__kinshipSaved) return;
  const saved = l.__kinshipSaved;
  delete l.__kinshipSaved;
  if (typeof l.setStyle === "function") l.setStyle(saved.options);
  else if (typeof l.setOpacity === "function" && saved.opacity != null)
    l.setOpacity(saved.opacity);
};

const clearAll = (layerName) => {
  collect(L_?.layers?.layer?.[layerName]).forEach(restore);
};

const style = (l, styleObj) => {
  remember(l);
  if (typeof l.setStyle === "function") l.setStyle(styleObj);
  else if (typeof l.setOpacity === "function" && styleObj.opacity != null)
    l.setOpacity(styleObj.opacity);
};

/**
 * FeatureKinship — clicking a feature highlights every other feature on the
 * same layer that shares a property value with it ("its kin") and dims the
 * rest, so a target name, campaign id or unit code becomes visible as a set
 * rather than one feature at a time.
 */
const FeatureKinship = {
  use(ctx) {
    const config = { ...DEFAULTS, ...(ctx.config || {}) };
    if (!ctx.feature) {
      clearAll(ctx.layerName);
      return;
    }
    if (!config.property) return;

    const leafletLayers = collect(L_?.layers?.layer?.[ctx.layerName]);
    const { kin, others, clickedValue } = partitionKin(
      leafletLayers,
      ctx.feature,
      config,
    );
    clearAll(ctx.layerName);
    if (clickedValue == null) return;

    others.forEach((l) =>
      style(l, {
        opacity: parseFloat(config.dimOpacity),
        fillOpacity: parseFloat(config.dimOpacity),
      }),
    );
    kin.forEach((l) =>
      style(l, {
        color: config.highlightColor,
        weight: parseFloat(config.highlightWeight),
        opacity: 1,
        fillOpacity: 0.6,
      }),
    );

    ctx.state.kinship = {
      property: config.property,
      value: clickedValue,
      count: kin.length,
    };
  },
};

export default FeatureKinship;
