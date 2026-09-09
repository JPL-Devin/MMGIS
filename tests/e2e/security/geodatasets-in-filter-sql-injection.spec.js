import { test, expect, request as apiRequest } from "@playwright/test";

/**
 * Regression tests for SQL injection through the `in` filter operator of
 * GET /api/geodatasets/get (reachable without a session in every AUTH mode).
 *
 * Each `$`-separated value used to be embedded in the *name* of a Sequelize
 * replacement placeholder. Sequelize only consumes `\w+` of a placeholder
 * name, so the remainder of the value landed verbatim in the SQL. The classic
 * boolean oracle was: `abc$abc) OR (SELECT 1)=1 --` returned every row while
 * `abc$abc) OR (SELECT 1)=0 --` returned none.
 *
 * Requires an admin session to create the fixture dataset (AUTH=local via
 * global-setup); skips gracefully when unavailable. Under AUTH=local anonymous
 * requests get the login page, so reads reuse the same session — the query
 * construction under test is identical either way.
 */

test.describe.serial("Geodatasets `in` filter — SQL injection", () => {
  const baseURL = process.env.TEST_BASE_URL || "http://localhost:18888";
  const layerName = `test_in_sqli_${Date.now()}`;

  let api;
  let adminReady = false;

  const feature = (properties) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [-122.42, 37.78] },
    properties,
  });

  test.beforeAll(async () => {
    api = await apiRequest.newContext({ baseURL });

    await api
      .post("/api/users/login", {
        data: { username: "test_admin", password: "TestAdmin1!" }, // pragma: allowlist secret
      })
      .catch(() => {});

    const create = () =>
      api.post("/api/geodatasets/recreate", {
        data: {
          name: layerName,
          geojson: JSON.stringify({
            type: "FeatureCollection",
            features: [
              feature({ name: "alpha", n: 1 }),
              feature({ name: "beta", n: 2 }),
              feature({ name: "gamma", n: 3 }),
            ],
          }),
        },
      });

    for (let attempt = 0; attempt < 3 && !adminReady; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 500 * attempt));
      const createData = await create()
        .then((res) => res.json())
        .catch(() => null);
      adminReady = !!createData && createData.status === "success";
    }
  });

  test.afterAll(async () => {
    if (adminReady) {
      await api.delete(`/api/geodatasets/remove/${layerName}`).catch(() => {});
    }
    if (api) await api.dispose();
  });

  /** Query string filter format: key+op+type+value */
  async function getFeatures(key, type, value) {
    const filters = encodeURIComponent(`${key}+in+${type}+${value}`);
    const response = await api.get(
      `/api/geodatasets/get/${layerName}?type=geojson&filters=${filters}`,
    );
    expect(response.status()).not.toBe(500);
    const data = await response.json();
    return Array.isArray(data.features) ? data.features : [];
  }

  const names = (features) => features.map((f) => f.properties.name).sort();

  test("`in` matches only the listed values", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    expect(names(await getFeatures("name", "string", "alpha$gamma"))).toEqual([
      "alpha",
      "gamma",
    ]);
    expect(await getFeatures("name", "string", "nomatch")).toHaveLength(0);
  });

  test("boolean-oracle payloads are treated as literal values", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    const truthy = await getFeatures(
      "name",
      "string",
      "abc$abc) OR (SELECT 1)=1 --",
    );
    const falsy = await getFeatures(
      "name",
      "string",
      "abc$abc) OR (SELECT 1)=0 --",
    );
    expect(truthy).toHaveLength(0);
    expect(falsy).toHaveLength(0);
  });

  test("control/false/true placeholder-name payloads all return zero rows", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    const probes = [
      "ZZNOPE$ZZNOPE_ 7",
      "ZZNOPE$ZZNOPE) OR (SELECT 2)=3 LIMIT 1 -- ",
      "ZZNOPE$ZZNOPE) OR (SELECT 2)=2 LIMIT 1 -- ",
    ];
    for (const value of probes) {
      expect(await getFeatures("name", "string", value)).toHaveLength(0);
    }
  });

  test("injected UNION / stacked statements do not alter results", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    const payloads = [
      "x$x) UNION SELECT NULL --",
      "x$x); DROP TABLE users; --",
      "x$x) OR 1=1 --",
      "alpha$alpha') OR ('1'='1",
    ];
    for (const value of payloads) {
      const features = await getFeatures("name", "string", value);
      expect(names(features)).not.toContain("beta");
      expect(features.length).toBeLessThanOrEqual(1);
    }
  });

  test("numeric `in` filters still cast and match", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    const features = await getFeatures("n", "number", "1$3");
    expect(features.map((f) => f.properties.n).sort()).toEqual([1, 3]);
  });

  test("oversized `in` lists are capped rather than rejected", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    const list = ["alpha", ...Array(600).fill("x")].join("$");
    expect(names(await getFeatures("name", "string", list))).toEqual(["alpha"]);

    const long = `alpha$${"y".repeat(5000)}`;
    expect(names(await getFeatures("name", "string", long))).toEqual(["alpha"]);
  });

  test("numeric `in` with an injected value is not executed", async () => {
    test.skip(!adminReady, "SKIP: admin access unavailable");

    const features = await getFeatures("n", "number", "1$1) OR (SELECT 1)=1 --");
    expect(names(features)).not.toContain("beta");
  });
});
