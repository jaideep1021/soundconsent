import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { createApp } from "./app.js";
import type { Config } from "./config.js";
import { PostgresDatabase } from "./postgres.js";
import { JsonStore } from "./store.js";
import { AuditLog } from "./audit.js";

const url = process.env.POSTGRES_TEST_URL;
test("Postgres shares auth across instances, commits atomically, and survives restarts", { skip: !url }, async () => {
  if (!new URL(url!).pathname.endsWith("_test")) throw new Error("Use a dedicated database whose name ends in _test");
  const pool = new Pool({ connectionString: url! });
  const db = new PostgresDatabase(url!);
  const other = new PostgresDatabase(url!);
  const config: Config = { databaseUrl: url!, port: 3001, dataDir: "/unused", stateFile: "/unused/state.json", auditFile: "/unused/audit.jsonl",
    logLevel: "silent", secureCookies: true, corsOrigins: ["https://frontend.example.test"],
    bootstrapEmail: "admin@example.test", bootstrapPassword: "test-only-password", approvedVersions: {},
    coordinatorApiKey: "", geminiApiKey: "", geminiModel: "", geminiEmbeddingModel: "",
    elevenLabsApiKey: "", elevenLabsVoiceId: "", elevenLabsToolApiKey: "", elevenLabsAgentId: "", publicBaseUrl: "" };
  const apps: Awaited<ReturnType<typeof createApp>>[] = [];
  try {
    await db.init();
    await pool.query("TRUNCATE soundconsent_audit");
    await pool.query("UPDATE soundconsent_state SET data = $1::jsonb, audit_head = 'GENESIS' WHERE id = 1", [JSON.stringify({ schemaVersion: 1, documents: [], sessions: [] })]);
    const [a,b] = await Promise.all([createApp({ config }),createApp({ config })]); apps.push(a,b);
    a.addHook("preSerialization", async (request, _reply, payload) => {
      if (request.headers["x-test-failure"] === "yes") throw new Error("test response failure");
      return payload;
    });
    const failedLogin = await a.inject({method:"POST",url:"/auth/login",headers:{origin:config.corsOrigins[0]!,"x-test-failure":"yes"},payload:{email:config.bootstrapEmail,password:config.bootstrapPassword}});
    assert.equal(failedLogin.statusCode,500);
    assert.equal(failedLogin.headers["set-cookie"],undefined);
    assert.equal((await pool.query("SELECT data FROM soundconsent_state WHERE id=1")).rows[0].data.auth.grants.length,0,"failed response must roll back the login grant");
    const login = await a.inject({ method:"POST", url:"/auth/login", headers:{origin:config.corsOrigins[0]!}, payload:{email:config.bootstrapEmail,password:config.bootstrapPassword} });
    assert.equal(login.statusCode,200,login.body);
    assert.match(String(login.headers["set-cookie"]), /HttpOnly; SameSite=Strict;.*Secure/);
    const cookie = String(login.headers["set-cookie"]).split(";")[0]!;
    const headers = {cookie,origin:config.corsOrigins[0]!};
    const checks = await Promise.all(Array.from({length:10},(_,i) => (i%2?a:b).inject({url:"/auth/me",headers})));
    for (const result of checks) assert.equal(result.statusCode,200,result.body);
    const accounts = await b.inject({url:"/auth/accounts",headers});
    assert.equal(accounts.json().accounts.length,1,"concurrent bootstrap must create one admin");
    const changes = await Promise.all([a,b].map((app,i) => app.inject({method:"POST",url:`/studies/study${i}/settings`,headers,
      payload:{revision:0,maxAttempts:2,reminderDays:7,notificationsEnabled:true}})));
    for (const change of changes) assert.equal(change.statusCode,200,change.body);
    for (const i of [0,1]) assert.equal((await a.inject({url:`/studies/study${i}/settings`,headers})).json().revision,1);
    const races = await Promise.all([a,b].map(app => app.inject({method:"POST",url:"/studies/study0/settings",headers,
      payload:{revision:1,maxAttempts:3,reminderDays:7,notificationsEnabled:true}})));
    assert.deepEqual(races.map(r=>r.statusCode).sort(),[200,409]);
    await other.init();
    const store = new JsonStore("/unused",db); const audit = new AuditLog("/unused",db);
    const oldHead = (await pool.query("SELECT audit_head FROM soundconsent_state WHERE id=1")).rows[0].audit_head;
    await assert.rejects(db.transaction(async () => {
      await store.saveElevenLabsAgentId("must-rollback");
      await audit.append("test.rollback",{});
      throw new Error("simulated failure");
    }),/simulated failure/);
    await other.transaction(async () => {
      assert.equal(new JsonStore("/unused",other).getElevenLabsAgentId(),undefined);
      assert.equal(other.current().auditHead,oldHead);
      await new AuditLog("/unused",other).init();
    });
    const c = await createApp({config}); apps.push(c);
    assert.equal((await c.inject({url:"/auth/me",headers})).statusCode,200,"cold instance must recognize the cookie");
    assert.equal((await b.inject({method:"POST",url:"/auth/logout",headers})).statusCode,200);
    assert.equal((await a.inject({url:"/auth/me",headers})).statusCode,401,"logout must revoke across instances");
    await pool.query("UPDATE soundconsent_audit SET payload = '{}' WHERE id = (SELECT min(id) FROM soundconsent_audit)");
    await assert.rejects(createApp({config}),/audit/);
  } finally {
    await Promise.all(apps.map(app=>app.close()));
    await db.close(); await other.close(); await pool.end();
  }
});
