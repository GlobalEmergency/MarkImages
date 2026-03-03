#!/usr/bin/env node

/**
 * propagate-version.js
 *
 * Propagates version from version.json to all derived files:
 * - mobile/package.json (version field)
 * - mobile/android/app/build.gradle (versionName + versionCode)
 *
 * Usage:
 *   node scripts/propagate-version.js              # Propagate versions
 *   node scripts/propagate-version.js --check       # Check if versions are in sync (CI)
 */

const fs = require("fs");
const path = require("path");

const CHECK_MODE = process.argv.includes("--check");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

function calculateBuildNumber(version) {
  const [major, minor, patch] = version.split(".").map(Number);
  return major * 10000 + minor * 100 + patch;
}

function propagateMobile() {
  const versionJsonPath = path.resolve("mobile/version.json");
  if (!fs.existsSync(versionJsonPath)) {
    console.log("ℹ️  mobile/version.json not found — skipping");
    return true;
  }

  const { version } = readJson(versionJsonPath);
  const buildNumber = calculateBuildNumber(version);
  let allInSync = true;

  // 1. Update mobile/package.json
  const packageJsonPath = path.resolve("mobile/package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = readJson(packageJsonPath);

    if (packageJson.version !== version) {
      if (CHECK_MODE) {
        console.error(
          `❌ mobile/package.json version mismatch: ${packageJson.version} ≠ ${version}`
        );
        allInSync = false;
      } else {
        packageJson.version = version;
        writeJson(packageJsonPath, packageJson);
        console.log(`✅ mobile/package.json → ${version}`);
      }
    } else {
      console.log(`✅ mobile/package.json already ${version}`);
    }
  }

  // 2. Update mobile/android/app/build.gradle (if Android project exists)
  const buildGradlePath = path.resolve("mobile/android/app/build.gradle");
  if (fs.existsSync(buildGradlePath)) {
    let gradle = fs.readFileSync(buildGradlePath, "utf-8");
    let gradleChanged = false;

    // Update versionName
    const versionNameRegex = /versionName\s+"[^"]+"/;
    if (versionNameRegex.test(gradle)) {
      const currentMatch = gradle.match(versionNameRegex)[0];
      const expected = `versionName "${version}"`;
      if (currentMatch !== expected) {
        if (CHECK_MODE) {
          console.error(`❌ build.gradle versionName mismatch: ${currentMatch} ≠ ${expected}`);
          allInSync = false;
        } else {
          gradle = gradle.replace(versionNameRegex, expected);
          gradleChanged = true;
        }
      }
    }

    // Update versionCode
    const versionCodeRegex = /versionCode\s+\d+/;
    if (versionCodeRegex.test(gradle)) {
      const currentMatch = gradle.match(versionCodeRegex)[0];
      const expected = `versionCode ${buildNumber}`;
      if (currentMatch !== expected) {
        if (CHECK_MODE) {
          console.error(`❌ build.gradle versionCode mismatch: ${currentMatch} ≠ ${expected}`);
          allInSync = false;
        } else {
          gradle = gradle.replace(versionCodeRegex, expected);
          gradleChanged = true;
        }
      }
    }

    if (gradleChanged) {
      fs.writeFileSync(buildGradlePath, gradle, "utf-8");
      console.log(`✅ build.gradle → versionName "${version}", versionCode ${buildNumber}`);
    } else if (!CHECK_MODE) {
      console.log(`✅ build.gradle already in sync`);
    }
  }

  return allInSync;
}

function main() {
  console.log(CHECK_MODE ? "🔍 Checking version sync..." : "📦 Propagating versions...");
  console.log("");

  const mobileOk = propagateMobile();

  console.log("");

  if (CHECK_MODE && !mobileOk) {
    console.error("❌ Versions are out of sync! Run: node scripts/propagate-version.js");
    process.exit(1);
  }

  if (CHECK_MODE) {
    console.log("✅ All versions in sync");
  } else {
    console.log("✅ Version propagation complete");
  }
}

main();
