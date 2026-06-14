# ComEd Pricing Flutter App

A standalone Flutter mobile application for monitoring ComEd electricity pricing. This app directly calls the ComEd API without requiring a backend server.

## Features

🔋 **Real-time Pricing**: Live 5-minute electricity pricing updates
📊 **Interactive Charts**: Price trends with configurable time periods
📅 **Day-Ahead Forecasts**: Hourly pricing predictions for planning
🔔 **Smart Alerts**: Customizable price threshold notifications
📱 **Native Experience**: Full Android app with Material Design
⚡ **No Backend Required**: Direct API integration with ComEd
💾 **Offline Settings**: User preferences saved locally
🔄 **Auto-Refresh**: Configurable automatic data updates

## Quick Start

### Prerequisites
- Flutter SDK (>= 3.10.0)
- Android Studio or VS Code
- Android device or emulator

### Installation

1. **Navigate to flutter app directory**:
   ```bash
   cd flutter-app/
   ```

2. **Install dependencies**:
   ```bash
   flutter pub get
   ```

3. **Run the app**:
   ```bash
   flutter run
   ```

### Build for Release

**Android APK**:
```bash
flutter build apk --release
```

**Android App Bundle (for Play Store)**:
```bash
flutter build appbundle --release
```

The built files will be in:
- `build/app/outputs/flutter-apk/app-release.apk`
- `build/app/outputs/bundle/release/app-release.aab`

## App Structure

```
lib/
├── main.dart                 # App entry point
├── models/
│   └── pricing_data.dart     # Data models and types
├── providers/
│   └── pricing_provider.dart # State management
├── screens/
│   ├── home_screen.dart      # Main dashboard
│   └── settings_screen.dart  # App configuration
├── services/
│   ├── comed_api_service.dart    # ComEd API integration
│   └── notification_service.dart # Push notifications
└── widgets/
    ├── current_price_card.dart   # Current pricing display
    ├── day_ahead_chart.dart      # Day-ahead price chart
    ├── price_chart.dart          # 5-minute price chart
    └── statistics_card.dart      # Price statistics
```

## Key Features

### 📊 Real-Time Dashboard
- **Current Pricing**: Latest 5-minute price and current hour average
- **Price Level Indicators**: Visual alerts based on configured thresholds
- **Statistics**: Average, min, max prices for selected time periods
- **Interactive Charts**: Touch to see detailed price and time information

### ⏰ Time Period Selection
- Last 30 minutes
- Last 1 hour  
- Last 3 hours
- Last 6 hours
- Last 24 hours

### 🔔 Smart Notifications
- **Low Price Alerts**: Notify when prices drop (great time to use electricity)
- **High Price Alerts**: Warn when prices spike (reduce usage)
- **Customizable Thresholds**: Set your own price trigger points
- **Native Android Notifications**: Works even when app is closed

### 📅 Day-Ahead Planning
- **Hourly Forecasts**: See tomorrow's predicted pricing
- **Color-Coded Bars**: Visual indication of price levels
- **Planning Tool**: Schedule energy-intensive tasks during low-price periods

### ⚙️ Configuration
- **Alert Thresholds**: Customize low/medium/high price levels
- **Auto-Refresh**: Enable/disable automatic updates every 5 minutes
- **Notification Settings**: Control push notification preferences
- **Data Source Info**: View API status and last update time

## Data Source

The app connects directly to ComEd's public API:
- **5-Minute Feed**: Real-time pricing data updated every 5 minutes
- **Current Hour Average**: Rolling average for the current hour
- **Day-Ahead Pricing**: Next-day hourly forecasts
- **Timezone**: All times automatically converted to Central Time

## Privacy & Permissions

The app requires minimal permissions:
- **Internet**: To fetch pricing data from ComEd API
- **Notifications**: To send price alerts (optional)
- **Storage**: To save user preferences locally

**No personal data is collected or transmitted.** All settings are stored locally on your device.

## Technical Details

### State Management
- **Provider Pattern**: Reactive state management with ChangeNotifier
- **Local Storage**: SharedPreferences for persistent settings
- **Error Handling**: Comprehensive error states and retry mechanisms

### Charts & Visualization
- **FL Chart**: High-performance charting library
- **Interactive Elements**: Touch tooltips and zoom capabilities
- **Threshold Lines**: Visual price alert indicators on charts

### Notifications
- **Flutter Local Notifications**: Native Android notification support
- **Background Processing**: Alerts work even when app is closed
- **Customizable**: Control notification frequency and types

### API Integration
- **HTTP Client**: Direct REST API calls to ComEd endpoints
- **Timeout Handling**: Robust error handling for network issues
- **Data Parsing**: Automatic timezone conversion and data validation

## Troubleshooting

### Common Issues

**App won't load data**:
- Check internet connection
- Verify ComEd API is accessible
- Try manual refresh

**Notifications not working**:
- Enable notifications in Android settings
- Check app notification permissions
- Test with settings screen notification test button

**Charts not displaying**:
- Ensure data is loading successfully
- Check selected time period has data
- Try refreshing data

### Development

**Debug mode**:
```bash
flutter run --debug
```

**Check for issues**:
```bash
flutter doctor
flutter analyze
```

**View logs**:
```bash
flutter logs
```

## Building for Production

### Android Release Setup

1. **Create keystore**:
   ```bash
   keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```

2. **Configure signing** in `android/app/build.gradle`

3. **Build release**:
   ```bash
   flutter build appbundle --release
   ```

### Play Store Deployment

1. **Upload** the `.aab` file to Google Play Console
2. **Configure** app listing and screenshots
3. **Review** and publish

## Support

For issues or questions:
1. Check this README first
2. Review Flutter documentation
3. Check ComEd API status
4. Create an issue with logs and device info

## License

This project is open source. The ComEd API is provided by Commonwealth Edison Company.