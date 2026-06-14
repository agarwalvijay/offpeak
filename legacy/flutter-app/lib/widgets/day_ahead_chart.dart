import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/pricing_provider.dart';

class DayAheadChart extends StatelessWidget {
  const DayAheadChart({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, _) {
        final forecast = provider.dayAheadData;
        final isToday = provider.dayAheadDay == DayAheadDay.today;
        final actuals = isToday
            ? {for (final h in provider.todayActualHourly) h.hour: h.price}
            : <int, double>{};

        if (forecast.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.calendar_today_outlined,
                    size: 40, color: Colors.grey.shade400),
                const SizedBox(height: 8),
                Text(
                  isToday
                      ? "Day-ahead prices not available"
                      : "Tomorrow's prices not yet published",
                  style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                ),
                const SizedBox(height: 4),
                Text(
                  'Typically published in the late afternoon',
                  style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                ),
              ],
            ),
          );
        }

        final cheapest =
            forecast.reduce((a, b) => a.price <= b.price ? a : b);
        final priciest =
            forecast.reduce((a, b) => a.price >= b.price ? a : b);
        final nowHour = DateTime.now().hour;

        const forecastColor = Color(0xFF93C5FD); // light blue
        const actualColor = Color(0xFF1E3A8A); // primary navy
        const cheapColor = Color(0xFF16A34A);
        const priceyColor = Color(0xFFDC2626);

        final groups = <BarChartGroupData>[];
        for (final h in forecast) {
          final actual = actuals[h.hour];
          final isCheapest = h.hour == cheapest.hour;
          final isPriciest = h.hour == priciest.hour;

          final forecastBarColor = isCheapest
              ? cheapColor.withOpacity(0.55)
              : (isPriciest ? priceyColor.withOpacity(0.55) : forecastColor);

          final rods = <BarChartRodData>[
            BarChartRodData(
              toY: h.price,
              color: forecastBarColor,
              width: 8,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(3),
              ),
            ),
          ];
          if (actual != null) {
            rods.add(BarChartRodData(
              toY: actual,
              color: h.hour == nowHour
                  ? actualColor
                  : actualColor.withOpacity(0.85),
              width: 8,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(3),
              ),
            ));
          }
          groups.add(BarChartGroupData(
            x: h.hour,
            barsSpace: 2,
            barRods: rods,
          ));
        }

        // Y-axis range across both series.
        final allValues = <double>[
          ...forecast.map((e) => e.price),
          ...actuals.values,
        ];
        final minP = allValues.reduce((a, b) => a < b ? a : b);
        final maxP = allValues.reduce((a, b) => a > b ? a : b);
        final pad = ((maxP - minP).abs() * 0.15).clamp(0.2, 4.0);
        final yMin = minP < 0 ? minP - pad : 0.0;
        final yMax = maxP + pad;

        return Column(
          children: [
            if (isToday && actuals.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Row(
                  children: const [
                    _LegendDot(color: forecastColor, label: 'Forecast'),
                    SizedBox(width: 14),
                    _LegendDot(color: actualColor, label: 'Actual'),
                  ],
                ),
              ),
            Expanded(
              child: BarChart(
                BarChartData(
                  alignment: BarChartAlignment.spaceAround,
                  minY: yMin,
                  maxY: yMax,
                  gridData: FlGridData(
                    show: true,
                    drawVerticalLine: false,
                    horizontalInterval:
                        ((yMax - yMin) / 4).clamp(0.5, double.infinity),
                    getDrawingHorizontalLine: (_) => FlLine(
                      color: Colors.grey.withOpacity(0.18),
                      strokeWidth: 1,
                    ),
                  ),
                  titlesData: FlTitlesData(
                    rightTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    topTitles: const AxisTitles(
                      sideTitles: SideTitles(showTitles: false),
                    ),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 26,
                        interval: 3,
                        getTitlesWidget: (value, _) {
                          final h = value.round();
                          if (h % 3 != 0) return const SizedBox.shrink();
                          return Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              '${h.toString().padLeft(2, '0')}h',
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    leftTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        reservedSize: 38,
                        interval: ((yMax - yMin) / 4)
                            .clamp(0.5, double.infinity),
                        getTitlesWidget: (value, _) => Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: Text(
                            '${value.toStringAsFixed(1)}¢',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                            textAlign: TextAlign.right,
                          ),
                        ),
                      ),
                    ),
                  ),
                  borderData: FlBorderData(show: false),
                  barGroups: groups,
                  barTouchData: BarTouchData(
                    enabled: true,
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipColor: (_) => Colors.black.withOpacity(0.85),
                      tooltipRoundedRadius: 8,
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        final hour = group.x;
                        final hourLabel = '${hour.toString().padLeft(2, '0')}:00';
                        final isActualRod = rodIndex == 1;
                        final label = isActualRod ? 'Actual' : 'Forecast';
                        return BarTooltipItem(
                          '$hourLabel\n$label: ${rod.toY.toStringAsFixed(2)}¢',
                          const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w600,
                          ),
                        );
                      },
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _LegendDot extends StatelessWidget {
  final Color color;
  final String label;
  const _LegendDot({required this.color, required this.label});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(color: Colors.grey.shade700, fontSize: 11),
        ),
      ],
    );
  }
}
