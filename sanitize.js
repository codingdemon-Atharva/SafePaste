#!/usr/bin/env node
/**
 * sanitize.js  — CLI entry point
 * ─────────────────────────────────────────────────────────────
 * Reads a file, calls core.sanitizeCode(), writes the output.
 * All business logic lives in src/core.js.
 *
 * Usage:
 *   node sanitize.js <input-file> [output-file]
 */

const fs   = require("fs");
const path = require("path");

const { sanitizeCode }      = require("./src/core");
const { getDefaultMapPath } = require("./src/mapper");

// ── Args ──────────────────────────────────────────────────────
const [inputArg, outputArg] = process.argv.slice(2);

if (!inputArg) {
  console.error("Usage: node sanitize.js <input-file> [output-file]");
  process.exit(1);
}

const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : inputPath.replace(/(\.[^.]+)$/, ".sanitized$1"); // app.js → app.sanitized.js

// ── Read ──────────────────────────────────────────────────────
if (!fs.existsSync(inputPath)) {
  console.error(`[SafePaste] File not found: ${inputPath}`);
  process.exit(1);
}

const originalText = fs.readFileSync(inputPath, "utf8");

// ── Sanitize ──────────────────────────────────────────────────
const { sanitized, tokens, count } = sanitizeCode(originalText);

if (count === 0) {
  console.log("[SafePaste] No secrets detected — file is safe to share.");
  process.exit(0);
}

console.log(`[SafePaste] Found ${count} secret(s):\n`);
tokens.forEach(({ token, name }) => {
  console.log(`  ✓ [${name}] → ${token}`);
});

// ── Write ─────────────────────────────────────────────────────
fs.writeFileSync(outputPath, sanitized, "utf8");

console.log(`\n[SafePaste] Sanitized file : ${outputPath}`);
console.log(`[SafePaste] Mapping file   : ${getDefaultMapPath()}  ← keep private!`);
console.log(`\n[SafePaste] To restore: node restore.js ${path.basename(outputPath)}`);