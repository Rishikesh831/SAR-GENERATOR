const path = require("path");
const { Pool } = require("pg");
const sqlite3 = require("sqlite3");

const DEFAULT_SQLITE = path.join(__dirname, "..", "..", "data", "sar.db");

function getDbConfig() {
  const url = process.env.DATABASE_URL || process.env.NEON_DB_URL || "";
  const sqlitePath = process.env.SQLITE_PATH || DEFAULT_SQLITE;

  if (url.startsWith("postgresql://") || url.startsWith("postgres://")) {
    return { kind: "postgres", url };
  }

  return { kind: "sqlite", path: sqlitePath };
}

function buildSchemaSql(kind) {
  if (kind === "postgres") {
    return `
      CREATE TABLE IF NOT EXISTS transactions (
        transaction_id TEXT PRIMARY KEY,
        sender_account TEXT,
        receiver_account TEXT,
        amount DOUBLE PRECISION,
        currency TEXT,
        timestamp TIMESTAMPTZ,
        country TEXT,
        high_risk_country INTEGER,
        below_ctr_threshold INTEGER,
        raw JSONB
      );
    `;
  }

  return `
    CREATE TABLE IF NOT EXISTS transactions (
      transaction_id TEXT PRIMARY KEY,
      sender_account TEXT,
      receiver_account TEXT,
      amount REAL,
      currency TEXT,
      timestamp TEXT,
      country TEXT,
      high_risk_country INTEGER,
      below_ctr_threshold INTEGER,
      raw TEXT
    );
  `;
}

async function withPostgres(cb) {
  const pool = new Pool({ connectionString: getDbConfig().url });
  try {
    return await cb(pool);
  } finally {
    await pool.end();
  }
}

let sqliteConnection = null;

function getSqliteConnection() {
  if (sqliteConnection) {
    return sqliteConnection;
  }
  const config = getDbConfig();
  sqliteConnection = new sqlite3.Database(config.path);
  sqliteConnection.serialize(() => {
    sqliteConnection.run("PRAGMA journal_mode = WAL;");
    sqliteConnection.run("PRAGMA synchronous = NORMAL;");
    sqliteConnection.run("PRAGMA busy_timeout = 5000;");
  });
  return sqliteConnection;
}

function withSqlite(cb) {
  const db = getSqliteConnection();
  return cb(db);
}

async function ensureSchema() {
  const config = getDbConfig();
  const schemaSql = buildSchemaSql(config.kind);

  if (config.kind === "postgres") {
    await withPostgres(async (pool) => {
      await pool.query(schemaSql);
    });
    return;
  }

  await withSqlite(async (db) => {
    await new Promise((resolve, reject) => {
      db.exec(schemaSql, (err) => (err ? reject(err) : resolve()));
    });
  });
}

async function upsertTransactions(records) {
  if (!records.length) {
    return { inserted: 0 };
  }

  const config = getDbConfig();

  if (config.kind === "postgres") {
    return await withPostgres(async (pool) => {
      const insertSql = `
        INSERT INTO transactions (
          transaction_id, sender_account, receiver_account, amount,
          currency, timestamp, country, high_risk_country, below_ctr_threshold, raw
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
        )
        ON CONFLICT (transaction_id) DO UPDATE SET
          sender_account = EXCLUDED.sender_account,
          receiver_account = EXCLUDED.receiver_account,
          amount = EXCLUDED.amount,
          currency = EXCLUDED.currency,
          timestamp = EXCLUDED.timestamp,
          country = EXCLUDED.country,
          high_risk_country = EXCLUDED.high_risk_country,
          below_ctr_threshold = EXCLUDED.below_ctr_threshold,
          raw = EXCLUDED.raw;
      `;

      const client = await pool.connect();
      try {
        for (const row of records) {
          await client.query(insertSql, [
            row.transaction_id,
            row.sender_account,
            row.receiver_account,
            row.amount,
            row.currency,
            row.timestamp,
            row.country,
            row.high_risk_country,
            row.below_ctr_threshold,
            row.raw,
          ]);
        }
      } finally {
        client.release();
      }
      return { inserted: records.length };
    });
  }

  return await withSqlite(async (db) => {
    const insertSql = `
      INSERT INTO transactions (
        transaction_id, sender_account, receiver_account, amount,
        currency, timestamp, country, high_risk_country, below_ctr_threshold, raw
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(transaction_id) DO UPDATE SET
        sender_account = excluded.sender_account,
        receiver_account = excluded.receiver_account,
        amount = excluded.amount,
        currency = excluded.currency,
        timestamp = excluded.timestamp,
        country = excluded.country,
        high_risk_country = excluded.high_risk_country,
        below_ctr_threshold = excluded.below_ctr_threshold,
        raw = excluded.raw;
    `;

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        const stmt = db.prepare(insertSql);
        for (const row of records) {
          stmt.run([
            row.transaction_id,
            row.sender_account,
            row.receiver_account,
            row.amount,
            row.currency,
            row.timestamp,
            row.country,
            row.high_risk_country,
            row.below_ctr_threshold,
            row.raw,
          ], (err) => {
            if (err) {
              reject(err);
            }
          });
        }
        stmt.finalize((err) => (err ? reject(err) : resolve()));
      });
    });

    return { inserted: records.length };
  });
}

module.exports = {
  getDbConfig,
  ensureSchema,
  upsertTransactions,
};
