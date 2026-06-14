import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _low;
  late TextEditingController _med;
  late TextEditingController _high;

  @override
  void initState() {
    super.initState();
    final s = context.read<PricingProvider>().alertSettings;
    _low = TextEditingController(text: s.lowThreshold.toStringAsFixed(1));
    _med = TextEditingController(text: s.mediumThreshold.toStringAsFixed(1));
    _high = TextEditingController(text: s.highThreshold.toStringAsFixed(1));
  }

  @override
  void dispose() {
    _low.dispose();
    _med.dispose();
    _high.dispose();
    super.dispose();
  }

  void _save() {
    final low = double.tryParse(_low.text);
    final med = double.tryParse(_med.text);
    final high = double.tryParse(_high.text);
    if (low == null || med == null || high == null) {
      _toast('Enter valid numbers for all thresholds');
      return;
    }
    if (!(low < med && med < high)) {
      _toast('Thresholds must be Low < Medium < High');
      return;
    }
    context.read<PricingProvider>().updateAlertSettings(
          AlertSettings(
            lowThreshold: low,
            mediumThreshold: med,
            highThreshold: high,
          ),
        );
    _toast('Saved');
  }

  void _toast(String msg) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: [
          TextButton(
            onPressed: _save,
            child: const Text(
              'Save',
              style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
      body: Consumer<PricingProvider>(
        builder: (context, provider, _) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              _Section(
                title: 'Auto-refresh',
                child: SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Refresh every 5 minutes'),
                  subtitle: const Text(
                    'ComEd publishes new readings every 5 minutes',
                  ),
                  value: provider.autoRefresh,
                  onChanged: provider.setAutoRefresh,
                ),
              ),
              const SizedBox(height: 16),
              _Section(
                title: 'Color thresholds (¢/kWh)',
                subtitle:
                    'Used to color-code the current price card and chart lines.',
                child: Column(
                  children: [
                    _ThresholdField(
                      controller: _low,
                      label: 'Low',
                      helper: 'At or below: green',
                      color: const Color(0xFF16A34A),
                    ),
                    const SizedBox(height: 12),
                    _ThresholdField(
                      controller: _med,
                      label: 'Medium',
                      helper: 'At or above: orange',
                      color: const Color(0xFFEA580C),
                    ),
                    const SizedBox(height: 12),
                    _ThresholdField(
                      controller: _high,
                      label: 'High',
                      helper: 'At or above: red',
                      color: const Color(0xFFDC2626),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              _Section(
                title: 'About',
                child: Column(
                  children: const [
                    _AboutRow(
                      icon: Icons.cloud_outlined,
                      title: 'Data source',
                      value: 'ComEd Hourly Pricing API',
                    ),
                    Divider(height: 1),
                    _AboutRow(
                      icon: Icons.bolt_outlined,
                      title: 'Cadence',
                      value: '5-minute readings',
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final String? subtitle;
  final Widget child;

  const _Section({required this.title, required this.child, this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (subtitle != null) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
            ],
            const SizedBox(height: 10),
            child,
          ],
        ),
      ),
    );
  }
}

class _ThresholdField extends StatelessWidget {
  final TextEditingController controller;
  final String label;
  final String helper;
  final Color color;

  const _ThresholdField({
    required this.controller,
    required this.label,
    required this.helper,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: label,
        helperText: helper,
        suffixText: '¢',
        prefixIcon: Container(
          margin: const EdgeInsets.all(10),
          width: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
        border: const OutlineInputBorder(),
        focusedBorder: OutlineInputBorder(
          borderSide: BorderSide(color: color, width: 2),
        ),
      ),
    );
  }
}

class _AboutRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;
  const _AboutRow({
    required this.icon,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
      title: Text(title),
      subtitle: Text(value),
      dense: true,
    );
  }
}
