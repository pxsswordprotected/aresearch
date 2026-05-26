import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSearchText, isFilenameLikeTitle, type SearchTextInput } from "./search-text.ts";

const baseInput = (overrides: Partial<SearchTextInput>): SearchTextInput => ({
  title: null,
  description: null,
  content_text: null,
  ocr_text: null,
  ocr_summary: null,
  external_content: null,
  transcript_text: null,
  block_type: null,
  source_provider_name: null,
  channel_titles: [],
  ...overrides,
});

test("detects filename extension titles", () => {
  assert.equal(isFilenameLikeTitle("image.png"), true);
  assert.equal(isFilenameLikeTitle("IMG_0002.jpg"), true);
  assert.equal(isFilenameLikeTitle("file.pdf"), true);
});

test("detects CDN or random slug titles", () => {
  assert.equal(isFilenameLikeTitle("photoA1bc"), true);
  assert.equal(isFilenameLikeTitle("HHUdUSLWAAETYqr"), true);
});

test("does not treat human-readable titles as filename-like", () => {
  assert.equal(isFilenameLikeTitle("design temporal hierarchy"), false);
  assert.equal(isFilenameLikeTitle("MichaelJackson"), false);
});

test("drops filename-like titles when other content exists", () => {
  const out = buildSearchText(baseInput({
    title: "image.png",
    description: "a useful description",
  }));

  assert.equal(out, "a useful description");
});

test("keeps filename-like titles when they are the only signal", () => {
  const out = buildSearchText(baseInput({ title: "image.png" }));

  assert.equal(out, "image.png");
});
