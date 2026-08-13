import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

// WORKER_SHARED_SECRET must be set before server.mjs is evaluated (it reads
// process.env once at module load) -- dynamic import after setting it.
process.env.WORKER_SHARED_SECRET = "test-secret-value-not-real";
const { server } = await import("../src/server.mjs");

function listen() {
  return new Promise((resolve) => {
    server.listen(0, () => resolve(server.address().port));
  });
}

function request(port, { method = "GET", path = "/", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, path, method, headers }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: data ? JSON.parse(data) : null }));
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

test("GET /health returns ok without requiring auth", async () => {
  const port = await listen();
  try {
    const res = await request(port, { path: "/health" });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  } finally {
    server.close();
  }
});

test("POST /ingest rejects a request with no auth header", async () => {
  const port = await listen();
  try {
    const res = await request(port, {
      method: "POST",
      path: "/ingest",
      headers: { "content-type": "application/json" },
      body: { videoId: "abcDEF_123-", targetLanguage: "en" },
    });
    assert.equal(res.status, 401);
    assert.equal(res.body.error, "unauthorized");
  } finally {
    server.close();
  }
});

test("POST /ingest rejects a request with the wrong secret", async () => {
  const port = await listen();
  try {
    const res = await request(port, {
      method: "POST",
      path: "/ingest",
      headers: { "content-type": "application/json", "x-worker-secret": "totally-wrong" },
      body: { videoId: "abcDEF_123-", targetLanguage: "en" },
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test("POST /ingest rejects a malformed videoId even with correct auth (never reaches the dispatcher)", async () => {
  const port = await listen();
  try {
    const res = await request(port, {
      method: "POST",
      path: "/ingest",
      headers: { "content-type": "application/json", "x-worker-secret": "test-secret-value-not-real" },
      body: { videoId: "; rm -rf /", targetLanguage: "en" },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error, "invalid_url");
  } finally {
    server.close();
  }
});

test("POST /ingest rejects a missing videoId", async () => {
  const port = await listen();
  try {
    const res = await request(port, {
      method: "POST",
      path: "/ingest",
      headers: { "content-type": "application/json", "x-worker-secret": "test-secret-value-not-real" },
      body: { targetLanguage: "en" },
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("POST /ingest rejects an oversized request body", async () => {
  const port = await listen();
  try {
    const res = await request(port, {
      method: "POST",
      path: "/ingest",
      headers: { "content-type": "application/json", "x-worker-secret": "test-secret-value-not-real" },
      body: { videoId: "abcDEF_123-", targetLanguage: "en", junk: "x".repeat(20_000) },
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("unknown routes return 404", async () => {
  const port = await listen();
  try {
    const res = await request(port, { path: "/nonexistent" });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});
