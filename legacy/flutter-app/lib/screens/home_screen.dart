import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';
import '../widgets/current_price_card.dart';
import '../widgets/statistics_card.dart';
import '../widgets/price_chart.dart';
import '../widgets/day_ahead_chart.dart';
import 'settings_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'ComEd Pricing',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        actions: [
          Consumer<PricingProvider>(
            builder: (_, p, __) => IconButton(
              tooltip: 'Refresh',
              icon: p.isLoading
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                      ),
                    )
                  : const Icon(Icons.refresh),
              onPressed: p.isLoading ? null : p.refreshData,
            ),
          ),
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const SettingsScreen()),
            ),
          ),
        ],
      ),
      body: Consumer<PricingProvider>(
        builder: (context, provider, _) {
          if (provider.isLoading && provider.fiveMinuteData.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(),
                  SizedBox(height: 16),
                  Text('Loading pricing data…'),
                ],
              ),
            );
          }

          if (provider.errorMessage != null && provider.fiveMinuteData.isEmpty) {
            return _ErrorState(
              message: provider.errorMessage!,
              onRetry: provider.refreshData,
            );
          }

          return RefreshIndicator(
            onRefresh: provider.refreshData,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                const CurrentPriceCard(),
                const SizedBox(height: 16),
                const StatisticsCard(),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: _TimePeriodChips(
                            selected: provider.selectedTimePeriod,
                            onSelected: provider.setTimePeriod,
                          ),
                        ),
                        const SizedBox(height: 8),
                        const SizedBox(height: 260, child: PriceChart()),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                _ChartSection(
                  title: 'Day-ahead hourly',
                  trailing: _DayAheadToggle(
                    selected: provider.dayAheadDay,
                    onSelected: provider.setDayAheadDay,
                  ),
                  child: const SizedBox(height: 260, child: DayAheadChart()),
                ),
                const SizedBox(height: 24),
                if (provider.lastUpdate != null)
                  Center(
                    child: Text(
                      'Updated ${_fmtTime(provider.lastUpdate!)}',
                      style: TextStyle(
                        color: Colors.grey.shade600,
                        fontSize: 12,
                      ),
                    ),
                  ),
                if (provider.errorMessage != null) ...[
                  const SizedBox(height: 12),
                  _InlineError(message: provider.errorMessage!),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  static String _fmtTime(DateTime d) {
    final h = d.hour.toString().padLeft(2, '0');
    final m = d.minute.toString().padLeft(2, '0');
    return '$h:$m';
  }
}

class _ChartSection extends StatelessWidget {
  final String title;
  final Widget? trailing;
  final Widget child;

  const _ChartSection({
    required this.title,
    required this.child,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    title,
                    style: Theme.of(context)
                        .textTheme
                        .titleMedium
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
                if (trailing != null) trailing!,
              ],
            ),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _TimePeriodChips extends StatelessWidget {
  final TimePeriod selected;
  final ValueChanged<TimePeriod> onSelected;

  const _TimePeriodChips({required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6,
      children: TimePeriod.values.map((p) {
        final isSelected = p == selected;
        return ChoiceChip(
          label: Text(p.shortLabel),
          selected: isSelected,
          onSelected: (_) => onSelected(p),
          visualDensity: VisualDensity.compact,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        );
      }).toList(),
    );
  }
}

class _DayAheadToggle extends StatelessWidget {
  final DayAheadDay selected;
  final ValueChanged<DayAheadDay> onSelected;

  const _DayAheadToggle({required this.selected, required this.onSelected});

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<DayAheadDay>(
      style: const ButtonStyle(
        visualDensity: VisualDensity.compact,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      ),
      segments: const [
        ButtonSegment(value: DayAheadDay.today, label: Text('Today')),
        ButtonSegment(value: DayAheadDay.tomorrow, label: Text('Tomorrow')),
      ],
      selected: {selected},
      onSelectionChanged: (s) => onSelected(s.first),
      showSelectedIcon: false,
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.cloud_off, size: 56, color: Colors.redAccent),
            const SizedBox(height: 16),
            Text(
              "Couldn't load pricing data",
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  final String message;
  const _InlineError({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.red.shade100),
      ),
      child: Row(
        children: [
          Icon(Icons.warning_amber, color: Colors.red.shade700),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: Colors.red.shade700, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}
