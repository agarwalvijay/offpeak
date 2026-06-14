import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/pricing_provider.dart';
import 'home_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _entry;
  late final AnimationController _pulse;
  late final Animation<double> _entryFade;
  late final Animation<double> _entryScale;

  @override
  void initState() {
    super.initState();

    _entry = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 700),
    );
    _entryFade = CurvedAnimation(parent: _entry, curve: Curves.easeOut);
    _entryScale = Tween(begin: 0.85, end: 1.0)
        .animate(CurvedAnimation(parent: _entry, curve: Curves.easeOutBack));
    _entry.forward();

    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();

    _scheduleNavigation();
  }

  void _scheduleNavigation() {
    final provider = context.read<PricingProvider>();
    final minDelay = Future<void>.delayed(const Duration(milliseconds: 1600));
    final maxDelay = Future<void>.delayed(const Duration(seconds: 6));

    Future<void> dataReady() async {
      while (provider.isLoading || provider.fiveMinuteData.isEmpty) {
        await Future<void>.delayed(const Duration(milliseconds: 100));
        if (provider.errorMessage != null) return;
      }
    }

    Future.any([
      Future.wait([minDelay, dataReady()]),
      maxDelay,
    ]).then((_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          pageBuilder: (_, __, ___) => const HomeScreen(),
          transitionsBuilder: (_, animation, __, child) =>
              FadeTransition(opacity: animation, child: child),
          transitionDuration: const Duration(milliseconds: 400),
        ),
      );
    });
  }

  @override
  void dispose() {
    _entry.dispose();
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(0, -0.2),
            radius: 1.2,
            colors: [Color(0xFF1E3A8A), Color(0xFF0B1A4A)],
            stops: [0.0, 1.0],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              const Positioned.fill(child: _DotField()),
              Center(
                child: FadeTransition(
                  opacity: _entryFade,
                  child: ScaleTransition(
                    scale: _entryScale,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _PulsingMark(controller: _pulse),
                        const SizedBox(height: 36),
                        const Text(
                          'ComEd Pulse',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.5,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 10),
                        Container(
                          width: 28,
                          height: 2,
                          decoration: BoxDecoration(
                            color: const Color(0xFFEA580C),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'REAL-TIME · 5-MINUTE PRICING',
                          style: TextStyle(
                            color: Colors.white.withOpacity(0.72),
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 2.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                bottom: 36,
                child: Center(
                  child: _IndeterminateBar(controller: _pulse),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PulsingMark extends StatelessWidget {
  final AnimationController controller;
  const _PulsingMark({required this.controller});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      height: 220,
      child: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          return Stack(
            alignment: Alignment.center,
            children: [
              for (var i = 0; i < 3; i++)
                _expandingRing((controller.value + i / 3) % 1.0),
              _coreMark(),
            ],
          );
        },
      ),
    );
  }

  Widget _expandingRing(double t) {
    final size = 110 + 110 * t;
    final opacity = (1.0 - t).clamp(0.0, 1.0);
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withOpacity(0.45 * opacity),
            width: 1.4,
          ),
        ),
      ),
    );
  }

  Widget _coreMark() {
    return Container(
      width: 116,
      height: 116,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF3B82F6), Color(0xFF1E3A8A)],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF3B82F6).withOpacity(0.45),
            blurRadius: 28,
            spreadRadius: 4,
          ),
        ],
      ),
      child: const Center(
        child: _BoltGlyph(size: 56),
      ),
    );
  }
}

/// Crisp lightning-bolt drawn with a custom painter so it stays sharp on any
/// density and doesn't depend on bundled PNGs.
class _BoltGlyph extends StatelessWidget {
  final double size;
  const _BoltGlyph({required this.size});

  @override
  Widget build(BuildContext context) {
    return CustomPaint(size: Size.square(size), painter: _BoltPainter());
  }
}

class _BoltPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..isAntiAlias = true
      ..style = PaintingStyle.fill;
    // Path inspired by the app icon's bolt — drawn within a 100×100 viewport
    // and scaled to size.
    // Matches the asymmetric bolt in ic_launcher_foreground (108-grid scaled).
    double x(double v) => (v / 108.0) * size.width;
    double y(double v) => (v / 108.0) * size.height;
    final path = Path()
      ..moveTo(x(62), y(22))
      ..lineTo(x(36), y(58))
      ..lineTo(x(52), y(58))
      ..lineTo(x(46), y(90))
      ..lineTo(x(74), y(52))
      ..lineTo(x(58), y(52))
      ..close();
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Subtle dot field in the background to add depth.
class _DotField extends StatelessWidget {
  const _DotField();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _DotFieldPainter());
  }
}

class _DotFieldPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rng = math.Random(42);
    final paint = Paint()..color = Colors.white.withOpacity(0.06);
    for (var i = 0; i < 90; i++) {
      final dx = rng.nextDouble() * size.width;
      final dy = rng.nextDouble() * size.height;
      final r = 0.6 + rng.nextDouble() * 1.4;
      canvas.drawCircle(Offset(dx, dy), r, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

/// Slim continuous progress bar at the bottom — replaces the generic spinner.
class _IndeterminateBar extends StatelessWidget {
  final AnimationController controller;
  const _IndeterminateBar({required this.controller});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 140,
      height: 2,
      child: AnimatedBuilder(
        animation: controller,
        builder: (_, __) {
          final t = controller.value;
          return CustomPaint(
            painter: _BarPainter(t),
          );
        },
      ),
    );
  }
}

class _BarPainter extends CustomPainter {
  final double t;
  _BarPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    final track = Paint()
      ..color = Colors.white.withOpacity(0.18)
      ..strokeCap = StrokeCap.round
      ..strokeWidth = size.height;
    canvas.drawLine(
      Offset(0, size.height / 2),
      Offset(size.width, size.height / 2),
      track,
    );
    final segWidth = size.width * 0.35;
    final start = (t * (size.width + segWidth)) - segWidth;
    final end = start + segWidth;
    final grad = const LinearGradient(
      colors: [Color(0xFFEA580C), Color(0xFFFFB95E)],
    );
    final segPaint = Paint()
      ..shader = grad.createShader(
        Rect.fromLTWH(start, 0, segWidth, size.height),
      )
      ..strokeCap = StrokeCap.round
      ..strokeWidth = size.height;
    canvas.drawLine(
      Offset(start.clamp(0, size.width), size.height / 2),
      Offset(end.clamp(0, size.width), size.height / 2),
      segPaint,
    );
  }

  @override
  bool shouldRepaint(covariant _BarPainter oldDelegate) => oldDelegate.t != t;
}
