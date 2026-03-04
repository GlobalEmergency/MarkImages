#!/bin/bash
# Generates whatsnew files from the merged PR title/body or GitHub release body.
# Used by release workflow to provide Play Store & App Store release notes.
#
# Usage: ./generate-whatsnew.sh <whatsnew-dir>
#
# Environment variables:
#   GITHUB_REPOSITORY - owner/repo (set automatically by GitHub Actions)
#   GITHUB_SHA        - commit SHA (set automatically by GitHub Actions)
#   GH_TOKEN          - GitHub token for API access
#   RELEASE_BODY      - (optional) release body text, takes priority over PR detection

set -euo pipefail

WHATSNEW_DIR="${1:?Usage: generate-whatsnew.sh <whatsnew-dir>}"
LOCALES=("en-US" "es-ES")
MAX_LENGTH=500

mkdir -p "$WHATSNEW_DIR"

NOTES=""

# Priority 1: Use release body if provided
if [ -n "${RELEASE_BODY:-}" ]; then
  echo "Using release body for whatsnew"
  NOTES="$RELEASE_BODY"
fi

# Priority 2: Try to find the PR associated with this commit
if [ -z "$NOTES" ]; then
  echo "Looking for PR associated with commit ${GITHUB_SHA}..."
  PR_DATA=$(gh api "repos/${GITHUB_REPOSITORY}/commits/${GITHUB_SHA}/pulls" 2>/dev/null || echo "[]")

  if [ "$PR_DATA" != "[]" ] && [ "$(echo "$PR_DATA" | jq length)" -gt 0 ]; then
    TITLE=$(echo "$PR_DATA" | jq -r '.[0].title // ""')
    BODY=$(echo "$PR_DATA" | jq -r '.[0].body // ""')

    if [ -n "$TITLE" ]; then
      echo "Found PR: $TITLE"
      if [ -n "$BODY" ]; then
        NOTES=$(printf "%s\n\n%s" "$TITLE" "$BODY")
      else
        NOTES="$TITLE"
      fi
    fi
  fi
fi

# If no notes found, keep existing whatsnew files
if [ -z "$NOTES" ]; then
  echo "No PR or release found, keeping existing whatsnew files"
  exit 0
fi

# Strip markdown formatting that doesn't render well in store listings
NOTES=$(echo "$NOTES" | sed -E 's/^#{1,6}\s+//g; s/\*\*([^*]+)\*\*/\1/g; s/\*([^*]+)\*/\1/g; s/`([^`]+)`/\1/g')

# Truncate to Play Store limit (500 chars)
if [ ${#NOTES} -gt $MAX_LENGTH ]; then
  NOTES="${NOTES:0:$((MAX_LENGTH - 3))}..."
fi

# Write to all locales
for LOCALE in "${LOCALES[@]}"; do
  printf '%s' "$NOTES" > "$WHATSNEW_DIR/whatsnew-${LOCALE}"
  echo "Written whatsnew-${LOCALE} (${#NOTES} chars)"
done
