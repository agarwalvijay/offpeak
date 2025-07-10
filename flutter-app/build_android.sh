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

# Build release APK
echo "🏗️ Building release APK..."
flutter build apk --release

# Build App Bundle (for Play Store)
echo "📦 Building App Bundle for Play Store..."
flutter build appbundle --release

echo ""
echo "✅ Build complete!"
echo ""
echo "📁 Built files:"
echo "   Debug APK:   build/app/outputs/flutter-apk/app-debug.apk"
echo "   Release APK: build/app/outputs/flutter-apk/app-release.apk"
echo "   App Bundle:  build/app/outputs/bundle/release/app-release.aab"
echo ""
echo "📱 To install debug APK on connected device:"
echo "   flutter install"
echo ""
echo "🚀 To run on connected device:"
echo "   flutter run"
echo ""
echo "📤 For Play Store: Upload the .aab file"
echo "📤 For direct install: Use the .apk file"