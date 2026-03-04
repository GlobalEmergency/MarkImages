#!/usr/bin/env node

/**
 * propagate-version.js
 *
 * Propagates version from version.json to all derived files:
 * - mobile/package.json (version field)
 * - mobile/android/app/build.gradle (versionName + versionCode)
 * - mobile/ios/App/App.xcodeproj/project.pbxproj (MARKETING_VERSION + CURRENT_PROJECT_VERSION)
 *
 * Build number formula: major * 10000 + minor * 100 + patch
 * ⚠️  This formula also lives in:
 *   - .github/workflows/release-mobile-app.yml (prepare job, bash)
 *   - .github/scripts/google-play-version.mjs (docs only)
 * If you change it here, update those files too!
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
  // major * 10000 + minor * 100 + patch (e.g., 1.0.0 → 10000, 2.3.5 → 20305)
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

  // 3. Update mobile/ios/App/App.xcodeproj/project.pbxproj (if iOS project exists)
  const pbxprojPath = path.resolve("mobile/ios/App/App.xcodeproj/project.pbxproj");
  if (fs.existsSync(pbxprojPath)) {
    let pbxproj = fs.readFileSync(pbxprojPath, "utf-8");
    let pbxprojChanged = false;

    // Update MARKETING_VERSION (appears in Debug + Release target build configs)
    const marketingRegex = /MARKETING_VERSION = [^;]+;/g;
    const expectedMarketing = `MARKETING_VERSION = ${version};`;
    const marketingMatches = pbxproj.match(marketingRegex) || [];
    const allMarketingCorrect = marketingMatches.every((m) => m === expectedMarketing);

    if (!allMarketingCorrect && marketingMatches.length > 0) {
      if (CHECK_MODE) {
        console.error(
          `❌ project.pbxproj MARKETING_VERSION mismatch: found "${marketingMatches[0]}", expected "${expectedMarketing}"`
        );
        allInSync = false;
      } else {
        pbxproj = pbxproj.replace(marketingRegex, expectedMarketing);
        pbxprojChanged = true;
      }
    }

    // Update CURRENT_PROJECT_VERSION (same formula as Android versionCode)
    const projectVersionRegex = /CURRENT_PROJECT_VERSION = [^;]+;/g;
    const expectedProjectVersion = `CURRENT_PROJECT_VERSION = ${buildNumber};`;
    const versionMatches = pbxproj.match(projectVersionRegex) || [];
    const allVersionCorrect = versionMatches.every((m) => m === expectedProjectVersion);

    if (!allVersionCorrect && versionMatches.length > 0) {
      if (CHECK_MODE) {
        console.error(
          `❌ project.pbxproj CURRENT_PROJECT_VERSION mismatch: found "${versionMatches[0]}", expected "${expectedProjectVersion}"`
        );
        allInSync = false;
      } else {
        pbxproj = pbxproj.replace(projectVersionRegex, expectedProjectVersion);
        pbxprojChanged = true;
      }
    }

    if (pbxprojChanged) {
      fs.writeFileSync(pbxprojPath, pbxproj, "utf-8");
      console.log(
        `✅ project.pbxproj → MARKETING_VERSION = ${version}, CURRENT_PROJECT_VERSION = ${buildNumber}`
      );
    } else if (!CHECK_MODE) {
      console.log(`✅ project.pbxproj already in sync`);
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
