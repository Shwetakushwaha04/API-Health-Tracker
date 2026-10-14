// Run with: npm test
// Uses an in-memory database and a small local server as the "monitored API".

process.env.JWT_SECRET = "test-secret";
process.env.ALLOW_PRIVATE_URLS = "true"; // the test target runs on localhost

const test = require("node:test");
const assert = require("node:assert");
const http = require("http");

const { openDatabase } = require("../src/db");
const { createApp } = require("../src/app");

let appServer;
let targetServer;
let base;
let target;

test.before(async () => {
  const db = openDatabase(":memory:");
  appServer = createApp(db).listen(0);
  base = `http://127.0.0.1:${appServer.address().port}`;

  targetServer = http
    .createServer((req, res) => {
      res.statusCode = req.url === "/bad" ? 500 : 200;
      res.end("ok");
    })
    .listen(0);
  target = `http://127.0.0.1:${targetServer.address().port}`;
});

test.after(() => {
  appServer.close();
  targetServer.close();
});

async function call(method, path, { token, body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  return { status: response.status, data: await response.json() };
}

async function registerAndLogin(username, password = "password123") {
  await call("POST", "/register", { body: { username, password } });
  const login = await call("POST", "/login", { body: { username, password } });
  return login.data.token;
}

test("register rejects a short password", async () => {
  const res = await call("POST", "/register", {
    body: { username: "shorty", password: "123" },
  });
  assert.strictEqual(res.status, 400);
});

test("register rejects a duplicate username", async () => {
  await call("POST", "/register", {
    body: { username: "dupe_user", password: "password123" },
  });
  const res = await call("POST", "/register", {
    body: { username: "DUPE_USER", password: "password123" },
  });
  assert.strictEqual(res.status, 409);
});

test("login fails with a wrong password and works with the right one", async () => {
  await call("POST", "/register", {
    body: { username: "login_user", password: "password123" },
  });

  const bad = await call("POST", "/login", {
    body: { username: "login_user", password: "wrong-password" },
  });
  assert.strictEqual(bad.status, 401);

  const good = await call("POST", "/login", {
    body: { username: "login_user", password: "password123" },
  });
  assert.strictEqual(good.status, 200);
  assert.ok(good.data.token);
});

test("API routes need a valid token", async () => {
  assert.strictEqual((await call("GET", "/api")).status, 401);
  assert.strictEqual((await call("GET", "/api", { token: "garbage" })).status, 401);
});

test("new users start with the example APIs", async () => {
  const token = await registerAndLogin("starter_user");
  const res = await call("GET", "/api", { token });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.data.length, 2);
});

test("adding an API validates the URL", async () => {
  const token = await registerAndLogin("url_user");

  const bad = await call("POST", "/api", {
    token,
    body: { name: "Bad", url: "not a url" },
  });
  assert.strictEqual(bad.status, 400);

  const ftp = await call("POST", "/api", {
    token,
    body: { name: "FTP", url: "ftp://example.com" },
  });
  assert.strictEqual(ftp.status, 400);

  const ok = await call("POST", "/api", {
    token,
    body: { name: "Local", url: `${target}/ok` },
  });
  assert.strictEqual(ok.status, 201);
  assert.strictEqual(ok.data.status, "Unknown");
});

test("health check marks a 200 response Healthy and a 500 response Down", async () => {
  const token = await registerAndLogin("check_user");

  const good = await call("POST", "/api", {
    token,
    body: { name: "Good", url: `${target}/ok` },
  });
  const bad = await call("POST", "/api", {
    token,
    body: { name: "Bad", url: `${target}/bad` },
  });

  const goodResult = await call("POST", `/api/${good.data.id}/check`, { token });
  assert.strictEqual(goodResult.data.status, "Healthy");
  assert.strictEqual(goodResult.data.statusCode, 200);
  assert.strictEqual(goodResult.data.history.length, 1);
  assert.strictEqual(goodResult.data.uptime, 100);

  const badResult = await call("POST", `/api/${bad.data.id}/check`, { token });
  assert.strictEqual(badResult.data.status, "Down");
  assert.strictEqual(badResult.data.statusCode, 500);
  assert.strictEqual(badResult.data.uptime, 0);
});

test("a user cannot check or delete another user's API", async () => {
  const owner = await registerAndLogin("owner_user");
  const other = await registerAndLogin("other_user");

  const created = await call("POST", "/api", {
    token: owner,
    body: { name: "Private", url: `${target}/ok` },
  });
  const id = created.data.id;

  assert.strictEqual((await call("POST", `/api/${id}/check`, { token: other })).status, 404);
  assert.strictEqual((await call("DELETE", `/api/${id}`, { token: other })).status, 404);

  // the owner can still delete it
  assert.strictEqual((await call("DELETE", `/api/${id}`, { token: owner })).status, 200);
});
