// Tests that need ALLOW_PRIVATE_URLS to be OFF, so they live in their own file
// (each test file runs in a separate process).

delete process.env.ALLOW_PRIVATE_URLS;

const test = require("node:test");
const assert = require("node:assert");
const os = require("os");
const fs = require("fs");
const path = require("path");

const { validateUrlFormat, isPrivateIp } = require("../src/urlGuard");
const { openDatabase } = require("../src/db");

test("private and local URLs are rejected", () => {
  const blocked = [
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://10.0.0.5/admin",
    "http://192.168.1.1",
    "http://172.16.0.1",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "ftp://example.com",
    "javascript:alert(1)",
  ];

  for (const url of blocked) {
    assert.ok(validateUrlFormat(url), `${url} should be rejected`);
  }
});

test("normal public URLs are accepted", () => {
  assert.strictEqual(validateUrlFormat("https://api.github.com/"), null);
  assert.strictEqual(validateUrlFormat("http://example.com/health"), null);
});

test("isPrivateIp recognises private ranges", () => {
  assert.ok(isPrivateIp("10.1.2.3"));
  assert.ok(isPrivateIp("::ffff:127.0.0.1"));
  assert.ok(!isPrivateIp("8.8.8.8"));
});

test("data is still there after the database is closed and reopened", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-test-"));
  const file = path.join(dir, "test.db");

  const first = openDatabase(file);
  first
    .prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
    .run("persist_user", "hash");
  first.close();

  const second = openDatabase(file);
  const row = second
    .prepare("SELECT username FROM users WHERE username = ?")
    .get("persist_user");
  second.close();

  assert.strictEqual(row.username, "persist_user");

  fs.rmSync(dir, { recursive: true, force: true });
});
