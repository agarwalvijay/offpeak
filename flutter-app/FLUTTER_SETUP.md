# Flutter Setup Guide for ComEd Pricing App

This guide will help you set up and build the standalone Flutter app for ComEd electricity pricing monitoring.

## 📋 Prerequisites

### 1. Install Flutter SDK

**Windows:**
1. Download Flutter SDK from [flutter.dev](https://docs.flutter.dev/get-started/install/windows)
2. Extract to `C:\src\flutter`
3. Add `C:\src\flutter\bin` to your PATH

**macOS:**
1. Download Flutter SDK from [flutter.dev](https://docs.flutter.dev/get-started/install/macos)
2. Extract to `/usr/local/flutter`
3. Add `/usr/local/flutter/bin` to your PATH

**Linux:**
```bash
wget https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.16.0-stable.tar.xz
tar xf flutter_linux_3.16.0-stable.tar.xz
export PATH="$PATH:`pwd`/flutter/bin"
```

### 2. Install Android Studio

1. Download from [developer.android.com](https://developer.android.com/studio)
2. Install Android SDK and Android SDK Command-line Tools
3. Accept Android licenses: `flutter doctor --android-licenses`

### 3. Setup Android Device/Emulator

**Physical Device:**
1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect via USB

**Emulator:**
1. Open Android Studio
2. Tools → AVD Manager
3. Create Virtual Device
4. Choose device and system image
5. Start emulator

## 🚀 Quick Start

### 1. Navigate to Flutter App
```bash
cd flutter-app/
```

### 2. Check Flutter Setup
```bash
flutter doctor
```
Fix any issues shown before proceeding.

### 3. Install Dependencies
```bash
flutter pub get
```

### 4. Run the App
```bash
flutter run
```

## 🔨 Building for Release

### Option 1: Use Build Script (Recommended)
```bash
./build_android.sh
```

### Option 2: Manual Build Commands

**Debug APK (for testing):**
```bash
flutter build apk --debug
```

**Release APK (for distribution):**
```bash
flutter build apk --release
```

**App Bundle (for Play Store):**
```bash
flutter build appbundle --release
```

## 📱 Installation

### Install Debug APK on Connected Device
```bash
flutter install
```

### Install APK Manually
1. Copy `build/app/outputs/flutter-apk/app-release.apk` to your device
2. Enable "Install from Unknown Sources" in Android settings
3. Tap the APK file to install

## 🏪 Google Play Store Deployment

### 1. Prepare Release Build
```bash
flutter build appbundle --release
```

### 2. Create Play Console Account
- Go to [play.google.com/console](https://play.google.com/console)
- Pay one-time $25 registration fee

### 3. Upload App Bundle
1. Create new app in Play Console
2. Upload `build/app/outputs/bundle/release/app-release.aab`
3. Fill out store listing (description, screenshots, etc.)
4. Submit for review

### 4. App Signing (Recommended)
- Let Google Play manage your app signing key
- Upload app bundle (not APK) for optimal delivery

## 🔧 Development Setup

### VS Code Setup
1. Install Flutter extension
2. Install Dart extension
3. Use Ctrl+Shift+P → "Flutter: New Project" for new projects

### Android Studio Setup
1. Install Flutter plugin
2. Install Dart plugin
3. Use File → New → New Flutter Project

### Useful Commands
```bash
# Hot reload during development
flutter run

# Check for issues
flutter doctor

# Update dependencies
flutter pub get

# Clean build cache
flutter clean

# View connected devices
flutter devices

# Run specific device
flutter run -d <device-id>

# View logs
flutter logs

# Build and install debug
flutter run --debug

# Build release
flutter build apk --release
```

## 🐛 Troubleshooting

### Flutter Doctor Issues

**✗ Android toolchain:**
- Run `flutter doctor --android-licenses`
- Install Android SDK via Android Studio

**✗ Android Studio:**
- Install Flutter and Dart plugins
- Restart Android Studio

**✗ Connected device:**
- Enable USB Debugging on device
- Try different USB cable/port

### Build Issues

**Gradle build failed:**
```bash
cd android/
./gradlew clean
cd ..
flutter clean
flutter pub get
```

**Dependency conflicts:**
```bash
flutter pub deps
flutter pub cache repair
```

**Permission denied on build script:**
```bash
chmod +x build_android.sh
```

### Runtime Issues

**App crashes on startup:**
- Check `flutter logs` for error details
- Ensure device meets minimum Android version requirements

**Network errors:**
- Verify internet connection
- Check if ComEd API is accessible

**Notification issues:**
- Grant notification permissions in Android settings
- Test notifications from app settings screen

## 📊 App Features Verification

Once built and installed, verify these features work:

✅ **Real-time pricing data loads**
✅ **Charts display correctly**  
✅ **Time period selector works**
✅ **Day-ahead pricing shows**
✅ **Settings save properly**
✅ **Notifications can be enabled**
✅ **Auto-refresh functions**
✅ **Pull-to-refresh works**

## 🆘 Getting Help

### Flutter Issues
- [Flutter Documentation](https://docs.flutter.dev/)
- [Flutter GitHub Issues](https://github.com/flutter/flutter/issues)
- [Stack Overflow Flutter](https://stackoverflow.com/questions/tagged/flutter)

### ComEd API Issues
- Check [ComEd Hourly Pricing](https://hourlypricing.comed.com/) website
- Verify API endpoints are accessible

### Android Development
- [Android Developer Docs](https://developer.android.com/docs)
- [Android Studio User Guide](https://developer.android.com/studio/intro)

## 📝 Next Steps

1. **Test thoroughly** on your target devices
2. **Customize app icon** and branding if desired  
3. **Add features** like bill calculation or usage tracking
4. **Optimize performance** for your specific needs
5. **Submit to Play Store** for wider distribution

The app is designed to work completely standalone - no backend server required!