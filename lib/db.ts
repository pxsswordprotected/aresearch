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

  // The canonical schema in `data/schema.sql` doesn't use `IF NOT EXISTS`,
  // so we only apply the full file on a fresh DB (no `users` table yet).
  // For already-initialized DBs we apply targeted migrations table-by-table.
  const hasTable = (name: string) =>
    Boolean(
      db
        .prepare(
          `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`,
        )
        .get(name),
    );

  if (!hasTable("users")) {
    const schemaPath = path.join(process.cwd(), "data", "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    db.exec(schema);
  } else {
    // Targeted migration: add tables introduced after the initial schema.
    if (!hasTable("block_ocr")) {
      db.exec(`
        CREATE TABLE block_ocr (
            block_id INTEGER PRIMARY KEY,
            ocr_text TEXT,
            ocr_summary TEXT,
            ocr_model TEXT,
            ocr_processed_at TEXT,
            ocr_error TEXT,
            FOREIGN KEY (block_id) REFERENCES blocks(id)
        );
      `);
    }
    if (!hasTable("block_link_content")) {
      db.exec(`
        CREATE TABLE block_link_content (
            block_id INTEGER PRIMARY KEY,
            url TEXT,
            content_text TEXT,
            content_chars INTEGER,
            extractor TEXT,
            fetched_at TEXT,
            error TEXT,
            FOREIGN KEY (block_id) REFERENCES blocks(id)
        );
      `);
    }
  }

  _db = db;
  return db;
}
