/**
 * src/extension.js
 * SafePaste VS Code Extension — main entry point.
 *
 * Hooks:
 *  - On COPY  : scans clipboard text → shows popup if secrets detected
 *  - On PASTE : scans clipboard text → shows popup before inserting
 *
 * Commands:
 *  - safepaste.sanitizeSelection  (Ctrl+Shift+S)
 *  - safepaste.restoreSelection   (Ctrl+Shift+R)
 *  - safepaste.sanitizeFile
 *  - safepaste.restoreFile
 *  - safepaste.showMapping
 */

const vscode = require("vscode");
const path   = require("path");
const fs     = require("fs");

const { sanitizeCode, restoreCode } = require("./core");
const { loadMapping }               = require("./core/mapper");

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the workspace-root path to safepaste-map.json, or undefined. */
function getMapFilePath() {
  const custom = vscode.workspace.getConfiguration("safepaste").get("mappingFilePath");
  if (custom) return custom;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return path.join(folders[0].uri.fsPath, "safepaste-map.json");
  }
  return undefined;
}

/** Replaces the active editor's full text with newText, preserving undo history. */
async function replaceEditorText(editor, newText) {
  const fullRange = new vscode.Range(
    editor.document.positionAt(0),
    editor.document.positionAt(editor.document.getText().length)
  );
  await editor.edit(editBuilder => editBuilder.replace(fullRange, newText));
}

/** Replaces the current selection with newText.
 *  If selection is empty (just a cursor), inserts at cursor position.
 *  Handles multiple selections (multi-cursor). */
async function replaceSelection(editor, newText) {
  await editor.edit(editBuilder => {
    // editor.selections covers both single cursor and multi-cursor
    for (const selection of editor.selections) {
      editBuilder.replace(selection, newText);
    }
  });
}

/** Shows a subtle status bar flash message. */
function flash(message, isError = false) {
  const icon = isError ? "$(alert)" : "$(shield)";
  vscode.window.setStatusBarMessage(`${icon} SafePaste: ${message}`, 4000);
}

// ── Popup: shown when secrets detected on COPY ────────────────────────────────

async function showCopyWarningPopup(secretCount, clipboardText) {
  const label = secretCount === 1 ? "1 secret detected" : `${secretCount} secrets detected`;

  const choice = await vscode.window.showWarningMessage(
    `🔐 SafePaste — ${label} in copied text`,
    { modal: false },
    "Sanitize & Copy",
    "Copy Anyway",
    "Cancel"
  );

  if (choice === "Sanitize & Copy") {
    const { sanitized, tokens } = sanitizeCode(clipboardText, getMapFilePath());
    await vscode.env.clipboard.writeText(sanitized);
    flash(`Sanitized ${tokens.length} secret(s) — safe to paste anywhere.`);

    // Show detail in a notification with token list
    const tokenList = tokens.map(t => `${t.token} ← ${t.name}`).join("\n");
    vscode.window.showInformationMessage(
      `SafePaste replaced ${tokens.length} secret(s). Mapping saved to safepaste-map.json.`,
      "Show Mapping"
    ).then(action => {
      if (action === "Show Mapping") showMappingView();
    });
  }
  // "Copy Anyway" → do nothing, clipboard already has the text
  // "Cancel" → do nothing
}

// ── Command: sanitize selection or full file ──────────────────────────────────

async function cmdSanitizeSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const hasSelection = !editor.selection.isEmpty;
  const text = hasSelection
    ? editor.document.getText(editor.selection)
    : editor.document.getText();

  const { sanitized, tokens, count } = sanitizeCode(text, getMapFilePath());

  if (count === 0) {
    flash("No secrets detected — already safe.");
    return;
  }

  if (hasSelection) {
    await replaceSelection(editor, sanitized);
  } else {
    await replaceEditorText(editor, sanitized);
  }

  flash(`Sanitized ${count} secret(s).`);
  vscode.window.showInformationMessage(
    `SafePaste: ${count} secret(s) replaced. Mapping saved to safepaste-map.json.`,
    "Show Mapping"
  ).then(a => { if (a === "Show Mapping") showMappingView(); });
}

