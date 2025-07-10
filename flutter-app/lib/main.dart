import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'services/comed_api_service.dart';
import 'services/notification_service.dart';
import 'models/pricing_data.dart';
import 'screens/home_screen.dart';
import 'providers/pricing_provider.dart';

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Initialize notifications
  await NotificationService.initialize();
  
  runApp(const ComEdPricingApp());
}

class ComEdPricingApp extends StatelessWidget {
  const ComEdPricingApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PricingProvider()),
      ],
      child: MaterialApp(
        title: 'ComEd Pricing',
        theme: ThemeData(
          primarySwatch: Colors.blue,
          primaryColor: const Color(0xFF1F77B4),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF1F77B4),
            foregroundColor: Colors.white,
            elevation: 2,
          ),
          cardTheme: CardThemeData(
            elevation: 4,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
          useMaterial3: true,
        ),
        home: const HomeScreen(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}