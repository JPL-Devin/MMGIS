/**
 * FeatureKinship interaction — unit tests.
 */
import { test, expect } from "@playwright/test";
// Stubs window/document so the module can be imported in Node. Must come first.
// FeatureKinship.js itself imports L_ (and so jQuery), which cannot load in
// Node — the testable logic lives in kinship.js, which imports nothing.
import "../../../../../tests/helpers/browser-globals.js";
import { isKin, partitionKin } from "../kinship.js";
import {
  manifestOf,
  unresolvedModules,
} from "../../../../../tests/helpers/plugin-contract.js";

const manifest = manifestOf(__dirname);

const fakeLayer = (props) => ({
  feature: { properties: props },
  options: { color: "#ffffff", weight: 1, opacity: 1 },
  setStyle(s) {
    this.styled = s;
  },
});

test("plugin.json declares a valid interaction contract @unit", () => {
  expect(manifest.type).toBe("interaction");
  expect(manifest.interactionId).toBe("feature:kinship");
  expect(["preamble", "main", "postamble"]).toContain(manifest.phase);
  expect(manifest.applicableEvents.length).toBeGreaterThan(0);
  expect(Array.isArray(manifest.applicableLayerTypes)).toBe(true);
  expect(unresolvedModules(__dirname, manifest)).toEqual([]);
});

test("every config field sits inside configPath @unit", () => {
  manifest.config.rows.forEach((row) =>
    row.components.forEach((c) => {
      if (c.field) expect(c.field.startsWith(manifest.configPath)).toBe(true);
    }),
  );
});

test("isKin honors each match mode @unit", () => {
  expect(isKin("Jezero", "jezero", { matchMode: "exact" })).toBe(true);
  expect(
    isKin("Jezero", "jezero", { matchMode: "exact", caseInsensitive: false }),
  ).toBe(false);
  expect(isKin(10, 12, { matchMode: "numeric", tolerance: 3 })).toBe(true);
  expect(isKin(10, 14, { matchMode: "numeric", tolerance: 3 })).toBe(false);
  expect(
    isKin("SOL0123", "SOL0199", { matchMode: "prefix", tolerance: 4 }),
  ).toBe(true);
  expect(
    isKin("SOL0123", "SOL1199", { matchMode: "prefix", tolerance: 4 }),
  ).toBe(false);
  expect(isKin("crater", "Large crater rim", { matchMode: "contains" })).toBe(
    true,
  );
  expect(isKin(null, "x")).toBe(false);
});

test("partitionKin splits a layer by the configured property @unit", () => {
  const layers = [
    fakeLayer({ campaign: "A" }),
    fakeLayer({ campaign: "B" }),
    fakeLayer({ campaign: "A" }),
    fakeLayer({}),
  ];
  const { kin, others, clickedValue } = partitionKin(
    layers,
    { properties: { campaign: "A" } },
    { property: "campaign" },
  );
  expect(clickedValue).toBe("A");
  expect(kin.length).toBe(2);
  expect(others.length).toBe(2);
});

test("partitionKin supports dot paths and respects maxFeatures @unit", () => {
  const layers = [
    fakeLayer({ meta: { id: 7 } }),
    fakeLayer({ meta: { id: 7 } }),
    fakeLayer({ meta: { id: 7 } }),
  ];
  const { kin, others } = partitionKin(
    layers,
    { properties: { meta: { id: 7 } } },
    { property: "meta.id", maxFeatures: 2 },
  );
  expect(kin.length).toBe(2);
  expect(others.length).toBe(1);
});

test("partitionKin is a no-op without a configured property @unit", () => {
  const { kin } = partitionKin(
    [fakeLayer({ a: 1 })],
    { properties: { a: 1 } },
    {},
  );
  expect(kin.length).toBe(0);
});

test("partitionKin tolerates a missing feature or empty layer @unit", () => {
  expect(partitionKin([], null, { property: "a" }).kin).toEqual([]);
  expect(partitionKin(null, { properties: {} }, { property: "a" }).kin).toEqual(
    [],
  );
});
