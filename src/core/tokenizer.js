/**
 * src/tokenizer.js
 * ─────────────────────────────────────────────────────────────
 * Responsible only for token generation and validation.
 *
 * Design note: counter state is managed here as a module-level
 * variable, but core.js calls resetCounter() at the start of
 * every sanitizeCode() call — so each sanitization run always
 * starts fresh at __SECRET_1__ regardless of previous runs.
 */

let _counter = 1;

/**
 * Resets the token counter back to 1.
 * Called by core.js at the start of each sanitize operation.
 */
function resetCounter() {
  _counter = 1;
}

/**
 * Returns the next unique token and advances the counter.
 *
 * @returns {string}  e.g. "__SECRET_1__", "__SECRET_2__", ...
 */
function generateToken() {
  return `__SECRET_${_counter++}__`;
}

/**
 * Returns true if the given string is a valid SafePaste token.
 * Used defensively in restore paths to skip non-token strings.
 *
 * @param {string} str
 * @returns {boolean}
 */
function isToken(str) {
  return /^__SECRET_\d+__$/.test(str);
}

/**
 * Extracts all unique SafePaste tokens from a block of text.
 * Convenience wrapper — avoids duplicating the regex in callers.
 *
 * @param {string} text
 * @returns {string[]}  e.g. ["__SECRET_1__", "__SECRET_3__"]
 */
function extractTokens(text) {
  return [...new Set(text.match(/__SECRET_\d+__/g) || [])];
}

module.exports = { resetCounter, generateToken, isToken, extractTokens };