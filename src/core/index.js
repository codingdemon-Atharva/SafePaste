/**
 * src/core.js
 * Shared business logic for SafePaste.
 * Both CLI tools and the VS Code extension import from here.
 *
 * mapFile is optional — if omitted, mapper uses process.cwd().
 * VS Code extension passes the workspace root path explicitly.
 */

const { detectSecrets }               = require("./detector");
const { generateToken, resetCounter } = require("./tokenizer");
const { saveMapping, loadMapping }    = require("./mapper");

/**
 * Sanitizes code: detects secrets, replaces with tokens, saves mapping.
 * @param {string} code
 * @param {string} [mapFile] - explicit path to safepaste-map.json
 */
function sanitizeCode(code, mapFile) {
  const detected = detectSecrets(code);
  if (detected.length === 0) return { sanitized: code, tokens: [], count: 0 };

  resetCounter();
  let sanitized = code;
  const tokens  = [];
  const mapping = {};

  for (const { match, name } of detected) {
    const token = generateToken();
    mapping[token] = match;
    tokens.push({ token, name, original: match });
    sanitized = sanitized.split(match).join(token);
  }

  saveMapping(mapping, mapFile);
  return { sanitized, tokens, count: tokens.length };
}

/**
 * Restores sanitized code: replaces tokens with originals from mapping.
 * @param {string} code
 * @param {string} [mapFile] - explicit path to safepaste-map.json
 */
function restoreCode(code, mapFile) {
  const tokensInText = [...new Set(code.match(/__SECRET_\d+__/g) || [])];
  if (tokensInText.length === 0) return { restored: code, restoredTokens: [], missingTokens: [] };

  const mapping        = loadMapping(mapFile);
  let restored         = code;
  const restoredTokens = [];
  const missingTokens  = [];

  for (const token of tokensInText) {
    if (mapping[token] !== undefined) {
      restored = restored.split(token).join(mapping[token]);
      restoredTokens.push(token);
    } else {
      missingTokens.push(token);
    }
  }

  return { restored, restoredTokens, missingTokens };
}

module.exports = { sanitizeCode, restoreCode };