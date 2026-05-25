// Run with: node --test lib/transcripts.test.ts
// Node 24 strips TypeScript types natively (--experimental-strip-types is
// on by default), so no transpiler is required.
import { test } from "node:test";
import assert from "node:assert/strict";

import { parseVtt } from "./vtt.ts";

test("parses a manual VTT with vanilla cues", () => {
  const input = [
    "WEBVTT",
    "",
    "00:00:01.000 --> 00:00:03.000",
    "hello world",
    "",
    "00:00:03.000 --> 00:00:05.000",
    "second cue line",
    "",
    "00:00:05.000 --> 00:00:07.000",
    "third cue line",
    "",
  ].join("\n");

  const out = parseVtt(input);
  assert.equal(out, "hello world\nsecond cue line\nthird cue line");
});

test("collapses rolling-window auto-sub repetitions", () => {
  // YouTube auto-subs emit overlapping cues where each cue repeats the
  // prior cue's text plus a few new tokens. The parser should keep each
  // word exactly once, in original order.
  const input = [
    "WEBVTT",
    "Kind: captions",
    "Language: en",
    "",
    "00:00:00.880 --> 00:00:03.519 align:start position:0%",
    "hello<00:00:01.040><c> world</c><00:00:01.520><c> this</c>",
    "",
    "00:00:03.519 --> 00:00:03.529 align:start position:0%",
    "hello world this",
    "",
    "00:00:03.519 --> 00:00:06.480 align:start position:0%",
    "hello world this<00:00:04.000><c> is</c><00:00:04.480><c> a</c><c> test</c>",
    "",
    "00:00:06.480 --> 00:00:06.490 align:start position:0%",
    "hello world this is a test",
    "",
  ].join("\n");

  const out = parseVtt(input);
  // Each word once, in order.
  assert.equal(out.split(/\s+/).filter(Boolean).join(" "), "hello world this is a test");
});

test("drops cue identifier lines", () => {
  const input = [
    "WEBVTT",
    "",
    "cue-1",
    "00:00:01.000 --> 00:00:03.000",
    "first body",
    "",
    "cue-2",
    "00:00:03.000 --> 00:00:05.000",
    "second body",
    "",
  ].join("\n");

  const out = parseVtt(input);
  assert.equal(out, "first body\nsecond body");
});

test("strips <c> markup tags while keeping inner text", () => {
  const input = [
    "WEBVTT",
    "",
    "00:00:01.000 --> 00:00:03.000",
    "<c.color>foo</c> middle <c>bar</c>",
    "",
  ].join("\n");

  const out = parseVtt(input);
  assert.equal(out, "foo middle bar");
});

test("strips inline timestamp tags and <c> wrappers together", () => {
  const input = [
    "WEBVTT",
    "",
    "00:00:01.000 --> 00:00:03.000",
    "hello<00:00:01.040><c> world</c><00:00:01.520><c> there</c>",
    "",
  ].join("\n");

  const out = parseVtt(input);
  assert.equal(out, "hello world there");
});

test("returns empty string for header-only VTT", () => {
  const input = "WEBVTT\n\n";
  assert.equal(parseVtt(input), "");
});
