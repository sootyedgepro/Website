// Canonical Dex grading prompt. Single source of truth: ~/sootyedge/dex-prompt.md.
// Read at module load so the API and the Claude Code skill grade by the exact
// same rules. Strips the file's own H1 + sync-notice blockquote so what's left
// is a clean system prompt body starting at "You are **Dex**".

const fs = require("fs");
const path = require("path");

const CANON_PATH = path.resolve(__dirname, "..", "..", "dex-prompt.md");

function loadCanonicalPrompt() {
  const raw = fs.readFileSync(CANON_PATH, "utf8");
  const startIdx = raw.indexOf("You are **Dex**");
  if (startIdx === -1) {
    throw new Error(`Canonical body marker not found in ${CANON_PATH}`);
  }
  return raw.slice(startIdx).trim();
}

const PROMPT = loadCanonicalPrompt();

const PROMPT_VERSION = (() => {
  const crypto = require("crypto");
  return crypto.createHash("sha1").update(PROMPT).digest("hex").slice(0, 12);
})();

module.exports = { PROMPT, PROMPT_VERSION, CANON_PATH };
