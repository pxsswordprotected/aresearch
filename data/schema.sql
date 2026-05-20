CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arena_user_id INTEGER UNIQUE,
    arena_username TEXT UNIQUE NOT NULL,
    profile_url TEXT,
    slug TEXT,
    full_name TEXT,
    avatar_url TEXT,
    indexed_at TEXT
);

CREATE TABLE channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arena_channel_id INTEGER UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    visibility TEXT,
    url TEXT,
    slug TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    arena_block_id INTEGER UNIQUE NOT NULL,
    title TEXT,
    description TEXT,
    block_type TEXT,
    source_url TEXT,
    source_provider_name TEXT,
    source_provider_url TEXT,
    image_url TEXT,
    image_thumb_url TEXT,
    image_display_url TEXT,
    image_original_url TEXT,
    content_text TEXT,
    content_html TEXT,
    search_text TEXT,
    arena_url TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE block_channels (
  block_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  position INTEGER,
  connected_at TEXT,
  PRIMARY KEY (block_id, channel_id),
  FOREIGN KEY (block_id) REFERENCES blocks(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id) --eg the foreign key rule makes sure 10 really exists in blocks and 3 really exists in channels, so your database does not contain fake or broken links.
);

CREATE VIRTUAL TABLE vec_blocks USING vec0(
block_id INTEGER PRIMARY KEY,
embedding float[1536], --a fixed length array of 1536 32-bit floats
+embedding_model TEXT,
+created_at TEXT
);

CREATE TABLE sync_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    status TEXT,
    message TEXT,
    created_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE block_ocr (
    block_id INTEGER PRIMARY KEY,
    ocr_text TEXT,
    ocr_summary TEXT,
    ocr_model TEXT,
    ocr_processed_at TEXT,
    ocr_error TEXT,
    FOREIGN KEY (block_id) REFERENCES blocks(id)
);
