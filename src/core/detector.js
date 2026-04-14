/**
 * detector.js
 * Scans text for sensitive data using regex patterns.
 * Each pattern has a name (for logging) and a regex.
 */

const SECRET_PATTERNS = [
  {
    name: "OpenAI API Key",
    regex: /sk-[a-zA-Z0-9]{20,}/g,
  },
  {
    name: "AWS Access Key ID",
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: "AWS Secret Access Key",
    regex: /(?<=aws_secret_access_key\s*=\s*)[A-Za-z0-9/+=]{40}/g,
  },
  {
    name: "Google API Key",
    regex: /AIza[0-9A-Za-z\-_]{30,40}/g,
  },
  {
    name: "MongoDB Connection String",
    regex: /mongodb(?:\+srv)?:\/\/[^\s"'`]+/g,
  },
  {
    name: "JWT Token",
    regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
  },
  {
    name: "Private Key Block",
    regex: /-----BEGIN [A-Z ]+ PRIVATE KEY-----/g,
  },

  // ── .env / config file patterns ───────────────────────────────────────────

  // 1. ENV-style assignments: UPPERCASE_VAR=value (typical .env file format)
  //    Value must look like a literal secret:
  //      - No dots, parens, brackets — excludes config.get(), os.environ.get()
  //      - No ${ — excludes template literals like ${process.env.KEY}
  //      - Starts with alphanumeric, quote, or dash — not a code expression
  //    Examples caught:  CLOUD_API_KEY=abc123xyz, DB_PASSWORD="hunter2", AUTH_TOKEN=xyz789ab
  //    Examples skipped: API_KEY=config.apiKey, TOKEN=process.env.TOKEN, KEY=${MY_KEY}
  {
    name: "Generic ENV Secret",
    regex: /^(?:[A-Z][A-Z0-9_]*_)?(?:KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|AUTH|APIKEY|API_KEY|PRIVATE|ACCESS)\s*=\s*(?!__SECRET_\d+__)(?!\$\{)["'`]?([A-Za-z0-9\-_+/=]{8,})["'`]?/gim,
  },

  // 2. Numeric-only credentials (Cloudinary, Twilio style: 10+ digit IDs)
  //    Examples: CLOUD_API_KEY=392778194794472
  {
    name: "Numeric API Key",
    regex: /(?:[A-Z][A-Z0-9_]*_)?(?:KEY|ID|SID)\s*=\s*(\d{10,})/gi,
  },

  // 3. Known cloud/service NAME slugs
  //    CLOUD_NAME=dfud4gffx, CLOUDINARY_NAME=myapp123
  {
    name: "Cloud Service Name/Slug",
    regex: /^(?:CLOUDINARY_|CLOUD_|FIREBASE_|SUPABASE_|TWILIO_|STRIPE_|SENDGRID_|AWS_)NAME\s*=\s*(?!__SECRET_\d+__)([A-Za-z0-9\-_]{6,})/gim,
  },

  // 4. Lowercase secret assignments with QUOTED literal values only.
  //    Examples caught:  api_key="my-real-key-1234", password="hunter2pass"
  //    Examples skipped: api_key=config.apiKey, password=getFromVault("db-pass")
  //    The (?<!\(\s{0,10}) lookbehind rejects values that are function arguments.
  //    The value charset excludes dots and parens to further reduce false positives.
  {
    name: "Generic Secret Assignment",
    regex: /(?:secret|password|passwd|api_key|apikey)\s*=\s*(?!__SECRET_\d+__)["'`]([A-Za-z0-9\-_+/=]{8,})["'`](?!\s*\))/gi,
  },
];

/**
 * Scans the given text and returns all detected secrets.
 *
 * @param {string} text - The source code or text to scan
 * @returns {Array<{ match: string, name: string }>} - List of detected secrets
 */
function detectSecrets(text) {
  const found = [];
  const seen = new Set(); // avoid duplicates

  for (const pattern of SECRET_PATTERNS) {
    // Reset regex state (important for global regexes)
    pattern.regex.lastIndex = 0;

    let match;
    while ((match = pattern.regex.exec(text)) !== null) {
      // If the pattern has a capture group (group 1), use that as the secret value.
      // This lets patterns like KEY=<value> replace only the value, not "KEY=value".
      const value = match[1] !== undefined ? match[1] : match[0];

      if (!seen.has(value)) {
        seen.add(value);
        found.push({ match: value, name: pattern.name });
      }
    }
  }

  return found;
}

module.exports = { detectSecrets };