#!/usr/bin/env bash
# Sync the canonical Dex prompt into the Claude Code skill.
#
# Canonical source: ~/sootyedge/dex-prompt.md
# Target:           ~/.claude/skills/dex/SKILL.md
#
# The target's "skill-only prelude" (frontmatter, MCP preflight, etc.) ends at
# the marker line "# Canonical Dex Grading Prompt". Everything after that marker
# is replaced by the body of dex-prompt.md (from "You are **Dex**" onward) so
# the skill and the Vercel API always grade by the same rules.
#
# Idempotent. Re-run safely after any edit to dex-prompt.md.

set -euo pipefail

CANON="${HOME}/sootyedge/dex-prompt.md"
SKILL="${HOME}/.claude/skills/dex/SKILL.md"
MARKER="# Canonical Dex Grading Prompt"

[[ -f "$CANON" ]] || { echo "Canonical prompt missing: $CANON" >&2; exit 1; }
[[ -f "$SKILL" ]] || { echo "Skill file missing: $SKILL" >&2; exit 1; }

if ! grep -qxF "$MARKER" "$SKILL"; then
  echo "Marker '$MARKER' not found in $SKILL — refusing to clobber." >&2
  exit 1
fi

prelude=$(awk -v m="$MARKER" '
  { print }
  $0 == m { exit }
' "$SKILL")

# Body of the canonical prompt starts at the first "You are **Dex**" line.
body=$(awk '
  /^You are \*\*Dex\*\*/ { found=1 }
  found                  { print }
' "$CANON")

[[ -n "$body" ]] || { echo "Could not locate canonical body start in $CANON (looked for /^You are \\*\\*Dex\\*\\*/)" >&2; exit 1; }

tmp=$(mktemp -t dex-skill.XXXXXX)
{
  printf '%s\n\n' "$prelude"
  printf '> Synced from `~/sootyedge/dex-prompt.md` by `scripts/sync-dex-skill.sh`. Do not edit here — edit the canonical file and re-run the sync.\n\n'
  printf '%s\n' "$body"
} > "$tmp"

mv "$tmp" "$SKILL"
echo "Synced $(basename "$CANON") → $SKILL"
