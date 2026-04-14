/**
 * test/run.js
 * Pure Node test runner — no test framework needed.
 * Run with: node test/run.js
 */

const path = require("path");
process.chdir(path.join(__dirname, ".."));

const { detectSecrets }             = require("../src/detector");
const { generateToken, resetCounter, isToken, extractTokens } = require("../src/tokenizer");
const { sanitizeCode, restoreCode } = require("../src/core");

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n── ${name} ${"─".repeat(50 - name.length)}`);
}

// ── detector.js ───────────────────────────────────────────────────────────────
section("detector");

const envBlock = `
CLOUD_NAME=dfud4gffx
CLOUD_API_KEY=392778194794472
CLOUD_API_SECRET=hTwxh5Pc7O5r4BSL2v0vmhD5LWY
ATLASDB_URL=mongodb+srv://user:pass@cluster.mongodb.net/db
SECRET=thisisasecret
PORT=3000
NODE_ENV=development
APP_NAME=myapp
`.trim();

const envSecrets = detectSecrets(envBlock);
assert("detects CLOUD_NAME slug",         envSecrets.some(s => s.match === "dfud4gffx"));
assert("detects CLOUD_API_KEY (numeric)",  envSecrets.some(s => s.match === "392778194794472"));
assert("detects CLOUD_API_SECRET",        envSecrets.some(s => s.match === "hTwxh5Pc7O5r4BSL2v0vmhD5LWY"));
assert("detects MongoDB URL",             envSecrets.some(s => s.match.startsWith("mongodb")));
assert("detects SECRET=value",            envSecrets.some(s => s.match === "thisisasecret"));
assert("no false positive: PORT=3000",    !envSecrets.some(s => s.match === "3000"));
assert("no false positive: NODE_ENV",     !envSecrets.some(s => s.match === "development"));
assert("no false positive: APP_NAME",     !envSecrets.some(s => s.match === "myapp"));

const jwtInput = `token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.abc123def456ghi789"`;
const jwtSecrets = detectSecrets(jwtInput);
assert("detects JWT token",               jwtSecrets.length > 0);

const openaiInput = `const key = "sk-abcdefghijklmnopqrstuvwxyz123456";`;
const openaiSecrets = detectSecrets(openaiInput);
assert("detects OpenAI key",              openaiSecrets.some(s => s.name === "OpenAI API Key"));

const awsInput = `AWS_KEY=AKIAIOSFODNN7EXAMPLE`;
const awsSecrets = detectSecrets(awsInput);
assert("detects AWS key",                 awsSecrets.some(s => s.name === "AWS Access Key ID"));

const googleInput = `key = "AIzaSyD-9tSrke72I6hGPeFDr2BwCKyYmGKzYU"`;
const googleSecrets = detectSecrets(googleInput);
assert("detects Google API key",          googleSecrets.some(s => s.name === "Google API Key"));

// ── tokenizer.js ──────────────────────────────────────────────────────────────
section("tokenizer");

resetCounter();
const t1 = generateToken();
const t2 = generateToken();
const t3 = generateToken();
assert("first token is __SECRET_1__",     t1 === "__SECRET_1__");
assert("second token is __SECRET_2__",    t2 === "__SECRET_2__");
assert("third token is __SECRET_3__",     t3 === "__SECRET_3__");

resetCounter();
assert("reset makes next token __SECRET_1__ again", generateToken() === "__SECRET_1__");

assert("isToken: valid token",            isToken("__SECRET_5__"));
assert("isToken: invalid — no underscores", !isToken("SECRET_1"));
assert("isToken: invalid — not numeric",  !isToken("__SECRET_abc__"));

const textWithTokens = "const a = __SECRET_1__; const b = __SECRET_3__;";
const extracted = extractTokens(textWithTokens);
assert("extractTokens finds 2 tokens",    extracted.length === 2);
assert("extractTokens finds __SECRET_1__", extracted.includes("__SECRET_1__"));
assert("extractTokens deduplicates",      extractTokens("__SECRET_1__ __SECRET_1__").length === 1);

// ── core.js ───────────────────────────────────────────────────────────────────
section("core — sanitizeCode");

const mapFile = "/tmp/safepaste-test-map.json";
const fs = require("fs");
if (fs.existsSync(mapFile)) fs.unlinkSync(mapFile); // clean state

const code1 = `const key = "sk-abcdefghijklmnopqrstuvwxyz"; const db = "mongodb://u:p@host/db";`;
const r1 = sanitizeCode(code1, mapFile);
assert("sanitize detects 2 secrets",      r1.count === 2);
assert("sanitize returns tokens array",   r1.tokens.length === 2);
assert("sanitized text has no raw secret", !r1.sanitized.includes("sk-abc"));
assert("sanitized text has token",        r1.sanitized.includes("__SECRET_1__"));
assert("mapping file created",            fs.existsSync(mapFile));

section("core — restoreCode");

const r2 = restoreCode(r1.sanitized, mapFile);
assert("restore returns original text",   r2.restored === code1);
assert("restore reports correct count",   r2.restoredTokens.length === 2);
assert("no missing tokens",               r2.missingTokens.length === 0);

// Roundtrip test
const original = `API_KEY=abc12345xyz\nDB_URL=mongodb://admin:secret@host/db\nPORT=3000`;
if (fs.existsSync(mapFile)) fs.unlinkSync(mapFile);
const { sanitized } = sanitizeCode(original, mapFile);
const { restored }  = restoreCode(sanitized, mapFile);
assert("full roundtrip: sanitize → restore = original", restored === original);

// Edge cases
const noSecrets = sanitizeCode("const x = 1; // no secrets here", mapFile);
assert("no secrets: count is 0",          noSecrets.count === 0);
assert("no secrets: text unchanged",      noSecrets.sanitized === "const x = 1; // no secrets here");

const emptyRestore = restoreCode("no tokens here", mapFile);
assert("restore with no tokens: unchanged", emptyRestore.restored === "no tokens here");
assert("restore with no tokens: empty arrays", emptyRestore.restoredTokens.length === 0);

// Unknown token in restore
const { restored: r3, missingTokens } = restoreCode("hello __SECRET_99__", mapFile);
assert("unknown token flagged as missing", missingTokens.includes("__SECRET_99__"));
assert("unknown token left in place",      r3.includes("__SECRET_99__"));

// Clean up
if (fs.existsSync(mapFile)) fs.unlinkSync(mapFile);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(54)}`);
console.log(`  ${passed} passed  |  ${failed} failed`);
console.log(`${"─".repeat(54)}\n`);
if (failed > 0) process.exit(1);