import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';
import '../widgets/price_chart.dart';
import '../widgets/current_price_card.dart';
import '../widgets/statistics_card.dart';
import '../widgets/day_ahead_chart.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          children: [
            Icon(Icons.flash_on, color: Colors.white),
            SizedBox(width: 8),
            Text('ComEd Pricing'),
          ],
        ),
        actions: [
          Consumer<PricingProvider>(
            builder: (context, provider, child) {
              return IconButton(
                icon: Icon(
                  provider.autoRefresh ? Icons.autorenew : Icons.refresh,
                  color: provider.autoRefresh ? Colors.green : Colors.white,
                ),
                onPressed: () => provider.refreshData(),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: Consumer<PricingProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading && provider.fiveMinuteData.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading pricing data...'),
                ],
              ),
            );
          }

          if (provider.errorMessage != null && provider.fiveMinuteData.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline,
                    size: 64,
                    color: Colors.red,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Error loading data',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 8),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text(
                      provider.errorMessage!,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: () => provider.refreshData(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: provider.refreshData,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Current Price Section
                  CurrentPriceCard(),
                  const SizedBox(height: 16),

                  // Statistics Section
                  StatisticsCard(),
                  const SizedBox(height: 16),

                  // Time Period Selector
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '5-Minute Pricing Trend',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 16),
                          DropdownButtonFormField<TimePeriod>(
                            value: provider.selectedTimePeriod,
                            decoration: const InputDecoration(
                              labelText: 'Time Period',
                              border: OutlineInputBorder(),
                            ),
                            items: TimePeriod.values
                                .map((period) => DropdownMenuItem<TimePeriod>(
                                      value: period,
                                      child: Text(period.displayName),
                                    ))
                                .toList(),
                            onChanged: (period) {
                              if (period != null) {
                                provider.setTimePeriod(period);
                              }
                            },
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 300,
                            child: PriceChart(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Day-Ahead Pricing Section
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Day-Ahead Hourly Pricing',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            height: 300,
                            child: DayAheadChart(),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Last Update Info
                  if (provider.lastUpdate != null)
                    Center(
                      child: Text(
                        'Last updated: ${provider.lastUpdate!.hour.toString().padLeft(2, '0')}:${provider.lastUpdate!.minute.toString().padLeft(2, '0')}',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  
                  // Loading indicator for refresh
                  if (provider.isLoading)
                    const Padding(
                      padding: EdgeInsets.all(16),
                      child: Center(
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                            SizedBox(width: 8),
                            Text('Updating...'),
                          ],
                        ),
                      ),
                    ),

                  // Error message
                  if (provider.errorMessage != null)
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: Card(
                        color: Colors.red.shade50,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Icon(Icons.warning, color: Colors.red.shade700),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  provider.errorMessage!,
                                  style: TextStyle(color: Colors.red.shade700),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.close),
                                onPressed: () => provider.refreshData(),
                                color: Colors.red.shade700,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}