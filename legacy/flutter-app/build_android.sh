#!/bin/bash

# Flutter Android Build Script for ComEd Pricing App
echo "🔧 Building ComEd Pricing Flutter App for Android..."

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed. Please install Flutter first."
    echo "Visit: https://docs.flutter.dev/get-started/install"
    exit 1
fi

# Get dependencies
echo "📦 Getting Flutter dependencies..."
flutter pub get

# Clean previous builds
echo "🧹 Cleaning previous builds..."
flutter clean
flutter pub get

# Check for issues (Android-specific)
echo "🔍 Running Flutter doctor..."
echo "Note: Xcode/iOS warnings can be ignored for Android-only builds"
flutter doctor

# Build debug APK (for testing)
echo "🔨 Building debug APK..."
flutter build apk --debug

# Build release APKs split per ABI. This emits a small per-architecture APK
# (typically ~8–10MB each) instead of one ~22MB universal APK.
# --no-tree-shake-icons keeps the full MaterialIcons font; subsetting was
# producing a font whose codepoints didn't match Icons.* at runtime, so every
# icon rendered as a tofu box.
echo "🏗️ Building release APKs (per-ABI)..."
flutter build apk --release --split-per-abi --no-tree-shake-icons

# Build App Bundle (for Play Store)
echo "📦 Building App Bundle for Play Store..."
flutter build appbundle --release --no-tree-shake-icons

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Built files:"
echo "   Debug APK:        build/app/outputs/flutter-apk/app-debug.apk"
echo "   Release APKs:     build/app/outputs/flutter-apk/app-{arm64-v8a,armeabi-v7a,x86_64}-release.apk"
echo "   App Bundle:       build/app/outputs/bundle/release/app-release.aab"
echo ""
echo "📐 Release APK sizes:"
ls -lh build/app/outputs/flutter-apk/app-*-release.apk 2>/dev/null | awk '{print "   " $9 " — " $5}'
echo ""
echo "🚀 Your standalone ComEd pricing app is ready!"
echo "   - Real-time pricing data directly from ComEd API"
echo "   - Interactive charts with touch controls"
echo "   - Smart price alerts and notifications"
echo "   - No backend server required"
echo ""
echo "📱 To install debug APK on connected device:"
echo "   flutter install"
echo ""
echo "🚀 To run on connected device:"
echo "   flutter run"
echo ""
echo "📤 For Play Store: Upload the .aab file"
echo "📤 For direct install: Use the per-ABI .apk for the target device"
echo "   (Most modern phones: app-arm64-v8a-release.apk)"