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

  # NOTE: No App Links intent filter is added here.
  # Credential autofill association is handled via Digital Asset Links
  # (assetlinks.json on deamap.es with get_login_creds + matching SHA256)
  # plus the Capacitor WebView hostname (hostname: "deamap.es").
  # An App Links intent filter for https://deamap.es MUST NOT be added
  # because it conflicts with Capacitor's WebView which serves local
  # content at the same hostname, causing Activity restart loops on
  # physical devices.
else
  echo "  ⚠️  Android manifest not found (run 'npx cap add android' first)"
fi

# ── Android: release signing config ───────────────────────────────────
ANDROID_BUILD_GRADLE="$MOBILE_DIR/android/app/build.gradle"
KEYSTORE_PROPS="$MOBILE_DIR/keystores/keystore.properties"
if [ -f "$ANDROID_BUILD_GRADLE" ] && [ -f "$KEYSTORE_PROPS" ]; then
  if ! grep -q "signingConfigs" "$ANDROID_BUILD_GRADLE"; then
    echo "  ✅ Adding Android release signing config to build.gradle..."
    # Insert signingConfigs block before buildTypes
    sed -i.bak '/buildTypes {/i\
    signingConfigs {\
        release {\
            def keystorePropsFile = rootProject.file("app/../../keystores/keystore.properties")\
            if (keystorePropsFile.exists()) {\
                def keystoreProps = new Properties()\
                keystoreProps.load(new FileInputStream(keystorePropsFile))\
                storeFile file(keystoreProps["storeFile"])\
                storePassword keystoreProps["storePassword"]\
                keyAlias keystoreProps["keyAlias"]\
                keyPassword keystoreProps["keyPassword"]\
            }\
        }\
    }' "$ANDROID_BUILD_GRADLE"
    # Add signingConfig to the release buildType
    sed -i.bak 's|release {|release {\
            signingConfig signingConfigs.release|' "$ANDROID_BUILD_GRADLE"
    rm -f "${ANDROID_BUILD_GRADLE}.bak"
  else
    echo "  ⏭️  Android signing config already present"
  fi
elif [ -f "$ANDROID_BUILD_GRADLE" ]; then
  echo "  ⚠️  keystores/keystore.properties not found — release builds will use debug signing"
else
  echo "  ⚠️  Android build.gradle not found"
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

echo ""
echo "✅ Native platform setup complete!"
