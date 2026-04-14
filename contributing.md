# Contributing to SafePaste

Thanks for helping make SafePaste better. This guide covers everything you need
to go from idea to merged pull request.

---

## Project structure

```
safepaste-vscode/
├── src/
│   ├── extension.js   ← VS Code activation, copy/paste hooks, popups, commands
│   ├── core.js        ← sanitizeCode() and restoreCode() — the main API
│   ├── detector.js    ← regex patterns that find secrets
│   ├── tokenizer.js   ← generates and validates __SECRET_N__ tokens
│   └── mapper.js      ← reads and writes safepaste-map.json
├── test/
│   └── run.js         ← pure Node test runner (no framework)
├── .github/
│   └── workflows/
│       └── ci.yml     ← test + package + publish pipeline
├── icon.svg           ← source icon (convert to icon.png before publishing)
├── package.json
├── .vscodeignore
└── CHANGELOG.md
```

The dependency graph is intentionally strict:

```
extension.js
    └── core.js
            ├── detector.js    (no imports)
            ├── tokenizer.js   (no imports)
            └── mapper.js      (fs, path only)
```

`extension.js` is the only file that imports from `vscode`. Everything else is
plain Node and can be tested without launching VS Code.

---

## Setting up locally

```bash
git clone https://github.com/safepaste/safepaste-vscode
cd safepaste-vscode
npm install          # installs dev tools only (vsce, eslint, ovsx)
npm test             # runs test/run.js — should show 37 passed, 0 failed
```

To run the extension in VS Code:

1. Open the `safepaste-vscode/` folder in VS Code
2. Press `F5` — opens an Extension Development Host with SafePaste active
3. Make a change, press `Ctrl+Shift+F5` to reload

---

## Adding a new secret pattern

All patterns live in `src/detector.js` inside `SECRET_PATTERNS`.

Each entry has:
```js
{
  name: "Human readable label",   // shown in popups and token chips
  regex: /your-pattern/g,         // MUST have the g flag
}
```

**Rules:**
- The regex MUST have the `g` flag — without it `exec()` loops forever
- If your pattern has a capture group `(...)`, only group 1 is used as the
  secret value. This lets you write `KEY=(.+)` and replace only the value,
  not the full `KEY=value` line
- Add a negative lookahead `(?!__SECRET_\d+__)` to skip already-tokenized values
- Add both a positive test (should detect) and a negative test (should not
  detect) to `test/run.js`
- Run `npm test` — all 37+ tests must pass before opening a PR

**Example — adding a Stripe key pattern:**
```js
{
  name: "Stripe Secret Key",
  regex: /sk_(?:live|test)_[a-zA-Z0-9]{24,}/g,
}
```

Then in `test/run.js`:
```js
assert("detects Stripe live key",
  
assert("no false positive: sk_short",
  detectSecrets('key=sk_live_abc').length === 0);
```

---

## Changing the tokenizer format

If you want to change the token format (e.g. `{{SECRET_1}}` instead of
`__SECRET_1__`), you need to update in three places:

1. `src/tokenizer.js` — `generateToken()` and `isToken()` regex
2. `src/tokenizer.js` — `extractTokens()` regex
3. `src/mapper.js` / `src/core.js` — anywhere `/__SECRET_\d+__/g` appears inline

Do a project-wide search for `__SECRET_` before changing.

---

## Pull request checklist

- [ ] `npm test` passes with 0 failures
- [ ] New detection patterns have both positive and negative test cases
- [ ] `CHANGELOG.md` updated under `[Unreleased]`
- [ ] No new runtime dependencies added (extension must stay zero-dependency)
- [ ] `src/extension.js` is the only file that imports `vscode`

---

## Publishing (maintainers only)

### First-time setup

1. Create a publisher account at https://marketplace.visualstudio.com/manage
2. Generate a Personal Access Token (PAT) with **Marketplace → Publish** scope
3. Add `VSCE_PAT` to GitHub repo secrets
4. Create an account at https://open-vsx.org and generate a token
5. Add `OVSX_PAT` to GitHub repo secrets

### Convert icon

```bash
npm install --save-dev svgexport
npx svgexport icon.svg icon.png 128:128
```

### Release process

```bash
# 1. Update version in package.json
npm version patch   # or minor / major

# 2. Update CHANGELOG.md — move [Unreleased] → [x.y.z] with today's date

# 3. Push the version tag — CI handles the rest
git push --follow-tags
```

The CI pipeline will:
- Run tests on Node 18 and 20
- Build `safepaste-x.y.z.vsix`
- Publish to VS Code Marketplace (via `VSCE_PAT`)
- Publish to Open VSX (via `OVSX_PAT`)

### Manual publish (if CI fails)

```bash
npx svgexport icon.svg icon.png 128:128
npm run package                  # creates .vsix locally
npm run publish                  # pushes to Marketplace
npm run publish:openvsx          # pushes to Open VSX
```