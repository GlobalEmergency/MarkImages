# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Preserve line number information for debugging stack traces
# (required for Firebase Crashlytics readable reports).
-keepattributes SourceFile,LineNumberTable

# Hide the original source file name.
-renamesourcefileattribute SourceFile

# Firebase Crashlytics — keep exception classes
-keep public class * extends java.lang.Exception

# ──────────────────────────────────────────────────────────────
# Capacitor — prevent R8 from breaking the plugin bridge
# ──────────────────────────────────────────────────────────────

# Keep the entire Capacitor bridge framework (R8 breaks permission
# handling on older Android versions when these classes are optimized).
-keep class com.getcapacitor.** { *; }

# Keep ION native libraries used by Capacitor plugins
-keep class io.ionic.libs.** { *; }

# Keep all runtime annotations (needed for @CapacitorPlugin,
# @Permission, @PluginMethod, @PermissionCallback resolution).
-keepattributes *Annotation*,InnerClasses,Signature,Exceptions
