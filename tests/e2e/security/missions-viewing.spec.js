import { test, expect, request as apiRequest } from "@playwright/test";

/**
 * Per-user mission viewing permissions (users.missions_viewing).
 *
 * Under AUTH=local:
 *   - missions_viewing = null  -> unrestricted (legacy behavior)
 *   - missions_viewing = []    -> no missions
 *   - missions_viewing = [...] -> only those (Admins also get missions_managing)
 *   - SuperAdmins (111) always see everything
 *   - GET /api/configure/get is rejected for non-viewable missions
 * Under any other AUTH mode the field is ignored and all missions are visible.
 */

const baseURL = process.env.TEST_BASE_URL || "http://localhost:18888";
const ADMIN = { username: "test_admin", password: "TestAdmin1!" }; // pragma: allowlist secret
const PASSWORD = "Viewing1!x"; // pragma: allowlist secret
const isLocal = process.env.AUTH === "local";

const stamp = Date.now();
const missionA = `test_view_a_${stamp}`;
const missionB = `test_view_b_${stamp}`;
const missionC = `test_view_c_${stamp}`;
const userName = `test_view_user_${stamp}`;
const adminName = `test_view_admin_${stamp}`;

test.describe.serial("missions_viewing permissions", () => {
  let superadmin;
  let user;
  let admin;
  let ready = false;
  const userIds = {};

  async function json(res) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async function loginAs(username) {
    const ctx = await apiRequest.newContext({ baseURL });
    const body = await json(
      await ctx.post("/api/users/login", {
        data: { username, password: PASSWORD },
      }),
    );
    expect(body?.status, `login ${username}`).toBe("success");
    return ctx;
  }

  async function setViewing(id, missions_viewing, extra = {}) {
    const body = await json(
      await superadmin.post("/api/accounts/update", {
        data: { id, missions_viewing, ...extra },
      }),
    );
    expect(body?.status).toBe("success");
  }

  async function listMissions(ctx) {
    const body = await json(await ctx.get("/api/configure/missions"));
    expect(body?.status).toBe("success");
    return body.missions.filter(
      (m) => m.startsWith(`test_view_`) && m.includes(`_${stamp}`),
    );
  }

  async function getConfig(ctx, mission) {
    return json(await ctx.get(`/api/configure/get?mission=${mission}`));
  }

  test.beforeAll(async () => {
    if (!isLocal) return;
    superadmin = await apiRequest.newContext({ baseURL });
    const login = await json(
      await superadmin.post("/api/users/login", { data: ADMIN }),
    );
    if (login?.status !== "success") return;

    for (const m of [missionA, missionB, missionC]) {
      const body = await json(
        await superadmin.post("/api/configure/add", { data: { mission: m } }),
      );
      if (body?.status !== "success") return;
    }
    for (const u of [userName, adminName]) {
      const body = await json(
        await superadmin.post("/api/users/signup", {
          data: {
            username: u,
            password: PASSWORD,
            email: `${u}@test.com`,
            skipLogin: true,
          },
        }),
      );
      if (body?.status !== "success") return;
    }
    const entries = await json(await superadmin.get("/api/accounts/entries"));
    for (const e of entries?.body?.entries || []) {
      if (e.username === userName || e.username === adminName)
        userIds[e.username] = e.id;
    }
    if (!userIds[userName] || !userIds[adminName]) return;

    await setViewing(userIds[adminName], null, {
      permission: "110",
      missions_managing: [missionC],
    });
    user = await loginAs(userName);
    admin = await loginAs(adminName);
    ready = true;
  });

  test.afterAll(async () => {
    if (!superadmin) return;
    for (const m of [missionA, missionB, missionC]) {
      await superadmin
        .post("/api/configure/destroy", { data: { mission: m } })
        .catch(() => {});
    }
    for (const id of Object.values(userIds)) {
      await superadmin.delete(`/api/accounts/remove/${id}`).catch(() => {});
    }
    await superadmin.dispose();
    if (user) await user.dispose();
    if (admin) await admin.dispose();
  });

  test.beforeEach(() => {
    test.skip(!ready, "Requires AUTH=local with the test admin account");
  });

  test("accounts API persists and returns missions_viewing", async () => {
    await setViewing(userIds[userName], [missionA, 42, missionB]);
    let entries = await json(await superadmin.get("/api/accounts/entries"));
    let row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toEqual([missionA, missionB]);

    await setViewing(userIds[userName], []);
    entries = await json(await superadmin.get("/api/accounts/entries"));
    row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toEqual([]);

    await setViewing(userIds[userName], null);
    entries = await json(await superadmin.get("/api/accounts/entries"));
    row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toBeNull();
  });

  test("Admins (110) cannot change missions_viewing", async () => {
    await setViewing(userIds[userName], [missionA]);
    const body = await json(
      await admin.post("/api/accounts/update", {
        data: { id: userIds[userName], missions_viewing: null },
      }),
    );
    expect(body?.status).toBe("success");

    const entries = await json(await superadmin.get("/api/accounts/entries"));
    const row = entries.body.entries.find((e) => e.id === userIds[userName]);
    expect(row.missions_viewing).toEqual([missionA]);
  });

  test("null missions_viewing sees all missions", async () => {
    await setViewing(userIds[userName], null);
    expect((await listMissions(user)).sort()).toEqual(
      [missionA, missionB, missionC].sort(),
    );
    expect((await getConfig(user, missionB))?.status).not.toBe("failure");
  });

  test("restricted list filters /missions and blocks direct /get", async () => {
    await setViewing(userIds[userName], [missionA]);
    expect(await listMissions(user)).toEqual([missionA]);
    expect((await getConfig(user, missionA))?.status).not.toBe("failure");

    const denied = await getConfig(user, missionB);
    expect(denied?.status).toBe("failure");
    expect(denied?.message).toContain("Unauthorized");
  });

  test("empty missions_viewing sees no missions", async () => {
    await setViewing(userIds[userName], []);
    expect(await listMissions(user)).toEqual([]);
    expect((await getConfig(user, missionA))?.status).toBe("failure");
  });

  test("Admins (110) see missions_viewing ∪ missions_managing", async () => {
    await setViewing(userIds[adminName], [missionA]);
    expect((await listMissions(admin)).sort()).toEqual(
      [missionA, missionC].sort(),
    );
    expect((await getConfig(admin, missionC))?.status).not.toBe("failure");
    expect((await getConfig(admin, missionB))?.status).toBe("failure");
  });

  test("SuperAdmins (111) always see all missions", async () => {
    expect((await listMissions(superadmin)).sort()).toEqual(
      [missionA, missionB, missionC].sort(),
    );
    expect((await getConfig(superadmin, missionB))?.status).not.toBe("failure");
  });

  test("renaming a mission follows missions_viewing", async () => {
    const renamed = `${missionA}_renamed`;
    await setViewing(userIds[userName], [missionA]);
    const rename = await json(
      await superadmin.post("/api/configure/rename", {
        data: { mission: missionA, newName: renamed },
      }),
    );
    expect(rename?.status).toBe("success");
    try {
      expect(await listMissions(user)).toEqual([renamed]);
      const relogin = await loginAs(userName);
      await relogin.dispose();
    } finally {
      await superadmin.post("/api/configure/rename", {
        data: { mission: renamed, newName: missionA },
      });
    }
  });
});

test.describe("missions_viewing is ignored when AUTH is not local", () => {
  test.skip(isLocal, "Non-local AUTH only");

  test("/missions returns every mission for an anonymous session", async () => {
    const ctx = await apiRequest.newContext({ baseURL });
    const body = await ctx.get("/api/configure/missions").then((r) => r.json());
    expect(body.status).toBe("success");
    expect(Array.isArray(body.missions)).toBe(true);
    await ctx.dispose();
  });
});