// ── Command: restore selection or full file ───────────────────────────────────

async function cmdRestoreSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const hasSelection = !editor.selection.isEmpty;
  const text = hasSelection
    ? editor.document.getText(editor.selection)
    : editor.document.getText();

  const { restored, restoredTokens, missingTokens } = restoreCode(text, getMapFilePath());

  if (restoredTokens.length === 0) {
    flash("No tokens found to restore.");
    return;
  }

  if (hasSelection) {
    await replaceSelection(editor, restored);
  } else {
    await replaceEditorText(editor, restored);
  }

  if (missingTokens.length > 0) {
    vscode.window.showWarningMessage(
      `SafePaste: restored ${restoredTokens.length}, but ${missingTokens.length} token(s) missing from map.`
    );
  } else {
    flash(`Restored ${restoredTokens.length} secret(s).`);
  }
}

// ── Command: show mapping in a webview panel ──────────────────────────────────

async function showMappingView() {
  const mapPath = getMapFilePath();
  const mapping = loadMapping(mapPath);
  const entries = Object.entries(mapping);

  if (entries.length === 0) {
    vscode.window.showInformationMessage("SafePaste: no mapping found yet.");
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    "safepaste.mapping",
    "SafePaste — Token Mapping",
    vscode.ViewColumn.Beside,
    { enableScripts: false }
  );

  const rows = entries.map(([token, secret]) => {
    const masked = secret.length > 8
      ? secret.slice(0, 4) + "•".repeat(Math.min(secret.length - 6, 12)) + secret.slice(-2)
      : "••••••••";
    return `<tr><td class="token">${token}</td><td class="secret">${masked}</td></tr>`;
  }).join("");

  panel.webview.html = `<!DOCTYPE html><html><head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: var(--vscode-editor-font-family, monospace); font-size:13px; padding:20px; color:var(--vscode-editor-foreground); background:var(--vscode-editor-background); }
    h2 { font-size:15px; font-weight:600; margin-bottom:16px; }
    table { border-collapse:collapse; width:100%; }
    th { text-align:left; padding:6px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--vscode-descriptionForeground); border-bottom:1px solid var(--vscode-panel-border); }
    td { padding:8px 12px; border-bottom:1px solid var(--vscode-panel-border); }
    .token { color:var(--vscode-gitDecoration-addedResourceForeground,#4ec9b0); font-weight:600; }
    .secret { color:var(--vscode-descriptionForeground); font-style:italic; }
    .warning { margin-top:16px; font-size:11px; color:var(--vscode-editorWarning-foreground,#cca700); }
  </style></head><body>
  <h2>🔐 SafePaste Token Mapping</h2>
  <table><thead><tr><th>Token</th><th>Secret (masked)</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <p class="warning">⚠ Keep safepaste-map.json out of version control. Add it to .gitignore.</p>
  </body></html>`;
}

// ── Activation ────────────────────────────────────────────────────────────────

