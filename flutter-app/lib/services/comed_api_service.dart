import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/pricing_data.dart';

class ComEdApiService {
  static const String baseUrl = 'https://hourlypricing.comed.com/api';
  static const int timeoutSeconds = 30;

  /// Get 5-minute pricing data for the last 24 hours
  Future<List<PricingPoint>> getFiveMinuteFeed() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl?type=5minutefeed'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: timeoutSeconds));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => PricingPoint.fromJson(item)).toList();
      } else {
        throw Exception('Failed to load 5-minute feed: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error fetching 5-minute feed: $e');
    }
  }

  /// Get current hour average pricing
  Future<PricingPoint?> getCurrentHourAverage() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl?type=currenthouraverage'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: timeoutSeconds));

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        if (data.isNotEmpty) {
          return PricingPoint.fromJson(data.first);
        }
      }
      return null;
    } catch (e) {
      throw Exception('Error fetching current hour average: $e');
    }
  }

  /// Get day-ahead pricing for a specific date
  Future<List<HourlyPrice>> getDayAheadPricing(DateTime date) async {
    try {
      final dateStr = '${date.year}${date.month.toString().padLeft(2, '0')}${date.day.toString().padLeft(2, '0')}';
      final response = await http.get(
        Uri.parse('$baseUrl?type=daheadhourlylmp&datestart=$dateStr&dateend=$dateStr'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: timeoutSeconds));

      if (response.statusCode == 200) {
        final String responseText = response.body;
        return _parseDayAheadResponse(responseText, date);
      } else {
        throw Exception('Failed to load day-ahead pricing: ${response.statusCode}');
      }
    } catch (e) {
      throw Exception('Error fetching day-ahead pricing: $e');
    }
  }

  /// Parse day-ahead response which comes in JavaScript array format
  List<HourlyPrice> _parseDayAheadResponse(String responseText, DateTime baseDate) {
    final List<HourlyPrice> hourlyPrices = [];
    
    try {
      // Extract the array data between [ and ]
      final start = responseText.indexOf('[');
      final end = responseText.lastIndexOf(']');
      
      if (start != -1 && end != -1) {
        final arrayContent = responseText.substring(start + 1, end);
        final values = arrayContent.split(',').map((s) => s.trim()).toList();
        
        for (int hour = 0; hour < 24 && hour < values.length; hour++) {
          final priceStr = values[hour].replaceAll('"', '');
          final price = double.tryParse(priceStr);
          
          if (price != null) {
            final dateTime = DateTime(
              baseDate.year,
              baseDate.month,
              baseDate.day,
              hour,
            );
            
            hourlyPrices.add(HourlyPrice(
              hour: hour,
              price: price,
              dateTime: dateTime,
            ));
          }
        }
      }
    } catch (e) {
      throw Exception('Error parsing day-ahead response: $e');
    }
    
    return hourlyPrices;
  }

  /// Check if the ComEd API is responding
  Future<bool> checkApiStatus() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl?type=currenthouraverage'),
        headers: {'Accept': 'application/json'},
      ).timeout(const Duration(seconds: 10));
      
      return response.statusCode == 200;
    } catch (e) {
      return false;
    }
  }

  /// Get 5-minute data filtered by time range
  Future<List<PricingPoint>> getFiveMinuteDataForPeriod(Duration period) async {
    final allData = await getFiveMinuteFeed();
    final cutoffTime = DateTime.now().subtract(period);
    
    return allData.where((point) => point.dateTime.isAfter(cutoffTime)).toList();
  }
}