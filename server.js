#!/usr/bin/env node
/**
 * server.js  — HTTP server for the SafePaste Web UI
 * ─────────────────────────────────────────────────────────────
 * Zero dependencies — uses Node's built-in 'http' module.
 * Delegates all sanitize/restore logic to src/core.js.
 *
 * Routes:
 *   GET  /              → serves ui/index.html
 *   POST /api/sanitize  → { code } → { sanitized, tokens, count }
 *   POST /api/restore   → { code } → { restored, restoredTokens, missingTokens }
 *
 * Usage: node server.js
 * Then open: http://localhost:3131
 */

const http = require("http");
const fs   = require("fs");
const path = require("path");

const { sanitizeCode } = require("./src/core");
const { restoreCode }  = require("./src/core");

const PORT    = 3131;
const UI_FILE = path.join(__dirname, "ui", "index.html");

// ── Helpers ───────────────────────────────────────────────────

/** Reads and JSON-parses the POST body. Returns {} on parse failure. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => (raw += chunk));
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

/** Sends a JSON response with CORS headers. */
function sendJSON(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify(payload));
}

// ── Route handlers ────────────────────────────────────────────

async function handleSanitize(req, res) {
  const { code } = await readBody(req);
  if (!code) return sendJSON(res, 400, { error: "Missing 'code' in request body." });

  // All logic in core.js — server just wraps it in HTTP
  const result = sanitizeCode(code);
  sendJSON(res, 200, result);
}

async function handleRestore(req, res) {
  const { code } = await readBody(req);
  if (!code) return sendJSON(res, 400, { error: "Missing 'code' in request body." });

  // All logic in core.js — server just wraps it in HTTP
  const result = restoreCode(code);
  sendJSON(res, 200, result);
}

function handleUI(req, res) {
  if (!fs.existsSync(UI_FILE)) {
    res.writeHead(404);
    return res.end("UI not found. Make sure ui/index.html exists.");
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync(UI_FILE, "utf8"));
}

// ── Router ────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (req.method === "POST" && req.url === "/api/sanitize") return handleSanitize(req, res);
  if (req.method === "POST" && req.url === "/api/restore")  return handleRestore(req, res);
  if (req.method === "GET"  && (req.url === "/" || req.url === "/index.html")) return handleUI(req, res);

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n🔐 SafePaste Web UI → http://localhost:${PORT}\n`);
});