# Build Android App Only

Since you're encountering macOS-specific issues, let's focus on building the Android app which is the main target.

## Quick Android Build

### 1. Navigate to Flutter directory
```bash
cd flutter-app/
```

### 2. Clean and get dependencies
```bash
flutter clean
flutter pub get
```

### 3. Build for Android only
```bash
# Build debug APK for testing
flutter build apk --debug

# Build release APK for distribution
flutter build apk --release
```

### 4. Skip macOS completely
To avoid macOS build issues, you can specify the target platform:

```bash
# Only target Android
flutter config --enable-android
flutter config --no-enable-macos-desktop
```

## Install on Android Device

### Connect Android device and install:
```bash
flutter install
```

### Or manually install APK:
1. Copy `build/app/outputs/flutter-apk/app-release.apk` to your Android device
2. Enable "Install from Unknown Sources" in Android settings
3. Tap the APK file to install

## Why Android-Only?

The ComEd pricing app is designed primarily for mobile use:
- Real-time price monitoring on-the-go
- Push notifications for price alerts
- Touch-friendly charts and controls
- Mobile-optimized interface

macOS support is secondary and can have additional setup complexity.

## Success Verification

Once built and installed, verify these features:
- App launches successfully
- Real-time pricing data loads
- Charts display and respond to touch
- Settings save properly
- Time period selector works

The Android app will work completely standalone without needing the Streamlit server running.