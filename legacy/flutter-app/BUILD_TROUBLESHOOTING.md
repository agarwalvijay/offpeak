# Flutter Build Troubleshooting Guide

## Common Build Issues and Solutions

### 1. CardTheme Error
**Error**: `The argument type 'CardTheme' can't be assigned to the parameter type 'CardThemeData?'`

**Solution**: Update Flutter version or use `CardThemeData` instead of `CardTheme`

**Fixed in**: `lib/main.dart` - Changed `CardTheme(` to `CardThemeData(`

### 2. Notification Permission Error
**Error**: `The method 'requestPermission' isn't defined for the class 'AndroidFlutterLocalNotificationsPlugin'`

**Solution**: Update to latest flutter_local_notifications package

**Fixed in**: 
- Updated `pubspec.yaml` to use version `^17.2.3`
- Added try-catch for backward compatibility in `lib/services/notification_service.dart`

### 3. Extension Method Not Found
**Error**: `The getter 'displayName' isn't defined for the class 'TimePeriod'`

**Solution**: Ensure proper imports in all files using TimePeriod

**Fixed in**: Added import `../models/pricing_data.dart` to files using TimePeriod

### 4. macOS Build Issues
If building for macOS, you may encounter additional issues:

**Xcode warnings**: Can be ignored if only building for Android
**Pod install issues**: Run `cd ios && pod install` or `cd macos && pod install`

## Platform-Specific Builds

### Android Only (Recommended)
```bash
flutter build apk --release
```

### macOS (if needed)
```bash
flutter build macos --release
```

### Clean Build (if issues persist)
```bash
flutter clean
flutter pub get
flutter build apk --release
```

## Version Compatibility

The app is tested with:
- Flutter SDK: >= 3.10.0
- Dart SDK: >= 3.0.0

If using newer Flutter versions, you may need to:
1. Update package versions in `pubspec.yaml`
2. Run `flutter pub upgrade`
3. Fix any deprecated API usage

## Quick Fix Commands

```bash
# Update dependencies
flutter pub upgrade

# Clean and rebuild
flutter clean && flutter pub get

# Check for issues
flutter doctor

# Analyze code
flutter analyze
```

## Platform Notes

- **Android**: Fully supported and tested
- **macOS**: Basic support, may need additional configuration
- **iOS**: Should work but requires Xcode setup
- **Web**: Not tested, may need additional web-specific packages

## Recommended Build Process

1. **Focus on Android first** (most stable)
2. **Use the build script**: `./build_android.sh`
3. **Test on Android device/emulator**
4. **Only then consider other platforms**

## Getting Help

If you encounter issues not covered here:

1. **Check Flutter version**: `flutter --version`
2. **Run flutter doctor**: `flutter doctor -v`
3. **Check pub.dev**: Verify package compatibility
4. **Clean build**: Try the clean commands above
5. **Check logs**: `flutter logs` for runtime errors