import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';

class CurrentPriceCard extends StatelessWidget {
  const CurrentPriceCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, _) {
        final latest = provider.latestPoint;
        final price = latest?.price;
        final level = provider.currentAlertLevel;
        final color = _alertColor(level);

        // 5-min change vs previous reading.
        double? delta;
        final all = provider.fiveMinuteData;
        if (all.length >= 2) {
          delta = all.last.price - all[all.length - 2].price;
        }

        // Sparkline points: last hour.
        final hourCutoff = (latest?.dateTime ?? DateTime.now())
            .subtract(const Duration(hours: 1));
        final spark = all
            .where((p) => !p.dateTime.isBefore(hourCutoff))
            .map((p) => p.price)
            .toList();

        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [color.withOpacity(0.92), color.withOpacity(0.78)],
            ),
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.25),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.bolt, color: Colors.white, size: 18),
                  const SizedBox(width: 6),
                  const Text(
                    'CURRENT PRICE',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const Spacer(),
                  _LevelPill(level: level),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    price == null ? '—' : price.toStringAsFixed(2),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 56,
                      fontWeight: FontWeight.w800,
                      height: 1,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Padding(
                    padding: EdgeInsets.only(bottom: 8),
                    child: Text(
                      '¢/kWh',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const Spacer(),
                  if (delta != null) _DeltaBadge(delta: delta),
                ],
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  Icon(Icons.access_time,
                      size: 13, color: Colors.white.withOpacity(0.85)),
                  const SizedBox(width: 4),
                  Text(
                    latest == null
                        ? 'No data'
                        : 'as of ${latest.formattedTime}'
                            ' · ${_minutesAgo(latest.dateTime)}',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.92),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
              if (spark.length >= 2) ...[
                const SizedBox(height: 14),
                SizedBox(
                  height: 48,
                  child: _Sparkline(prices: spark),
                ),
              ],
            ],
          ),
        );
      },
    );
  }

  static String _minutesAgo(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    final h = diff.inHours;
    return '${h}h ago';
  }
}

class _LevelPill extends StatelessWidget {
  final AlertLevel level;
  const _LevelPill({required this.level});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.22),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        level.displayName.toUpperCase(),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.0,
        ),
      ),
    );
  }
}

class _DeltaBadge extends StatelessWidget {
  final double delta;
  const _DeltaBadge({required this.delta});

  @override
  Widget build(BuildContext context) {
    final isUp = delta > 0;
    final isFlat = delta.abs() < 0.05;
    final icon = isFlat
        ? Icons.remove
        : (isUp ? Icons.arrow_upward : Icons.arrow_downward);
    final label = '${isUp ? '+' : ''}${delta.toStringAsFixed(2)}¢';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.22),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}

class _Sparkline extends StatelessWidget {
  final List<double> prices;
  const _Sparkline({required this.prices});

  @override
  Widget build(BuildContext context) {
    final spots = <FlSpot>[];
    for (var i = 0; i < prices.length; i++) {
      spots.add(FlSpot(i.toDouble(), prices[i]));
    }
    final minP = prices.reduce((a, b) => a < b ? a : b);
    final maxP = prices.reduce((a, b) => a > b ? a : b);
    final pad = ((maxP - minP).abs() * 0.15).clamp(0.1, 5.0);
    return LineChart(
      LineChartData(
        minY: minP - pad,
        maxY: maxP + pad,
        titlesData: const FlTitlesData(show: false),
        gridData: const FlGridData(show: false),
        borderData: FlBorderData(show: false),
        lineTouchData: const LineTouchData(enabled: false),
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.25,
            barWidth: 2.5,
            color: Colors.white,
            isStrokeCapRound: true,
            dotData: FlDotData(
              show: true,
              checkToShowDot: (s, _) => s.x == spots.last.x,
              getDotPainter: (s, p, b, i) => FlDotCirclePainter(
                radius: 3.5,
                color: Colors.white,
                strokeWidth: 0,
              ),
            ),
            belowBarData: BarAreaData(
              show: true,
              color: Colors.white.withOpacity(0.22),
            ),
          ),
        ],
      ),
    );
  }
}

Color _alertColor(AlertLevel level) {
  switch (level) {
    case AlertLevel.low:
      return const Color(0xFF16A34A);
    case AlertLevel.normal:
      return const Color(0xFF1E3A8A);
    case AlertLevel.medium:
      return const Color(0xFFEA580C);
    case AlertLevel.high:
      return const Color(0xFFDC2626);
  }
}
