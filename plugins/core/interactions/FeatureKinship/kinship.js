/**
 * Pure kinship logic — imports nothing from src/essence so it is unit testable
 * in Node (see tests/helpers/browser-globals.js).
 */
export const DEFAULTS = {
  property: null,
  matchMode: "exact",
  tolerance: 0,
  highlightColor: "#00ffc8",
  highlightWeight: 4,
  dimOpacity: 0.15,
  maxFeatures: 500,
  caseInsensitive: true,
};

const getIn = (obj, path) => {
  if (obj == null || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
};

const norm = (value, caseInsensitive) =>
  caseInsensitive && typeof value === "string" ? value.toLowerCase() : value;

/**
 * Whether a candidate value is "kin" to the clicked value under a match mode.
 * Pure — the unit tests drive this directly.
 */
export const isKin = (clickedValue, candidateValue, options = {}) => {
  const { matchMode, tolerance, caseInsensitive } = {
    ...DEFAULTS,
    ...options,
  };
  if (clickedValue == null || candidateValue == null) return false;

  switch (matchMode) {
    case "numeric": {
      const a = parseFloat(clickedValue);
      const b = parseFloat(candidateValue);
      if (isNaN(a) || isNaN(b)) return false;
      return Math.abs(a - b) <= Math.abs(parseFloat(tolerance) || 0);
    }
    case "prefix": {
      const a = String(norm(clickedValue, caseInsensitive));
      const b = String(norm(candidateValue, caseInsensitive));
      const n = parseInt(tolerance, 10);
      const len = n > 0 ? n : a.length;
      return a.slice(0, len) === b.slice(0, len);
    }
    case "contains": {
      const a = String(norm(clickedValue, caseInsensitive));
      const b = String(norm(candidateValue, caseInsensitive));
      return b.indexOf(a) !== -1;
    }
    case "exact":
    default:
      return (
        norm(clickedValue, caseInsensitive) ===
        norm(candidateValue, caseInsensitive)
      );
  }
};

/**
 * Splits a layer's features into kin / non-kin given the clicked feature.
 * `leafletLayers` is any array of objects carrying a `feature`.
 * Pure — no Leaflet calls.
 */
export const partitionKin = (leafletLayers, clickedFeature, options = {}) => {
  const opts = { ...DEFAULTS, ...options };
  const kin = [];
  const others = [];
  if (!opts.property) return { kin, others };
  const clickedValue = getIn(clickedFeature?.properties, opts.property);
  if (clickedValue == null) return { kin, others };

  const max = parseInt(opts.maxFeatures, 10) || DEFAULTS.maxFeatures;
  (leafletLayers || []).forEach((l) => {
    const value = getIn(l?.feature?.properties, opts.property);
    if (kin.length < max && isKin(clickedValue, value, opts)) kin.push(l);
    else others.push(l);
  });
  return { kin, others, clickedValue };
};
