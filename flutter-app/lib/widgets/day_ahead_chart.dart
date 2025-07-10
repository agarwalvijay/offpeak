import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import '../providers/pricing_provider.dart';

class DayAheadChart extends StatelessWidget {
  const DayAheadChart({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, child) {
        final data = provider.dayAheadData;

        if (data.isEmpty) {
          return const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.calendar_today, size: 48, color: Colors.grey),
                SizedBox(height: 8),
                Text('No day-ahead data available'),
              ],
            ),
          );
        }

        // Convert to bar chart data
        final barGroups = data.asMap().entries.map((entry) {
          final index = entry.key;
          final hourlyPrice = entry.value;
          
          return BarChartGroupData(
            x: index,
            barRods: [
              BarChartRodData(
                toY: hourlyPrice.price,
                color: _getBarColor(hourlyPrice.price, provider.alertSettings),
                width: 16,
                borderRadius: BorderRadius.circular(2),
              ),
            ],
          );
        }).toList();

        // Calculate min/max for Y-axis
        final prices = data.map((p) => p.price).toList();
        final minPrice = prices.reduce((a, b) => a < b ? a : b);
        final maxPrice = prices.reduce((a, b) => a > b ? a : b);
        final padding = (maxPrice - minPrice) * 0.1;

        return BarChart(
          BarChartData(
            alignment: BarChartAlignment.spaceAround,
            maxY: maxPrice + padding,
            minY: minPrice - padding,
            gridData: FlGridData(
              show: true,
              drawVerticalLine: false,
              horizontalInterval: (maxPrice - minPrice) / 5,
              getDrawingHorizontalLine: (value) {
                return FlLine(
                  color: Colors.grey.withOpacity(0.3),
                  strokeWidth: 1,
                );
              },
            ),
            titlesData: FlTitlesData(
              show: true,
              rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false),
              ),
              bottomTitles: AxisTitles(
                sideTitles: SideTitles(
                  showTitles: true,
                  reservedSize: 30,
                  interval: 2, // Show every 2 hours
                  getTitlesWidget: (value, meta) {
                    final index = value.toInt();
                    if (index >= 0 && index < data.length) {
                      return SideTitleWidget(
                        axisSide: meta.axisSide,
                        child: Text(
                          data[index].formattedHour,
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
            barGroups: barGroups,
            barTouchData: BarTouchData(
              enabled: true,
              touchTooltipData: BarTouchTooltipData(
                tooltipBgColor: Colors.blueGrey.withOpacity(0.8),
                getTooltipItem: (group, groupIndex, rod, rodIndex) {
                  if (groupIndex >= 0 && groupIndex < data.length) {
                    final hourlyPrice = data[groupIndex];
                    return BarTooltipItem(
                      'Hour ${hourlyPrice.hour.toString().padLeft(2, '0')}:00\n${hourlyPrice.formattedPrice}',
                      const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  }
                  return null;
                },
              ),
            ),
          ),
        );
      },
    );
  }

  Color _getBarColor(double price, alertSettings) {
    if (price >= alertSettings.highThreshold) {
      return Colors.red;
    } else if (price >= alertSettings.mediumThreshold) {
      return Colors.orange;
    } else if (price <= alertSettings.lowThreshold) {
      return Colors.green;
    } else {
      return Colors.blue;
    }
  }
}