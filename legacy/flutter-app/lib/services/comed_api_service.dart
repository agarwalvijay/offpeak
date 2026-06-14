import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/pricing_data.dart';

class ComEdApiService {
  static const String fiveMinUrl =
      'https://hourlypricing.comed.com/api?type=5minutefeed';
  static const String currentHourAvgUrl =
      'https://hourlypricing.comed.com/api?type=currenthouraverage';
  static const Duration _timeout = Duration(seconds: 20);

  /// 5-minute pricing feed for the last 24 hours, sorted ascending by time.
  Future<List<PricingPoint>> getFiveMinuteFeed() async {
    final response = await http
        .get(Uri.parse(fiveMinUrl), headers: const {'Accept': 'application/json'})
        .timeout(_timeout);

    if (response.statusCode != 200) {
      throw Exception('5-min feed: HTTP ${response.statusCode}');
    }
    final List<dynamic> data = json.decode(response.body);
    final points = data.map((e) => PricingPoint.fromJson(e)).toList()
      ..sort((a, b) => a.dateTime.compareTo(b.dateTime));
    return points;
  }

  /// Average price for the current hour.
  Future<PricingPoint?> getCurrentHourAverage() async {
    final response = await http
        .get(Uri.parse(currentHourAvgUrl),
            headers: const {'Accept': 'application/json'})
        .timeout(_timeout);

    if (response.statusCode != 200) return null;
    final List<dynamic> data = json.decode(response.body);
    if (data.isEmpty) return null;
    return PricingPoint.fromJson(data.first);
  }

  /// Day-ahead hourly pricing for the given date (Chicago local). Returns
  /// an empty list if the endpoint hasn't published data for that date yet.
  Future<List<HourlyPrice>> getDayAheadPricing(DateTime date) async {
    final dateStr = '${date.year}'
        '${date.month.toString().padLeft(2, '0')}'
        '${date.day.toString().padLeft(2, '0')}';
    final ts = DateTime.now().millisecondsSinceEpoch;
    final url =
        'https://hourlypricing.comed.com/rrtp/ServletFeed?type=daynexttoday&date=$dateStr&_=$ts';

    final response = await http
        .get(Uri.parse(url), headers: const {'Accept': 'text/plain'})
        .timeout(_timeout);
    if (response.statusCode != 200) return [];

    return _parseDayAhead(response.body);
  }

  /// Response is `[[Date.UTC(y,m,d,h,mm,ss), price], …]` where `m` is 0-based.
  /// The values are already Chicago local time despite the `Date.UTC` wrapper,
  /// so we treat them as wall-clock hours for the chart.
  List<HourlyPrice> _parseDayAhead(String body) {
    final pattern = RegExp(
      r'Date\.UTC\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\),\s*([\d.]+)',
    );
    final out = <HourlyPrice>[];
    for (final m in pattern.allMatches(body)) {
      final year = int.parse(m.group(1)!);
      final month = int.parse(m.group(2)!) + 1;
      final day = int.parse(m.group(3)!);
      final hour = int.parse(m.group(4)!);
      final price = double.tryParse(m.group(7)!);
      if (price == null) continue;
      out.add(HourlyPrice(
        hour: hour,
        price: price,
        dateTime: DateTime(year, month, day, hour),
      ));
    }
    out.sort((a, b) => a.dateTime.compareTo(b.dateTime));
    return out;
  }
}
