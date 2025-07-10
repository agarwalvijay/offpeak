import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/simple_settings.dart';
import '../models/pricing_data.dart';
import '../services/comed_api_service.dart';
import '../services/notification_service.dart';

class PricingProvider extends ChangeNotifier {
  final ComEdApiService _apiService = ComEdApiService();
  
  // Current data
  List<PricingPoint> _fiveMinuteData = [];
  PricingPoint? _currentHourAverage;
  List<HourlyPrice> _dayAheadData = [];
  
  // Settings
  AlertSettings _alertSettings = AlertSettings();
  bool _autoRefresh = true;
  TimePeriod _selectedTimePeriod = TimePeriod.twentyFourHours;
  
  // State
  bool _isLoading = false;
  String? _errorMessage;
  DateTime? _lastUpdate;
  Timer? _refreshTimer;

  // Getters
  List<PricingPoint> get fiveMinuteData => _fiveMinuteData;
  PricingPoint? get currentHourAverage => _currentHourAverage;
  List<HourlyPrice> get dayAheadData => _dayAheadData;
  AlertSettings get alertSettings => _alertSettings;
  bool get autoRefresh => _autoRefresh;
  TimePeriod get selectedTimePeriod => _selectedTimePeriod;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  DateTime? get lastUpdate => _lastUpdate;

  // Filtered data based on selected time period
  List<PricingPoint> get filteredFiveMinuteData {
    final cutoffTime = DateTime.now().subtract(_selectedTimePeriod.duration);
    return _fiveMinuteData.where((point) => point.dateTime.isAfter(cutoffTime)).toList();
  }

  // Statistics for filtered data
  PricingStatistics get statistics {
    return PricingStatistics.fromPricingData(filteredFiveMinuteData);
  }

  // Current price and alert level
  double? get currentPrice => _fiveMinuteData.isNotEmpty ? _fiveMinuteData.last.price : null;
  
  AlertLevel get currentAlertLevel {
    final price = currentPrice;
    if (price == null) return AlertLevel.normal;
    return _alertSettings.getAlertLevel(price);
  }

  PricingProvider() {
    _loadSettings();
    _startAutoRefresh();
    refreshData();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  /// Load data from ComEd API
  Future<void> refreshData() async {
    _setLoading(true);
    _clearError();

    try {
      // Fetch all data concurrently
      final futures = await Future.wait([
        _apiService.getFiveMinuteFeed(),
        _apiService.getCurrentHourAverage(),
        _apiService.getDayAheadPricing(DateTime.now()),
      ]);

      _fiveMinuteData = futures[0] as List<PricingPoint>;
      _currentHourAverage = futures[1] as PricingPoint?;
      _dayAheadData = futures[2] as List<HourlyPrice>;

      _lastUpdate = DateTime.now();
      
      // Check for price alerts
      _checkPriceAlerts();
      
    } catch (e) {
      _setError('Failed to load pricing data: ${e.toString()}');
    } finally {
      _setLoading(false);
    }
  }

  /// Update alert settings
  void updateAlertSettings(AlertSettings newSettings) {
    _alertSettings = newSettings;
    _saveSettings();
    notifyListeners();
  }

  /// Toggle auto-refresh
  void setAutoRefresh(bool enabled) {
    _autoRefresh = enabled;
    _saveSettings();
    
    if (enabled) {
      _startAutoRefresh();
    } else {
      _stopAutoRefresh();
    }
    
    notifyListeners();
  }

  /// Change selected time period
  void setTimePeriod(TimePeriod period) {
    _selectedTimePeriod = period;
    _saveSettings();
    notifyListeners();
  }

  /// Check if current price triggers any alerts
  void _checkPriceAlerts() {
    if (!_alertSettings.alertsEnabled || currentPrice == null) return;

    final alertLevel = currentAlertLevel;
    final price = currentPrice!;

    switch (alertLevel) {
      case AlertLevel.high:
        NotificationService.showNotification(
          'High Electricity Price Alert',
          'Current price: ${price.toStringAsFixed(2)}¢/kWh - Consider reducing usage',
        );
        break;
      case AlertLevel.low:
        NotificationService.showNotification(
          'Low Electricity Price Opportunity',
          'Current price: ${price.toStringAsFixed(2)}¢/kWh - Great time to use electricity!',
        );
        break;
      default:
        break;
    }
  }

  /// Start auto-refresh timer (every 5 minutes)
  void _startAutoRefresh() {
    _stopAutoRefresh();
    if (_autoRefresh) {
      _refreshTimer = Timer.periodic(
        const Duration(minutes: 5),
        (_) => refreshData(),
      );
    }
  }

  /// Stop auto-refresh timer
  void _stopAutoRefresh() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  /// Set loading state
  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  /// Set error message
  void _setError(String error) {
    _errorMessage = error;
    notifyListeners();
  }

  /// Clear error message
  void _clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  /// Load settings from SimpleSettings
  Future<void> _loadSettings() async {
    try {
      // Load alert settings
      final alertsJson = SimpleSettings.getString('alertSettings');
      if (alertsJson.isNotEmpty) {
        _alertSettings = AlertSettings.fromJson(
          Map<String, dynamic>.from(
            Uri.splitQueryString(alertsJson)
                .map((key, value) => MapEntry(key, _parseValue(value))),
          ),
        );
      }

      // Load other settings
      _autoRefresh = SimpleSettings.getBool('autoRefresh', defaultValue: true);
      final timePeriodIndex = SimpleSettings.getDouble('selectedTimePeriod', defaultValue: TimePeriod.twentyFourHours.index.toDouble()).round();
      _selectedTimePeriod = TimePeriod.values[timePeriodIndex];

      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        print('Error loading settings: $e');
      }
    }
  }

  /// Save settings to SimpleSettings
  Future<void> _saveSettings() async {
    try {
      // Save alert settings as query string format
      final alertsMap = _alertSettings.toJson();
      final alertsQuery = alertsMap.entries
          .map((e) => '${e.key}=${e.value}')
          .join('&');
      
      await SimpleSettings.setString('alertSettings', alertsQuery);
      await SimpleSettings.setBool('autoRefresh', _autoRefresh);
      await SimpleSettings.setDouble('selectedTimePeriod', _selectedTimePeriod.index.toDouble());
    } catch (e) {
      if (kDebugMode) {
        print('Error saving settings: $e');
      }
    }
  }

  /// Parse value from string to appropriate type
  dynamic _parseValue(String value) {
    if (value.toLowerCase() == 'true') return true;
    if (value.toLowerCase() == 'false') return false;
    if (double.tryParse(value) != null) return double.parse(value);
    if (int.tryParse(value) != null) return int.parse(value);
    return value;
  }
}