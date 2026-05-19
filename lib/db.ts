import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import fs from "node:fs";
import path from "node:path";

export const EMBEDDING_DIM = 1536; // text-embedding-3-small

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const file =
    process.env.SQLITE_PATH ?? path.join(process.cwd(), "data", "aresearch.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);

  // Apply schema.sql only on a fresh DB. The canonical DDL doesn't use
  // `IF NOT EXISTS`, so re-running on an already-populated DB would
  // throw "table already exists". Use the presence of `users` as the
  // initialized marker.
  const initialized = db
    .prepare(
      `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'users'`,
    )
    .get();
  if (!initialized) {
    const schemaPath = path.join(process.cwd(), "data", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    db.exec(schema);
  }

  _db = db;
  return db;
}
