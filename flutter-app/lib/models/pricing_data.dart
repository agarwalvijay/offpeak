import 'package:intl/intl.dart';

class PricingPoint {
  final DateTime dateTime;
  final double price;
  
  PricingPoint({
    required this.dateTime,
    required this.price,
  });

  factory PricingPoint.fromJson(Map<String, dynamic> json) {
    // Convert millisUTC to DateTime in Central Time
    final millisUtc = json['millisUTC'] as int;
    final utcDateTime = DateTime.fromMillisecondsSinceEpoch(millisUtc);
    
    // Convert to Central Time (UTC-6 in standard time, UTC-5 in daylight time)
    // Flutter handles DST automatically with local timezone conversion
    final centralDateTime = utcDateTime.toLocal();
    
    return PricingPoint(
      dateTime: centralDateTime,
      price: (json['price'] as num).toDouble(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'millisUTC': dateTime.millisecondsSinceEpoch,
      'price': price,
    };
  }

  String get formattedTime => DateFormat('HH:mm').format(dateTime);
  String get formattedDate => DateFormat('MMM dd').format(dateTime);
  String get formattedDateTime => DateFormat('MMM dd, HH:mm').format(dateTime);
  String get formattedPrice => '${price.toStringAsFixed(2)}¢';
}

class HourlyPrice {
  final int hour;
  final double price;
  final DateTime dateTime;
  
  HourlyPrice({
    required this.hour,
    required this.price,
    required this.dateTime,
  });

  String get formattedHour => DateFormat('HH:mm').format(dateTime);
  String get formattedPrice => '${price.toStringAsFixed(2)}¢';
}

class PricingStatistics {
  final double average;
  final double minimum;
  final double maximum;
  final double median;
  final int dataPoints;
  
  PricingStatistics({
    required this.average,
    required this.minimum,
    required this.maximum,
    required this.median,
    required this.dataPoints,
  });

  factory PricingStatistics.fromPricingData(List<PricingPoint> data) {
    if (data.isEmpty) {
      return PricingStatistics(
        average: 0,
        minimum: 0,
        maximum: 0,
        median: 0,
        dataPoints: 0,
      );
    }

    final prices = data.map((p) => p.price).toList()..sort();
    final sum = prices.reduce((a, b) => a + b);
    
    return PricingStatistics(
      average: sum / prices.length,
      minimum: prices.first,
      maximum: prices.last,
      median: prices.length % 2 == 0
          ? (prices[prices.length ~/ 2 - 1] + prices[prices.length ~/ 2]) / 2
          : prices[prices.length ~/ 2],
      dataPoints: data.length,
    );
  }

  String get formattedAverage => '${average.toStringAsFixed(2)}¢';
  String get formattedMinimum => '${minimum.toStringAsFixed(2)}¢';
  String get formattedMaximum => '${maximum.toStringAsFixed(2)}¢';
  String get formattedMedian => '${median.toStringAsFixed(2)}¢';
}

class AlertSettings {
  double lowThreshold;
  double mediumThreshold;
  double highThreshold;
  bool alertsEnabled;
  
  AlertSettings({
    this.lowThreshold = 3.0,
    this.mediumThreshold = 6.0,
    this.highThreshold = 10.0,
    this.alertsEnabled = true,
  });

  Map<String, dynamic> toJson() {
    return {
      'lowThreshold': lowThreshold,
      'mediumThreshold': mediumThreshold,
      'highThreshold': highThreshold,
      'alertsEnabled': alertsEnabled,
    };
  }

  factory AlertSettings.fromJson(Map<String, dynamic> json) {
    return AlertSettings(
      lowThreshold: (json['lowThreshold'] ?? 3.0).toDouble(),
      mediumThreshold: (json['mediumThreshold'] ?? 6.0).toDouble(),
      highThreshold: (json['highThreshold'] ?? 10.0).toDouble(),
      alertsEnabled: json['alertsEnabled'] ?? true,
    );
  }

  AlertLevel getAlertLevel(double price) {
    if (price >= highThreshold) return AlertLevel.high;
    if (price >= mediumThreshold) return AlertLevel.medium;
    if (price <= lowThreshold) return AlertLevel.low;
    return AlertLevel.normal;
  }
}

enum AlertLevel {
  low,
  normal,
  medium,
  high,
}

extension AlertLevelExtension on AlertLevel {
  String get displayName {
    switch (this) {
      case AlertLevel.low:
        return 'Low Price';
      case AlertLevel.normal:
        return 'Normal';
      case AlertLevel.medium:
        return 'Medium Price';
      case AlertLevel.high:
        return 'High Price';
    }
  }

  String get description {
    switch (this) {
      case AlertLevel.low:
        return 'Great time to use electricity!';
      case AlertLevel.normal:
        return 'Standard pricing';
      case AlertLevel.medium:
        return 'Consider reducing usage';
      case AlertLevel.high:
        return 'Avoid high-energy activities';
    }
  }
}

enum TimePeriod {
  thirtyMinutes,
  oneHour,
  threeHours,
  sixHours,
  twentyFourHours,
}

extension TimePeriodExtension on TimePeriod {
  String get displayName {
    switch (this) {
      case TimePeriod.thirtyMinutes:
        return 'Last 30 minutes';
      case TimePeriod.oneHour:
        return 'Last 1 hour';
      case TimePeriod.threeHours:
        return 'Last 3 hours';
      case TimePeriod.sixHours:
        return 'Last 6 hours';
      case TimePeriod.twentyFourHours:
        return 'Last 24 hours';
    }
  }

  Duration get duration {
    switch (this) {
      case TimePeriod.thirtyMinutes:
        return const Duration(minutes: 30);
      case TimePeriod.oneHour:
        return const Duration(hours: 1);
      case TimePeriod.threeHours:
        return const Duration(hours: 3);
      case TimePeriod.sixHours:
        return const Duration(hours: 6);
      case TimePeriod.twentyFourHours:
        return const Duration(hours: 24);
    }
  }
}