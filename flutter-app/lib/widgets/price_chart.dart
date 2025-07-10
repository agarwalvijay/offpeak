import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';

class PriceChart extends StatelessWidget {
  const PriceChart({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, child) {
        final data = provider.filteredFiveMinuteData;
        final alertSettings = provider.alertSettings;

        if (data.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.timeline, size: 48, color: Colors.grey),
                SizedBox(height: 8),
                Text('No data available'),
              ],
            ),
          );
        }

        // Convert data to chart spots
        final spots = data.asMap().entries.map((entry) {
          return FlSpot(entry.key.toDouble(), entry.value.price);
        }).toList();

        // Calculate min/max for Y-axis
        final prices = data.map((p) => p.price).toList();
        final minPrice = prices.reduce((a, b) => a < b ? a : b);
        final maxPrice = prices.reduce((a, b) => a > b ? a : b);
        final padding = (maxPrice - minPrice) * 0.1;

        return LineChart(
          LineChartData(
            gridData: FlGridData(
              show: true,
              drawVerticalLine: true,
              horizontalInterval: (maxPrice - minPrice) / 5,
              verticalInterval: data.length > 10 ? (data.length / 5).floorToDouble() : 1,
              getDrawingHorizontalLine: (value) {
                return FlLine(
                  color: Colors.grey.withOpacity(0.3),
                  strokeWidth: 1,
                );
              },
              getDrawingVerticalLine: (value) {
                return FlLine(
                  color: Colors.grey.withOpacity(0.3),
                  strokeWidth: 1,
                );
              },
            ),
            titlesData: FlTitlesData(
              show: true,
              rightTitles: AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              topTitles: AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 30,
                  interval: data.length > 10 ? (data.length / 4).floorToDouble() : 1,
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    if (index >= 0 && index < data.length) {
                      return SideTitleWidget(
                        axisSide: meta.axisSide,
                        child: Text(
                          data[index].formattedTime,
                          style: const TextStyle(
                            color: Colors.grey,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      );
                    }
                    return Container();
                  },
                ),
              ),
              leftTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  interval: (maxPrice - minPrice) / 4,
                  reservedSize: 42,
                  getTitlesWidget: (value, meta) {
                    return Text(
                      '${value.toStringAsFixed(1)}¢',
                      style: const TextStyle(
                        color: Colors.grey,
                        fontWeight: FontWeight.bold,
                        fontSize: 10,
                      ),
                    );
                  },
                ),
              ),
            ),
            borderData: FlBorderData(
              show: true,
              border: Border.all(color: Colors.grey.withOpacity(0.3)),
            ),
            minX: 0,
            maxX: (data.length - 1).toDouble(),
            minY: minPrice - padding,
            maxY: maxPrice + padding,
            lineBarsData: [
              LineChartBarData(
                spots: spots,
                isCurved: true,
                color: Theme.of(context).primaryColor,
                barWidth: 3,
                isStrokeCapRound: true,
                dotData: FlDotData(
                  show: data.length <= 50, // Show dots only for smaller datasets
                  getDotPainter: (spot, percent, barData, index) {
                    return FlDotCirclePainter(
                      radius: 3,
                      color: Theme.of(context).primaryColor,
                      strokeWidth: 2,
                      strokeColor: Colors.white,
                    );
                  },
                ),
                belowBarData: BarAreaData(
                  show: true,
                  color: Theme.of(context).primaryColor.withOpacity(0.1),
                ),
              ),
            ],
            extraLinesData: ExtraLinesData(
              horizontalLines: [
                // Alert threshold lines
                HorizontalLine(
                  y: alertSettings.lowThreshold,
                  color: Colors.green,
                  strokeWidth: 2,
                  dashArray: [5, 5],
                  label: HorizontalLineLabel(
                    show: true,
                    labelResolver: (line) => 'Low: ${line.y.toStringAsFixed(1)}¢',
                    style: const TextStyle(
                      color: Colors.green,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
                HorizontalLine(
                  y: alertSettings.mediumThreshold,
                  color: Colors.orange,
                  strokeWidth: 2,
                  dashArray: [5, 5],
                  label: HorizontalLineLabel(
                    show: true,
                    labelResolver: (line) => 'Med: ${line.y.toStringAsFixed(1)}¢',
                    style: const TextStyle(
                      color: Colors.orange,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
                HorizontalLine(
                  y: alertSettings.highThreshold,
                  color: Colors.red,
                  strokeWidth: 2,
                  dashArray: [5, 5],
                  label: HorizontalLineLabel(
                    show: true,
                    labelResolver: (line) => 'High: ${line.y.toStringAsFixed(1)}¢',
                    style: const TextStyle(
                      color: Colors.red,
                      fontWeight: FontWeight.bold,
                      fontSize: 10,
                    ),
                  ),
                ),
              ],
            ),
            lineTouchData: LineTouchData(
              enabled: true,
              touchTooltipData: LineTouchTooltipData(
                tooltipBgColor: Colors.blueGrey.withOpacity(0.8),
                getTooltipItems: (List<LineBarSpot> touchedBarSpots) {
                  return touchedBarSpots.map((barSpot) {
                    final index = barSpot.x.toInt();
                    if (index >= 0 && index < data.length) {
                      final point = data[index];
                      return LineTooltipItem(
                        '${point.formattedDateTime}\n${point.formattedPrice}',
                        const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      );
                    }
                    return null;
                  }).toList();
                },
              ),
            ),
          ),
        );
      },
    );
  }
}