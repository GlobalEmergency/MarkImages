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

  # Android: deep link intent filter for credential association
  if ! grep -q "android:host=\"deamap.es\"" "$ANDROID_MANIFEST"; then
    echo "  ✅ Adding Android deep link intent filter for credential autofill..."
    sed -i.bak 's|</activity>|            <intent-filter android:autoVerify="true">\
                <action android:name="android.intent.action.VIEW" />\
                <category android:name="android.intent.category.DEFAULT" />\
                <category android:name="android.intent.category.BROWSABLE" />\
                <data android:scheme="https" android:host="deamap.es" />\
            </intent-filter>\
        </activity>|' "$ANDROID_MANIFEST"
    rm -f "${ANDROID_MANIFEST}.bak"
  else
    echo "  ⏭️  Android deep link intent filter already present"
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

# ── iOS: Associated Domains for credential autofill ────────────────────
IOS_ENTITLEMENTS="$MOBILE_DIR/ios/App/App/App.entitlements"
if [ -d "$MOBILE_DIR/ios" ]; then
  if [ ! -f "$IOS_ENTITLEMENTS" ]; then
    echo "  ✅ Creating iOS entitlements with Associated Domains..."
    cat > "$IOS_ENTITLEMENTS" << 'ENTITLEMENTS_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.associated-domains</key>
	<array>
		<string>applinks:deamap.es</string>
		<string>webcredentials:deamap.es</string>
	</array>
</dict>
</plist>
ENTITLEMENTS_EOF
  elif ! grep -q "webcredentials:deamap.es" "$IOS_ENTITLEMENTS"; then
    echo "  ✅ Adding webcredentials to iOS entitlements..."
    sed -i.bak 's|</array>|		<string>applinks:deamap.es</string>\
		<string>webcredentials:deamap.es</string>\
	</array>|' "$IOS_ENTITLEMENTS"
    rm -f "${IOS_ENTITLEMENTS}.bak"
  else
    echo "  ⏭️  iOS Associated Domains already configured"
  fi
else
  echo "  ⚠️  iOS project not found (run 'npx cap add ios' first)"
fi

echo "✅ Native platform setup complete!"
echo ""
echo "📋 REMINDER: For credential autofill to work fully, you must host:"
echo "   - https://deamap.es/.well-known/apple-app-site-association  (iOS)"
echo "   - https://deamap.es/.well-known/assetlinks.json             (Android)"
echo "   See: public/.well-known/ for templates"
