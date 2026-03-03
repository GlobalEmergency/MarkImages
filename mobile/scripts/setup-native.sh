#!/usr/bin/env bash
#
# setup-native.sh — Apply native platform permissions after `npx cap sync`
#
# Usage: npm run cap:setup   (runs cap sync + this script)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "🔧 Configuring native platform permissions..."

# ── Android: location permissions ──────────────────────────────────────
ANDROID_MANIFEST="$MOBILE_DIR/android/app/src/main/AndroidManifest.xml"
if [ -f "$ANDROID_MANIFEST" ]; then
  if ! grep -q "ACCESS_FINE_LOCATION" "$ANDROID_MANIFEST"; then
    echo "  ✅ Adding Android location permissions..."
    sed -i.bak 's|<uses-permission android:name="android.permission.INTERNET" />|<uses-permission android:name="android.permission.INTERNET" />\
\n    <!-- Geolocation -->\
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\
    <uses-feature android:name="android.hardware.location.gps" />|' "$ANDROID_MANIFEST"
    rm -f "${ANDROID_MANIFEST}.bak"
  else
    echo "  ⏭️  Android location permissions already present"
  fi
else
  echo "  ⚠️  Android manifest not found (run 'npx cap add android' first)"
fi

# ── iOS: location usage descriptions ───────────────────────────────────
IOS_PLIST="$MOBILE_DIR/ios/App/App/Info.plist"
if [ -f "$IOS_PLIST" ]; then
  if ! grep -q "NSLocationWhenInUseUsageDescription" "$IOS_PLIST"; then
    echo "  ✅ Adding iOS location permission descriptions..."
    sed -i.bak 's|</dict>|	<key>NSLocationWhenInUseUsageDescription</key>\
	<string>DeaMap necesita tu ubicación para encontrar desfibriladores cercanos</string>\
	<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>\
	<string>DeaMap necesita tu ubicación para encontrar desfibriladores cercanos</string>\
</dict>|' "$IOS_PLIST"
    rm -f "${IOS_PLIST}.bak"
  else
    echo "  ⏭️  iOS location descriptions already present"
  fi
else
  echo "  ⚠️  iOS Info.plist not found (run 'npx cap add ios' first)"
fi

echo "✅ Native platform setup complete!"
