/**
 * src/mapper.js
 * Handles reading and writing the local mapping file.
 * Accepts an explicit mapFile path — used by VS Code extension
 * to write to the workspace root instead of process.cwd().
 */

const fs   = require("fs");
const path = require("path");

const DEFAULT_MAP_FILE = path.resolve(process.cwd(), "safepaste-map.json");

function resolveMapPath(mapFile) {
  return mapFile || DEFAULT_MAP_FILE;
}

function loadMapping(mapFile) {
  const filePath = resolveMapPath(mapFile);
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`[SafePaste] Failed to read mapping: ${err.message}`);
    return {};
  }
}

function saveMapping(newMappings, mapFile) {
  const filePath = resolveMapPath(mapFile);
  const merged = { ...loadMapping(filePath), ...newMappings };
  try {
    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2), "utf8");
  } catch (err) {
    console.error(`[SafePaste] Failed to save mapping: ${err.message}`);
  }
}

function getDefaultMapPath() {
  return DEFAULT_MAP_FILE;
}

module.exports = { loadMapping, saveMapping, getDefaultMapPath, resolveMapPath };