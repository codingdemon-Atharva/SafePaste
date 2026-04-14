#!/usr/bin/env node
/**
 * restore.js  — CLI entry point
 * ─────────────────────────────────────────────────────────────
 * Reads a sanitized file, calls core.restoreCode(), writes output.
 * All business logic lives in src/core.js.
 *
 * Usage:
 *   node restore.js <sanitized-file> [output-file]
 */

const fs   = require("fs");
const path = require("path");

const { restoreCode } = require("./src/core");

// ── Args ──────────────────────────────────────────────────────
const [inputArg, outputArg] = process.argv.slice(2);

if (!inputArg) {
  console.error("Usage: node restore.js <sanitized-file> [output-file]");
  process.exit(1);
}

const inputPath = path.resolve(inputArg);

// Output: replace .sanitized.ext → .restored.ext, or append .restored
const outputPath = outputArg
  ? path.resolve(outputArg)
  : inputPath.includes(".sanitized")
    ? inputPath.replace(".sanitized", ".restored")
    : inputPath.replace(/(\.[^.]+)$/, ".restored$1");

// ── Read ──────────────────────────────────────────────────────
if (!fs.existsSync(inputPath)) {
  console.error(`[SafePaste] File not found: ${inputPath}`);
  process.exit(1);
}

const sanitizedText = fs.readFileSync(inputPath, "utf8");

// ── Restore ───────────────────────────────────────────────────
const { restored, restoredTokens, missingTokens } = restoreCode(sanitizedText);

if (restoredTokens.length === 0 && missingTokens.length === 0) {
  console.log("[SafePaste] No tokens found in file — nothing to restore.");
  process.exit(0);
}

console.log(`[SafePaste] Restoring ${restoredTokens.length + missingTokens.length} token(s):\n`);

restoredTokens.forEach(t => console.log(`  ✓ ${t} → restored`));
missingTokens.forEach(t  => console.warn(`  ⚠ ${t} → not in mapping (skipped)`));

// ── Write ─────────────────────────────────────────────────────
fs.writeFileSync(outputPath, restored, "utf8");

console.log(`\n[SafePaste] Restored ${restoredTokens.length} secret(s).`);
if (missingTokens.length > 0) {
  console.warn(`[SafePaste] Warning: ${missingTokens.length} token(s) had no mapping entry.`);
}
console.log(`[SafePaste] Restored file: ${outputPath}`);