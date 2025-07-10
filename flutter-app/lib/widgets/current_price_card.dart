import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';

class CurrentPriceCard extends StatelessWidget {
  const CurrentPriceCard({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<PricingProvider>(
      builder: (context, provider, child) {
        final currentPrice = provider.currentPrice;
        final currentHourAverage = provider.currentHourAverage;
        final alertLevel = provider.currentAlertLevel;

        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Current Electricity Pricing',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                
                Row(
                  children: [
                    // Latest 5-Minute Price
                    Expanded(
                      child: _PriceDisplay(
                        title: 'Latest 5-Minute Price',
                        price: currentPrice,
                        alertLevel: alertLevel,
                        icon: Icons.flash_on,
                      ),
                    ),
                    const SizedBox(width: 16),
                    
                    // Current Hour Average
                    Expanded(
                      child: _PriceDisplay(
                        title: 'Current Hour Average',
                        price: currentHourAverage?.price,
                        alertLevel: provider.alertSettings.getAlertLevel(
                          currentHourAverage?.price ?? 0,
                        ),
                        icon: Icons.schedule,
                      ),
                    ),
                  ],
                ),
                
                const SizedBox(height: 16),
                
                // Alert level indicator
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: _getAlertColor(alertLevel).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: _getAlertColor(alertLevel),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        _getAlertIcon(alertLevel),
                        color: _getAlertColor(alertLevel),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              alertLevel.displayName,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: _getAlertColor(alertLevel),
                              ),
                            ),
                            Text(
                              alertLevel.description,
                              style: TextStyle(
                                color: _getAlertColor(alertLevel),
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Color _getAlertColor(AlertLevel level) {
    switch (level) {
      case AlertLevel.low:
        return Colors.green;
      case AlertLevel.normal:
        return Colors.blue;
      case AlertLevel.medium:
        return Colors.orange;
      case AlertLevel.high:
        return Colors.red;
    }
  }

  IconData _getAlertIcon(AlertLevel level) {
    switch (level) {
      case AlertLevel.low:
        return Icons.trending_down;
      case AlertLevel.normal:
        return Icons.info;
      case AlertLevel.medium:
        return Icons.warning;
      case AlertLevel.high:
        return Icons.error;
    }
  }
}

class _PriceDisplay extends StatelessWidget {
  final String title;
  final double? price;
  final AlertLevel alertLevel;
  final IconData icon;

  const _PriceDisplay({
    required this.title,
    required this.price,
    required this.alertLevel,
    required this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: Theme.of(context).colorScheme.outline.withOpacity(0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                icon,
                size: 16,
                color: Theme.of(context).colorScheme.primary,
              ),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          if (price != null) ...[
            Text(
              '${price!.toStringAsFixed(2)}¢',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: _getAlertColor(alertLevel),
              ),
            ),
            Text(
              'per kWh',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ] else ...[
            Text(
              '--',
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            Text(
              'No data',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Color _getAlertColor(AlertLevel level) {
    switch (level) {
      case AlertLevel.low:
        return Colors.green;
      case AlertLevel.normal:
        return Colors.blue;
      case AlertLevel.medium:
        return Colors.orange;
      case AlertLevel.high:
        return Colors.red;
    }
  }
}