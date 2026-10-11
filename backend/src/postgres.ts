import { AsyncLocalStorage } from "node:async_hooks";
import { Pool, type PoolClient } from "pg";
import { HttpError } from "./errors.js";
import { isDatabaseState } from "./store.js";
import type { DatabaseState } from "./types.js";

interface Transaction {
  client: PoolClient;
  state: DatabaseState;
  auditHead: string;
  finished: boolean;
}

/** A shared snapshot protected by a row lock for the duration of one request. */
export class PostgresDatabase {
  private readonly pool: Pool;
  private readonly context = new AsyncLocalStorage<Transaction>();
  constructor(url: string) {
    this.pool = new Pool({ connectionString: url, max: 2, connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 10000, allowExitOnIdle: true });
    // Idle connection failures must not crash the process. Active queries still fail closed.
    this.pool.on("error", () => {});
  }
  async init(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      // Concurrent cold starts must not race while creating schema objects.
      await client.query("SELECT pg_advisory_xact_lock(1936028275, 1)");
      await client.query(`CREATE TABLE IF NOT EXISTS soundconsent_state (
        id integer PRIMARY KEY CHECK (id = 1), data jsonb NOT NULL, audit_head text NOT NULL
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS soundconsent_audit (
        id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, payload text NOT NULL
      )`);
      await client.query(`INSERT INTO soundconsent_state (id, data, audit_head)
        VALUES (1, $1::jsonb, 'GENESIS') ON CONFLICT (id) DO NOTHING`,
        [JSON.stringify({ schemaVersion: 1, documents: [], sessions: [] })]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  current(): Transaction {
    const transaction = this.context.getStore();
    if (!transaction || transaction.finished) throw new Error("Postgres access requires an active request transaction");
    return transaction;
  }
  async begin(): Promise<Transaction> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SET LOCAL lock_timeout = '15s'");
      await client.query("SET LOCAL statement_timeout = '30s'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '240s'");
      const result = await client.query("SELECT data, audit_head FROM soundconsent_state WHERE id = 1 FOR UPDATE");
      const row = result.rows[0];
      if (!row || !isDatabaseState(row.data)) throw new Error("Invalid or missing Postgres state");
      return { client, state: row.data, auditHead: row.audit_head, finished: false };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      client.release(true);
      throw error;
    }
  }
  run<T>(transaction: Transaction, work: () => T): T { return this.context.run(transaction, work); }
  async finish(transaction: Transaction, commit: boolean): Promise<void> {
    if (transaction.finished) return;
    transaction.finished = true;
    try { await transaction.client.query(commit ? "COMMIT" : "ROLLBACK"); }
    catch (error) { transaction.client.release(true); throw error; }
    transaction.client.release();
  }
  async transaction<T>(work: () => Promise<T>): Promise<T> {
    const transaction = await this.begin();
    try {
      const result = await this.run(transaction, work);
      await this.finish(transaction, true);
      return result;
    } catch (error) {
      await this.finish(transaction, false);
      throw error;
    }
  }
  async save(state: DatabaseState): Promise<void> {
    const tx = this.current();
    await tx.client.query("UPDATE soundconsent_state SET data = $1::jsonb WHERE id = 1", [JSON.stringify(state)]);
    tx.state = state;
  }
  async appendAudit(payload: string, hash: string): Promise<void> {
    const tx = this.current();
    await tx.client.query("INSERT INTO soundconsent_audit (payload) VALUES ($1)", [payload]);
    await tx.client.query("UPDATE soundconsent_state SET audit_head = $1 WHERE id = 1", [hash]);
    tx.auditHead = hash;
  }
  async auditRecords(): Promise<string[]> {
    const result = await this.current().client.query("SELECT payload FROM soundconsent_audit ORDER BY id");
    return result.rows.map((row: { payload: string }) => row.payload);
  }
  async close(): Promise<void> { await this.pool.end(); }
}

export function databaseUnavailable(): HttpError {
  return new HttpError(503, "Shared storage is unavailable or busy. Please retry shortly.");
}
