import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createAdminSessionToken,
  getAdminAuthConfig,
  isAdminAuthConfigured,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from "./admin-auth-core.ts";

test("admin auth config requires both password and cookie secret", () => {
  assert.deepEqual(getAdminAuthConfig({}), {
    password: undefined,
    cookieSecret: undefined,
  });
  assert.equal(
    isAdminAuthConfigured({ password: "pw", cookieSecret: "secret" }),
    true,
  );
  assert.equal(
    isAdminAuthConfigured({ password: "pw", cookieSecret: undefined }),
    false,
  );
  assert.equal(
    isAdminAuthConfigured({ password: undefined, cookieSecret: "secret" }),
    false,
  );
});

test("admin password verification is exact", () => {
  assert.equal(verifyAdminPassword("correct", "correct"), true);
  assert.equal(verifyAdminPassword(" correct", "correct"), false);
  assert.equal(verifyAdminPassword("correct ", "correct"), false);
  assert.equal(verifyAdminPassword("wrong", "correct"), false);
  assert.equal(verifyAdminPassword("", "correct"), false);
  assert.equal(verifyAdminPassword("correct", undefined), false);
});

test("admin session token verifies with matching secret before expiry", () => {
  const token = createAdminSessionToken("secret", {
    now: 1000,
    ttlSeconds: 60,
  });
  assert.equal(verifyAdminSessionToken(token, "secret", { now: 1000 }), true);
  assert.equal(verifyAdminSessionToken(token, "secret", { now: 1059 }), true);
});

test("admin session token rejects expiry, wrong secret, and tampering", () => {
  const token = createAdminSessionToken("secret", {
    now: 1000,
    ttlSeconds: 60,
  });
  assert.equal(verifyAdminSessionToken(token, "secret", { now: 1060 }), false);
  assert.equal(verifyAdminSessionToken(token, "other", { now: 1000 }), false);
  assert.equal(verifyAdminSessionToken(`${token}x`, "secret", { now: 1000 }), false);
  assert.equal(
    verifyAdminSessionToken(token.replace(".", "x."), "secret", { now: 1000 }),
    false,
  );
});

test("admin session token rejects malformed payloads", () => {
  assert.equal(verifyAdminSessionToken(undefined, "secret", { now: 1000 }), false);
  assert.equal(verifyAdminSessionToken("", "secret", { now: 1000 }), false);
  assert.equal(verifyAdminSessionToken("abc", "secret", { now: 1000 }), false);
  assert.equal(verifyAdminSessionToken("a.b.c", "secret", { now: 1000 }), false);
  assert.equal(verifyAdminSessionToken("abc.def", "secret", { now: 1000 }), false);
  assert.equal(verifyAdminSessionToken("abc.def", undefined, { now: 1000 }), false);
});

test("admin session token rejects implausible future issue times", () => {
  const token = createAdminSessionToken("secret", {
    now: 2000,
    ttlSeconds: 60,
  });
  assert.equal(verifyAdminSessionToken(token, "secret", { now: 1939 }), false);
  assert.equal(verifyAdminSessionToken(token, "secret", { now: 1940 }), true);
});
