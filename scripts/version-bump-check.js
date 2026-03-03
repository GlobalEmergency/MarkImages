#!/usr/bin/env node

/**
 * check-version-bump.js
 *
 * Verifies that version.json files have been incremented compared to the base branch.
 * Used in CI to enforce version bumps on PRs.
 *
 * Usage:
 *   node scripts/check-version-bump.js [--base-dir <path>]
 *
 * Expects a `base/` directory with the base branch checkout (created by CI).
 * If base/ doesn't exist, skips the check (useful for local development).
 */

const fs = require("fs");
const path = require("path");

const VERSION_FILES = [{ path: "mobile/version.json", name: "Mobile" }];

function parseVersion(versionStr) {
  const parts = versionStr.split(".").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    return null;
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function isHigherVersion(current, base) {
  if (current.major !== base.major) return current.major > base.major;
  if (current.minor !== base.minor) return current.minor > base.minor;
  return current.patch > base.patch;
}

function readVersionFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(content);
    return data.version || null;
  } catch {
    return null;
  }
}

function main() {
  const baseDir = process.argv.includes("--base-dir")
    ? process.argv[process.argv.indexOf("--base-dir") + 1]
    : "base";

  if (!fs.existsSync(baseDir)) {
    console.log("ℹ️  Base directory not found — skipping version bump check");
    console.log("   (This is normal for local development or push events)");
    process.exit(0);
  }

  let hasErrors = false;
  let hasChecks = false;

  for (const versionFile of VERSION_FILES) {
    const currentPath = path.resolve(versionFile.path);
    const basePath = path.resolve(baseDir, versionFile.path);

    if (!fs.existsSync(currentPath)) {
      continue;
    }

    if (!fs.existsSync(basePath)) {
      console.log(`✅ ${versionFile.name}: New file (no base to compare)`);
      continue;
    }

    hasChecks = true;

    const currentVersion = readVersionFile(currentPath);
    const baseVersion = readVersionFile(basePath);

    if (!currentVersion) {
      console.error(`❌ ${versionFile.name}: Cannot read version from ${versionFile.path}`);
      hasErrors = true;
      continue;
    }

    if (!baseVersion) {
      console.log(`✅ ${versionFile.name}: ${currentVersion} (base has no version)`);
      continue;
    }

    const current = parseVersion(currentVersion);
    const base = parseVersion(baseVersion);

    if (!current || !base) {
      console.error(`❌ ${versionFile.name}: Invalid semver format`);
      hasErrors = true;
      continue;
    }

    if (isHigherVersion(current, base)) {
      console.log(`✅ ${versionFile.name}: ${baseVersion} → ${currentVersion}`);
    } else if (currentVersion === baseVersion) {
      console.warn(`⚠️  ${versionFile.name}: Version not bumped (${currentVersion})`);
      console.warn(`   Please increment the version in ${versionFile.path}`);
      // Warning only, not blocking — some PRs don't need a version bump
    } else {
      console.error(
        `❌ ${versionFile.name}: Version decreased! ${baseVersion} → ${currentVersion}`
      );
      hasErrors = true;
    }
  }

  if (!hasChecks) {
    console.log("ℹ️  No version files to check");
  }

  process.exit(hasErrors ? 1 : 0);
}

main();
