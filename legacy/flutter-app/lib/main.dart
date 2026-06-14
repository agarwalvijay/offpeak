import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'services/simple_settings.dart';
import 'screens/splash_screen.dart';
import 'providers/pricing_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SimpleSettings.init();
  runApp(const ComEdPricingApp());
}

class ComEdPricingApp extends StatelessWidget {
  const ComEdPricingApp({super.key});

  @override
  Widget build(BuildContext context) {
    final scheme = ColorScheme.fromSeed(
      seedColor: const Color(0xFF1E3A8A),
      brightness: Brightness.light,
    );
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PricingProvider()),
      ],
      child: MaterialApp(
        title: 'ComEd Pricing',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: scheme,
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xFFF6F7FB),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xFF1E3A8A),
            foregroundColor: Colors.white,
            elevation: 0,
            centerTitle: false,
          ),
          cardTheme: CardThemeData(
            elevation: 0,
            color: Colors.white,
            margin: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.black.withOpacity(0.06)),
            ),
          ),
          chipTheme: ChipThemeData(
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
            ),
          ),
        ),
        home: const SplashScreen(),
      ),
    );
  }
}
