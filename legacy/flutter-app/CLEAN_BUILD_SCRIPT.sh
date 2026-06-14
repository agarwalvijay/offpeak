#!/bin/bash

echo "🧹 Cleaning Gradle cache and rebuilding..."

# Navigate to flutter-app directory
cd "$(dirname "$0")"

# Clean Flutter cache
echo "🔄 Cleaning Flutter cache..."
flutter clean

# Remove Gradle cache directories
echo "🗑️  Removing Gradle cache..."
rm -rf android/.gradle
rm -rf ~/.gradle/caches/7.5
rm -rf ~/.gradle/caches/7.6.4
rm -rf ~/.gradle/caches/8.4

# Get dependencies
echo "📦 Getting Flutter dependencies..."
flutter pub get

# Navigate to android directory and clean
echo "🏗️  Cleaning Android project..."
cd android
./gradlew clean

# Go back to main directory
cd ..

echo "✅ Cache cleaned! Now building..."

# Build debug APK
echo "🔨 Building debug APK..."
flutter build apk --debug

if [ $? -eq 0 ]; then
    echo "✅ Debug build successful!"
    echo "📁 APK location: build/app/outputs/flutter-apk/app-debug.apk"
else
    echo "❌ Debug build failed"
    exit 1
fi

echo "🚀 Your ComEd pricing app is ready to install!"