import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import '../models/pricing_data.dart';
import '../services/notification_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _lowController;
  late TextEditingController _mediumController;
  late TextEditingController _highController;
  bool _notificationsEnabled = true;

  @override
  void initState() {
    super.initState();
    final provider = Provider.of<PricingProvider>(context, listen: false);
    final settings = provider.alertSettings;
    
    _lowController = TextEditingController(text: settings.lowThreshold.toString());
    _mediumController = TextEditingController(text: settings.mediumThreshold.toString());
    _highController = TextEditingController(text: settings.highThreshold.toString());
    
    _checkNotificationPermissions();
  }

  @override
  void dispose() {
    _lowController.dispose();
    _mediumController.dispose();
    _highController.dispose();
    super.dispose();
  }

  Future<void> _checkNotificationPermissions() async {
    final enabled = await NotificationService.areNotificationsEnabled();
    if (mounted) {
      setState(() {
        _notificationsEnabled = enabled;
      });
    }
  }

  void _saveSettings() {
    final provider = Provider.of<PricingProvider>(context, listen: false);
    
    final lowThreshold = double.tryParse(_lowController.text) ?? 3.0;
    final mediumThreshold = double.tryParse(_mediumController.text) ?? 6.0;
    final highThreshold = double.tryParse(_highController.text) ?? 10.0;

    // Validate thresholds
    if (lowThreshold >= mediumThreshold || mediumThreshold >= highThreshold) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thresholds must be in ascending order: Low < Medium < High'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final newSettings = AlertSettings(
      lowThreshold: lowThreshold,
      mediumThreshold: mediumThreshold,
      highThreshold: highThreshold,
      alertsEnabled: provider.alertSettings.alertsEnabled,
    );

    provider.updateAlertSettings(newSettings);
    
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Settings saved'),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        actions: [
          IconButton(
            icon: const Icon(Icons.save),
            onPressed: _saveSettings,
          ),
        ],
      ),
      body: Consumer<PricingProvider>(
        builder: (context, provider, child) {
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // Auto-refresh settings
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Auto-Refresh',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        title: const Text('Enable Auto-Refresh'),
                        subtitle: const Text('Update data every 5 minutes'),
                        value: provider.autoRefresh,
                        onChanged: provider.setAutoRefresh,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Alert settings
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Price Alerts',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      SwitchListTile(
                        title: const Text('Enable Alerts'),
                        subtitle: Text(_notificationsEnabled 
                            ? 'Get notified about price changes'
                            : 'Notifications disabled in system settings'),
                        value: provider.alertSettings.alertsEnabled && _notificationsEnabled,
                        onChanged: _notificationsEnabled 
                            ? (value) {
                                final newSettings = AlertSettings(
                                  lowThreshold: provider.alertSettings.lowThreshold,
                                  mediumThreshold: provider.alertSettings.mediumThreshold,
                                  highThreshold: provider.alertSettings.highThreshold,
                                  alertsEnabled: value,
                                );
                                provider.updateAlertSettings(newSettings);
                              }
                            : null,
                      ),
                      if (!_notificationsEnabled)
                        Padding(
                          padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
                          child: Text(
                            'Enable notifications in your device settings to receive price alerts',
                            style: TextStyle(
                              color: Colors.orange.shade700,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      const SizedBox(height: 16),

                      // Threshold settings
                      Text(
                        'Alert Thresholds (¢/kWh)',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 16),
                      
                      TextField(
                        controller: _lowController,
                        decoration: const InputDecoration(
                          labelText: 'Low Price Threshold',
                          helperText: 'Alert when price goes below this value',
                          suffixText: '¢/kWh',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 16),
                      
                      TextField(
                        controller: _mediumController,
                        decoration: const InputDecoration(
                          labelText: 'Medium Price Threshold',
                          helperText: 'Warning when price exceeds this value',
                          suffixText: '¢/kWh',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 16),
                      
                      TextField(
                        controller: _highController,
                        decoration: const InputDecoration(
                          labelText: 'High Price Threshold',
                          helperText: 'Alert when price exceeds this value',
                          suffixText: '¢/kWh',
                          border: OutlineInputBorder(),
                        ),
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: 16),

                      // Current alert level indicator
                      if (provider.currentPrice != null) ...[
                        const Divider(),
                        ListTile(
                          leading: Icon(
                            Icons.info_outline,
                            color: _getAlertColor(provider.currentAlertLevel),
                          ),
                          title: Text('Current Level: ${provider.currentAlertLevel.displayName}'),
                          subtitle: Text(
                            'Current price: ${provider.currentPrice!.toStringAsFixed(2)}¢/kWh\n'
                            '${provider.currentAlertLevel.description}',
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Data info
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Data Information',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      ListTile(
                        leading: const Icon(Icons.data_usage),
                        title: const Text('Data Source'),
                        subtitle: const Text('ComEd Hourly Pricing API'),
                      ),
                      ListTile(
                        leading: const Icon(Icons.schedule),
                        title: const Text('Update Frequency'),
                        subtitle: const Text('Every 5 minutes (when auto-refresh enabled)'),
                      ),
                      ListTile(
                        leading: const Icon(Icons.timeline),
                        title: const Text('Data Points'),
                        subtitle: Text('${provider.statistics.dataPoints} readings in selected period'),
                      ),
                      if (provider.lastUpdate != null)
                        ListTile(
                          leading: const Icon(Icons.refresh),
                          title: const Text('Last Update'),
                          subtitle: Text(
                            '${provider.lastUpdate!.day}/${provider.lastUpdate!.month} '
                            'at ${provider.lastUpdate!.hour.toString().padLeft(2, '0')}:'
                            '${provider.lastUpdate!.minute.toString().padLeft(2, '0')}',
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Test notification button
              if (_notificationsEnabled && provider.alertSettings.alertsEnabled)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Test Notifications',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 8),
                        ElevatedButton(
                          onPressed: () {
                            NotificationService.showNotification(
                              'Test Notification',
                              'This is a test notification from ComEd Pricing app',
                            );
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Test notification sent')),
                            );
                          },
                          child: const Text('Send Test Notification'),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
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