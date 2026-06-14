import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';

class StatisticsCard extends StatelessWidget {
  const StatisticsCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, _) {
        final stats = provider.statistics;
        final period = provider.selectedTimePeriod;
        final filtered = provider.filteredFiveMinuteData;

        // Cheapest / most expensive moments inside the selected window.
        PricingPoint? cheapest;
        PricingPoint? priciest;
        if (filtered.isNotEmpty) {
          cheapest = filtered.reduce((a, b) => a.price <= b.price ? a : b);
          priciest = filtered.reduce((a, b) => a.price >= b.price ? a : b);
        }

        // Cheapest upcoming hour from day-ahead (ignoring past hours today).
        HourlyPrice? bestUpcoming;
        final dayAhead = provider.dayAheadData;
        if (dayAhead.isNotEmpty) {
          final now = DateTime.now();
          final upcoming = provider.dayAheadDay == DayAheadDay.today
              ? dayAhead.where((h) => h.dateTime.isAfter(now)).toList()
              : dayAhead;
          if (upcoming.isNotEmpty) {
            bestUpcoming = upcoming.reduce((a, b) => a.price <= b.price ? a : b);
          }
        }

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        period.displayName,
                        style: Theme.of(context)
                            .textTheme
                            .titleMedium
                            ?.copyWith(fontWeight: FontWeight.w700),
                      ),
                    ),
                    Text(
                      '${stats.dataPoints} readings',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: _Metric(
                        label: 'Avg',
                        value: stats.formattedAverage,
                        color: const Color(0xFF1E3A8A),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _Metric(
                        label: 'Min',
                        value: stats.formattedMinimum,
                        color: const Color(0xFF16A34A),
                        sublabel: cheapest == null
                            ? null
                            : 'at ${cheapest.formattedTime}',
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _Metric(
                        label: 'Max',
                        value: stats.formattedMaximum,
                        color: const Color(0xFFDC2626),
                        sublabel: priciest == null
                            ? null
                            : 'at ${priciest.formattedTime}',
                      ),
                    ),
                  ],
                ),
                if (bestUpcoming != null) ...[
                  const SizedBox(height: 14),
                  _BestHourBanner(
                    label: provider.dayAheadDay == DayAheadDay.today
                        ? 'Cheapest hour ahead today'
                        : 'Cheapest hour tomorrow',
                    hour: bestUpcoming,
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}

class _Metric extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final String? sublabel;

  const _Metric({
    required this.label,
    required this.value,
    required this.color,
    this.sublabel,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          if (sublabel != null) ...[
            const SizedBox(height: 2),
            Text(
              sublabel!,
              style: TextStyle(
                color: color.withOpacity(0.85),
                fontSize: 10,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BestHourBanner extends StatelessWidget {
  final String label;
  final HourlyPrice hour;

  const _BestHourBanner({required this.label, required this.hour});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF16A34A).withOpacity(0.10),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF16A34A).withOpacity(0.25)),
      ),
      child: Row(
        children: [
          const Icon(Icons.savings_outlined,
              color: Color(0xFF16A34A), size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF166534),
                  ),
                ),
                Text(
                  '${hour.formattedHour} · ${hour.formattedPrice}',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF14532D),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
