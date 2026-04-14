# SafePaste

**Stop leaking secrets when you share code with AI tools.**

SafePaste watches your clipboard. When you copy code containing API keys,
passwords, or connection strings, it intercepts and offers to replace them
with safe placeholders — then restore them later, byte-for-byte.

---

## How it works

### On copy
Copy any code. If SafePaste detects secrets, a popup appears:

```
🔐 SafePaste — 3 secrets detected in copied text
  [ Sanitize & Copy ]   [ Copy Anyway ]   [ Cancel ]
```

**Sanitize & Copy** rewrites your clipboard. What you paste into ChatGPT,
Copilot, or Slack contains `__SECRET_1__` instead of your real credentials.

### On paste
Paste code that has secrets — or paste back sanitized code with tokens:

```
🔐 SafePaste — 2 secrets detected in clipboard
  [ Sanitize then Paste ]   [ Paste Anyway ]   [ Cancel ]
```

```
🔐 SafePaste — 2 SafePaste tokens detected in clipboard
  [ Restore Secrets ]   [ Paste as-is ]
```

Choosing **Restore Secrets** swaps `__SECRET_1__` back to the original value
using the local `safepaste-map.json` mapping file.

---

## Commands

All commands are available via `Ctrl+Shift+P` → type `SafePaste`:

| Command | Shortcut | Description |
|---------|----------|-------------|
| SafePaste: Sanitize Selection | `Ctrl+K Ctrl+H` | Replace secrets in selection (or whole file) |
| SafePaste: Restore Selection | `Ctrl+K Ctrl+J` | Restore tokens in selection (or whole file) |
| SafePaste: Sanitize Entire File | — | Sanitize every secret in the active file |
| SafePaste: Restore Entire File | — | Restore all tokens in the active file |
| SafePaste: Show Token Mapping | — | View all token ↔ secret pairs (masked) |

Right-click any selection → **🔐 SafePaste** submenu for quick access.

---

## What gets detected

| Secret type | Example pattern |
|-------------|----------------|
| OpenAI API key | `sk-...` |
| AWS Access Key ID | `AKIA...` |
| AWS Secret Access Key | `aws_secret_access_key = ...` |
| Google API key | `AIza...` |
| MongoDB connection string | `mongodb://...` / `mongodb+srv://...` |
| JWT token | `eyJ....eyJ....` |
| PEM private key | `-----BEGIN ... PRIVATE KEY-----` |
| Generic `.env` secrets | `API_KEY=`, `_SECRET=`, `_TOKEN=`, `_PASSWORD=` |
| Cloud service name slugs | `CLOUD_NAME=`, `CLOUDINARY_NAME=`, `FIREBASE_NAME=` |
| Numeric API IDs | `CLOUD_API_KEY=392778194794472` |
| Generic secret assignments | `secret=`, `password=`, `api_key=` (quoted or bare) |

---

## Settings

Open `Settings` → search **SafePaste**:

| Setting | Default | Description |
|---------|---------|-------------|
| `safepaste.autoScanOnCopy` | `true` | Show popup when copying secrets |
| `safepaste.autoScanOnPaste` | `true` | Show popup when pasting secrets |
| `safepaste.mappingFilePath` | `""` | Custom path for `safepaste-map.json` |
| `safepaste.showStatusBar` | `true` | Show status bar messages |

---

## The mapping file

SafePaste saves token → secret mappings in `safepaste-map.json` at your
workspace root. This file contains your real secrets.

**Add it to `.gitignore` immediately:**

```
# .gitignore
safepaste-map.json
*.sanitized.*
```

---

## Privacy

- **Zero network requests.** SafePaste never phones home.
- **Zero dependencies.** Pure Node.js — nothing installed at runtime.
- **Local only.** The mapping file lives on your machine, nowhere else.

---

## Contributing

SafePaste is open source. Bug reports, pattern additions, and PRs welcome at
[github.com/safepaste/safepaste-vscode](https://github.com/safepaste/safepaste-vscode).

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add detection patterns
and run the test suite.

---

## License

MIT
