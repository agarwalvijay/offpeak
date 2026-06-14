import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/pricing_provider.dart';

class PriceChart extends StatelessWidget {
  const PriceChart({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, _) {
        final data = provider.filteredFiveMinuteData;
        final alertSettings = provider.alertSettings;

        if (data.length < 2) {
          return const _EmptyChart(
            icon: Icons.timeline,
            message: 'Not enough data yet',
          );
        }

        final spots = <FlSpot>[];
        for (var i = 0; i < data.length; i++) {
          spots.add(FlSpot(i.toDouble(), data[i].price));
        }
        final prices = data.map((d) => d.price);
        final minP = prices.reduce((a, b) => a < b ? a : b);
        final maxP = prices.reduce((a, b) => a > b ? a : b);
        final pad = ((maxP - minP).abs() * 0.15).clamp(0.2, 4.0);
        final yMin = (minP - pad);
        final yMax = (maxP + pad);

        // Show ~4 evenly spaced X labels.
        final xLabelStep = (data.length / 4).floor().clamp(1, data.length - 1);

        final primary = Theme.of(context).colorScheme.primary;

        return LineChart(
          LineChartData(
            minX: 0,
            maxX: (data.length - 1).toDouble(),
            minY: yMin,
            maxY: yMax,
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              horizontalInterval: ((yMax - yMin) / 4).clamp(0.5, double.infinity),
              getDrawingHorizontalLine: (_) => FlLine(
                color: Colors.grey.withOpacity(0.18),
                strokeWidth: 1,
              ),
            ),
            titlesData: FlTitlesData(
              rightTitles:
                  const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              topTitles:
                  const AxisTitles(sideTitles: SideTitles(showTitles: false)),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 28,
                  interval: xLabelStep.toDouble(),
                  getTitlesWidget: (value, meta) {
                    final i = value.round();
                    if (i < 0 || i >= data.length) return const SizedBox.shrink();
                    return Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text(
                        data[i].formattedTime,
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
                  interval: ((yMax - yMin) / 4).clamp(0.5, double.infinity),
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
            extraLinesData: ExtraLinesData(
              horizontalLines: [
                _thresholdLine(alertSettings.lowThreshold, Colors.green, 'Low'),
                _thresholdLine(
                    alertSettings.mediumThreshold, Colors.orange, 'Med'),
                _thresholdLine(alertSettings.highThreshold, Colors.red, 'High'),
              ],
            ),
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                curveSmoothness: 0.25,
                color: primary,
                barWidth: 3,
                isStrokeCapRound: true,
                dotData: FlDotData(
                  show: data.length <= 24,
                  getDotPainter: (s, p, b, i) => FlDotCirclePainter(
                    radius: 3,
                    color: primary,
                    strokeWidth: 2,
                    strokeColor: Colors.white,
                  ),
                ),
                belowBarData: BarAreaData(
                  show: true,
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      primary.withOpacity(0.22),
                      primary.withOpacity(0.0),
                    ],
                  ),
                ),
              ),
            ],
            lineTouchData: LineTouchData(
              enabled: true,
              touchTooltipData: LineTouchTooltipData(
                getTooltipColor: (_) => Colors.black.withOpacity(0.85),
                tooltipRoundedRadius: 8,
                getTooltipItems: (touched) {
                  return touched.map((s) {
                    final i = s.x.toInt();
                    if (i < 0 || i >= data.length) return null;
                    final p = data[i];
                    return LineTooltipItem(
                      '${p.formattedDateTime}\n${p.formattedPrice}',
                      const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    );
                  }).toList();
                },
              ),
            ),
          ),
        );
      },
    );
  }

  HorizontalLine _thresholdLine(double y, Color color, String label) {
    return HorizontalLine(
      y: y,
      color: color.withOpacity(0.5),
      strokeWidth: 1,
      dashArray: [4, 4],
      label: HorizontalLineLabel(
        show: true,
        alignment: Alignment.topRight,
        padding: const EdgeInsets.only(right: 4, bottom: 2),
        labelResolver: (_) => label,
        style: TextStyle(
          color: color.withOpacity(0.85),
          fontSize: 9,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _EmptyChart extends StatelessWidget {
  final IconData icon;
  final String message;

  const _EmptyChart({required this.icon, required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 40, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(
            message,
            style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
          ),
        ],
      ),
    );
  }
}
