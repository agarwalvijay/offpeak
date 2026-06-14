import 'dart:async';
import 'package:flutter/foundation.dart';
import '../services/simple_settings.dart';
import '../models/pricing_data.dart';
import '../services/comed_api_service.dart';

enum DayAheadDay { today, tomorrow }

class PricingProvider extends ChangeNotifier {
  final ComEdApiService _apiService = ComEdApiService();

  List<PricingPoint> _fiveMinuteData = [];
  PricingPoint? _currentHourAverage;
  List<HourlyPrice> _dayAheadData = [];
  DayAheadDay _dayAheadDay = DayAheadDay.today;

  AlertSettings _alertSettings = AlertSettings();
  bool _autoRefresh = true;
  TimePeriod _selectedTimePeriod = TimePeriod.oneHour;

  bool _isLoading = false;
  String? _errorMessage;
  DateTime? _lastUpdate;
  Timer? _refreshTimer;

  /// 5-minute data sorted ascending (oldest → newest).
  List<PricingPoint> get fiveMinuteData => _fiveMinuteData;
  PricingPoint? get currentHourAverage => _currentHourAverage;
  List<HourlyPrice> get dayAheadData => _dayAheadData;
  DayAheadDay get dayAheadDay => _dayAheadDay;
  AlertSettings get alertSettings => _alertSettings;
  bool get autoRefresh => _autoRefresh;
  TimePeriod get selectedTimePeriod => _selectedTimePeriod;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  DateTime? get lastUpdate => _lastUpdate;

  /// Subset of 5-min data within the currently selected look-back window,
  /// preserving ascending order.
  List<PricingPoint> get filteredFiveMinuteData {
    if (_fiveMinuteData.isEmpty) return const [];
    final newest = _fiveMinuteData.last.dateTime;
    final cutoff = newest.subtract(_selectedTimePeriod.duration);
    return _fiveMinuteData.where((p) => !p.dateTime.isBefore(cutoff)).toList();
  }

  /// Stats for the filtered window.
  PricingStatistics get statistics =>
      PricingStatistics.fromPricingData(filteredFiveMinuteData);

  /// Most recent 5-min reading.
  PricingPoint? get latestPoint =>
      _fiveMinuteData.isEmpty ? null : _fiveMinuteData.last;

  /// Hourly averages of completed (or in-progress) hours TODAY, derived from
  /// the 5-minute feed. Useful for overlaying actuals on day-ahead forecasts.
  List<HourlyPrice> get todayActualHourly {
    if (_fiveMinuteData.isEmpty) return const [];
    final now = DateTime.now();
    final groups = <int, List<double>>{};
    for (final p in _fiveMinuteData) {
      if (p.dateTime.year == now.year &&
          p.dateTime.month == now.month &&
          p.dateTime.day == now.day) {
        groups.putIfAbsent(p.dateTime.hour, () => []).add(p.price);
      }
    }
    final out = <HourlyPrice>[];
    groups.forEach((hour, prices) {
      final avg = prices.reduce((a, b) => a + b) / prices.length;
      out.add(HourlyPrice(
        hour: hour,
        price: avg,
        dateTime: DateTime(now.year, now.month, now.day, hour),
      ));
    });
    out.sort((a, b) => a.hour.compareTo(b.hour));
    return out;
  }

  double? get currentPrice => latestPoint?.price;

  AlertLevel get currentAlertLevel {
    final price = currentPrice;
    if (price == null) return AlertLevel.normal;
    return _alertSettings.getAlertLevel(price);
  }

  PricingProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    await _loadSettings();
    _startAutoRefresh();
    await refreshData();
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> refreshData() async {
    _setLoading(true);
    _clearError();

    try {
      final dayAheadDate = _dayAheadDay == DayAheadDay.today
          ? DateTime.now()
          : DateTime.now().add(const Duration(days: 1));

      final results = await Future.wait([
        _apiService.getFiveMinuteFeed(),
        _apiService.getCurrentHourAverage(),
        _apiService.getDayAheadPricing(dayAheadDate),
      ]);

      _fiveMinuteData = results[0] as List<PricingPoint>;
      _currentHourAverage = results[1] as PricingPoint?;
      _dayAheadData = results[2] as List<HourlyPrice>;
      _lastUpdate = DateTime.now();
    } catch (e) {
      _setError(e.toString().replaceFirst('Exception: ', ''));
    } finally {
      _setLoading(false);
    }
  }

  void updateAlertSettings(AlertSettings newSettings) {
    _alertSettings = newSettings;
    _saveSettings();
    notifyListeners();
  }

  void setAutoRefresh(bool enabled) {
    _autoRefresh = enabled;
    _saveSettings();
    if (enabled) {
      _startAutoRefresh();
    } else {
      _refreshTimer?.cancel();
      _refreshTimer = null;
    }
    notifyListeners();
  }

  void setTimePeriod(TimePeriod period) {
    _selectedTimePeriod = period;
    _saveSettings();
    notifyListeners();
  }

  void setDayAheadDay(DayAheadDay day) {
    if (_dayAheadDay == day) return;
    _dayAheadDay = day;
    notifyListeners();
    refreshData();
  }

  void _startAutoRefresh() {
    _refreshTimer?.cancel();
    if (_autoRefresh) {
      _refreshTimer = Timer.periodic(
        const Duration(minutes: 5),
        (_) => refreshData(),
      );
    }
  }

  void _setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void _setError(String error) {
    _errorMessage = error;
    notifyListeners();
  }

  void _clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> _loadSettings() async {
    try {
      _alertSettings = AlertSettings(
        lowThreshold: SimpleSettings.getDouble('low', defaultValue: 3.0),
        mediumThreshold: SimpleSettings.getDouble('medium', defaultValue: 6.0),
        highThreshold: SimpleSettings.getDouble('high', defaultValue: 10.0),
      );
      _autoRefresh = SimpleSettings.getBool('autoRefresh', defaultValue: true);
      final periodIndex = SimpleSettings.getDouble(
        'timePeriod',
        defaultValue: TimePeriod.oneHour.index.toDouble(),
      ).round();
      if (periodIndex >= 0 && periodIndex < TimePeriod.values.length) {
        _selectedTimePeriod = TimePeriod.values[periodIndex];
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) print('Settings load failed: $e');
    }
  }

  Future<void> _saveSettings() async {
    try {
      await SimpleSettings.setDouble('low', _alertSettings.lowThreshold);
      await SimpleSettings.setDouble('medium', _alertSettings.mediumThreshold);
      await SimpleSettings.setDouble('high', _alertSettings.highThreshold);
      await SimpleSettings.setBool('autoRefresh', _autoRefresh);
      await SimpleSettings.setDouble(
        'timePeriod',
        _selectedTimePeriod.index.toDouble(),
      );
    } catch (e) {
      if (kDebugMode) print('Settings save failed: $e');
    }
  }
}