function activate(context) {
  const cfg = () => vscode.workspace.getConfiguration("safepaste");
  const { detectSecrets } = require("./core/detector");

  // ── Shared clipboard state ────────────────────────────────────────────────
  // Both copy and paste watchers share this so they don't double-alert on
  // the same clipboard content.
  let lastClipboard  = "";
  let scanTimeout    = null;
  let lastPasteCheck = ""; // tracks what we already warned about on paste

  // ── COPY: clipboard poller ────────────────────────────────────────────────
  //
  // We never override editor.action.clipboardCopyAction — no safe "default:"
  // fallback exists for copy. Instead we poll the clipboard every 800ms and
  // also run a fast 200ms check after any Ctrl+C keypress.
  //
  async function checkClipboardForSecrets(source) {
    try {
      if (!cfg().get("autoScanOnCopy")) return;
      const clipText = await vscode.env.clipboard.readText();
      if (!clipText || clipText === lastClipboard || clipText.length < 8) return;
      lastClipboard = clipText;

      const detected = detectSecrets(clipText);
      if (detected.length > 0) {
        showCopyWarningPopup(detected.length, clipText);
      }
    } catch { /* clipboard read failed — ignore */ }
  }

  // Ctrl+C keybinding in package.json triggers this command.
  // VS Code runs keybindings in order — the built-in copy fires first,
  // then our command fires. So by the time this runs, the clipboard is
  // already updated. We just wait 200ms then scan what's in it.
  const copyListener = vscode.commands.registerCommand("safepaste.onCopyKeypress", () => {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => checkClipboardForSecrets("keybinding"), 200);
  });

  // Background poll catches copies from menus, right-click, other extensions
  const clipboardWatcher = setInterval(() => checkClipboardForSecrets("poll"), 800);

  // ── PASTE: document-change watcher ───────────────────────────────────────
  //
  // We never override editor.action.clipboardPasteAction — "default:" is not
  // reliably available across VS Code versions and breaks paste entirely.
  //
  // Instead: watch onDidChangeTextDocument. When the document changes AND the
  // clipboard matches what was just inserted, we know a paste just happened.
  // If the pasted content contains secrets or tokens, show the popup AFTER
  // the paste — letting the user sanitize/restore in place.
  //
  // Trade-off: the popup appears after paste (not before). This is intentional
  // — it guarantees paste always works, and the user can still act on it.
  //
  const pasteWatcher = vscode.workspace.onDidChangeTextDocument(async (event) => {
    try {
      if (!cfg().get("autoScanOnPaste")) return;

      // Only care about content changes (not metadata, saves, etc.)
      if (!event.contentChanges.length) return;

      // Skip if the file itself is not in an active editor
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.document !== event.document) return;

      // Read current clipboard
      const clipText = await vscode.env.clipboard.readText();
      if (!clipText || clipText.length < 4) return;

      // Check if any of the changes match the clipboard content (= was a paste)
      const wasPaste = event.contentChanges.some(change =>
        change.text === clipText ||
        clipText.includes(change.text) ||
        change.text.includes(clipText.slice(0, 40))
      );
      if (!wasPaste) return;

      // Avoid double-alerting on the same clipboard content
      if (clipText === lastPasteCheck) return;
      lastPasteCheck = clipText;

      // Path A: pasted SafePaste tokens → offer in-place restore
      const foundTokens = [...new Set(clipText.match(/__SECRET_\d+__/g) || [])];
      if (foundTokens.length > 0) {
        const choice = await vscode.window.showInformationMessage(
          `🔐 SafePaste — ${foundTokens.length} token(s) pasted. Restore secrets now?`,
          "Restore in Place", "Leave as Tokens"
        );
        if (choice === "Restore in Place") {
          await cmdRestoreSelection();
        }
        return;
      }

      // Path B: pasted real secrets → offer in-place sanitize
      const detected = detectSecrets(clipText);
      if (detected.length > 0) {
        const label = detected.length === 1 ? "1 secret" : `${detected.length} secrets`;
        const choice = await vscode.window.showWarningMessage(
          `🔐 SafePaste — ${label} pasted. Sanitize now?`,
          "Sanitize in Place", "Leave as-is"
        );
        if (choice === "Sanitize in Place") {
          await cmdSanitizeSelection();
        }
      }

    } catch (err) {
      console.error("[SafePaste] Paste watcher error:", err.message);
      // Never interrupts paste — document already changed successfully
    }
  });

  // ── Register all commands and disposables ─────────────────────────────────
  context.subscriptions.push(
    copyListener,
    pasteWatcher,
    vscode.commands.registerCommand("safepaste.sanitizeSelection", cmdSanitizeSelection),
    vscode.commands.registerCommand("safepaste.restoreSelection",  cmdRestoreSelection),
    vscode.commands.registerCommand("safepaste.sanitizeFile",      cmdSanitizeSelection),
    vscode.commands.registerCommand("safepaste.restoreFile",       cmdRestoreSelection),
    vscode.commands.registerCommand("safepaste.showMapping",       showMappingView),
    { dispose: () => {
      clearInterval(clipboardWatcher);
      if (scanTimeout) clearTimeout(scanTimeout);
    }}
  );

  flash("SafePaste active.");
}

function deactivate() {}

module.exports = { activate, deactivate };