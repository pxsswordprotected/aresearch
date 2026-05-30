import { test } from "node:test";
import assert from "node:assert/strict";

import type { RecChannel } from "../recommendations/types.ts";
import { formatChannelTitle, formatEvidence } from "./format.ts";

function channel(overrides: Partial<RecChannel>): RecChannel {
  return {
    channel_id: 1,
    channel_title: "Interaction UX",
    channel_url: "https://example.com/channel",
    raw_score: 1,
    score: 0.42,
    channel_size: 4,
    block_count: 3,
    top_blocks: [],
    ...overrides,
  };
}

test("formats evidence as count, first block, and hidden block count", () => {
  assert.equal(
    formatEvidence(
      channel({
        block_count: 3,
        top_blocks: [
          {
            block_id: 1,
            arena_block_id: 101,
            title: "Interaction UX",
            block_type: "Text",
            arena_url: null,
            vec_distance: 0.2,
          },
          {
            block_id: 2,
            arena_block_id: 102,
            title: "Second",
            block_type: "Text",
            arena_url: null,
            vec_distance: 0.3,
          },
          {
            block_id: 3,
            arena_block_id: 103,
            title: "Third",
            block_type: "Text",
            arena_url: null,
            vec_distance: 0.4,
          },
        ],
      }),
    ),
    "3 blocks | Interaction UX +2",
  );
});

test("formats singular evidence and untitled fallback", () => {
  assert.equal(
    formatEvidence(
      channel({
        block_count: 1,
        top_blocks: [
          {
            block_id: 1,
            arena_block_id: 101,
            title: " ",
            block_type: null,
            arena_url: null,
            vec_distance: 0.2,
          },
        ],
      }),
    ),
    "1 block | Untitled",
  );
});

test("formats channel title fallback", () => {
  assert.equal(formatChannelTitle(" notes "), "notes");
  assert.equal(formatChannelTitle(" "), "Untitled");
  assert.equal(formatChannelTitle(null), "Untitled");
});
