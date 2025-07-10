# ComEd Pricing Android App

A React Native Android app for monitoring ComEd electricity pricing in real-time.

## Features

- **Real-time pricing display** with current hour average
- **24-hour price trend chart** with interactive visualization
- **Push notifications** for price alerts (high/low/negative pricing)
- **Usage recommendations** based on current pricing
- **Offline storage** for user settings and preferences
- **Pull-to-refresh** for manual data updates
- **Auto-refresh** every 5 minutes

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **React Native CLI**
3. **Android Studio** with Android SDK
4. **Java Development Kit (JDK 11)**

## Setup Instructions

### 1. Install Dependencies
```bash
cd android-app
npm install
```

### 2. Setup Android Development Environment
- Install Android Studio
- Setup Android SDK (API level 31 or higher)
- Create an Android Virtual Device (AVD) or connect physical device

### 3. Install React Native CLI
```bash
npm install -g react-native-cli
```

### 4. Run the App
```bash
# Start Metro bundler
npm start

# Run on Android (in a new terminal)
npm run android
```

## Building APK for Distribution

### Debug APK
```bash
cd android/
./gradlew assembleDebug
```
APK will be generated at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK
```bash
cd android/
./gradlew assembleRelease
```

## App Architecture

### Data Flow
1. **API Integration**: Fetches data from ComEd's official pricing API
2. **State Management**: Uses React hooks for local state
3. **Persistence**: AsyncStorage for user preferences and settings
4. **Notifications**: React Native Push Notification for alerts

### Key Components
- **App.js**: Main component with pricing display and charts
- **Price Monitoring**: Automatic background refresh every 5 minutes
- **Alert System**: Configurable thresholds with push notifications
- **Chart Visualization**: Line chart showing 24-hour pricing trends

### API Endpoints Used
- Current Hour Average: `https://hourlypricing.comed.com/api?type=currenthouraverage`
- 5-Minute Feed: `https://hourlypricing.comed.com/api?type=5minutefeed`

## Customization

### Alert Thresholds
Users can customize price alert thresholds through the app settings:
- Low Price Threshold (default: 5.0¢/kWh)
- Medium Price Threshold (default: 10.0¢/kWh)
- High Price Threshold (default: 15.0¢/kWh)

### Notification Settings
- Enable/disable push notifications
- Configure alert frequency
- Set quiet hours for notifications

## Deployment

### Google Play Store
1. Generate signed APK with release key
2. Create Play Console account
3. Upload APK with required metadata
4. Submit for review

### Direct APK Distribution
- Share the generated APK file directly
- Users need to enable "Install from unknown sources"

## Troubleshooting

### Common Issues

**Metro bundler won't start:**
```bash
npx react-native start --reset-cache
```

**Android build fails:**
```bash
cd android/
./gradlew clean
cd ..
npm run android
```

**Push notifications not working:**
- Check Android permissions
- Verify Google Play Services on device
- Test on physical device (emulator may have limitations)

## Future Enhancements

- **Widget support** for home screen price display
- **Apple Watch companion** (when iOS version is built)
- **Smart home integration** (IFTTT, Google Assistant)
- **Historical data analysis** with deeper insights
- **Bill estimation** based on usage patterns
- **Multiple utility support** beyond ComEd