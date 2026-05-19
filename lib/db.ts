import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import path from "node:path";

export const EMBEDDING_DIM = 1536; // text-embedding-3-small . hard coded limit. change if needed upgrading model. 

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  const file = process.env.SQLITE_PATH ?? path.join(process.cwd(), "data.db");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  sqliteVec.load(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS vec_documents USING vec0(
      embedding float[${EMBEDDING_DIM}]
    );
  `);

  _db = db;
  return db;
}
