import 'package:flutter/material.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/brand.dart';

/// Branded splash while the session is restored. Also shows account-loading errors with a way out.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});
  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..forward();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = AppSession.instance;
    return Scaffold(
      backgroundColor: Brand.forest,
      body: SafeArea(
        child: Center(
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, _) {
              final draw = Curves.easeOutCubic.transform((_c.value / .7).clamp(0, 1));
              final fade = Curves.easeOut.transform(((_c.value - .45) / .55).clamp(0, 1));
              return Column(mainAxisSize: MainAxisSize.min, children: [
                SizedBox(width: 132, height: 92, child: CustomPaint(painter: BridgePainter(progress: draw, dot: fade * .5))),
                const SizedBox(height: 26),
                Opacity(opacity: fade, child: const Wordmark(size: 44, onDark: true)),
                const SizedBox(height: 10),
                Opacity(
                  opacity: fade,
                  child: Text('Connecting surplus food with those who need it.',
                      textAlign: TextAlign.center, style: TextStyle(color: Brand.cream.withValues(alpha: .8), fontSize: 14.5)),
                ),
                const SizedBox(height: 40),
                if (s.status == SessionStatus.error) ...[
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Text('We couldn’t load your account. ${friendlyError(s.error)}',
                        textAlign: TextAlign.center, style: const TextStyle(color: Brand.cream)),
                  ),
                  const SizedBox(height: 16),
                  Wrap(spacing: 12, children: [
                    FilledButton(style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.dark),
                        onPressed: () => s.load(), child: const Text('Try again')),
                    OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: Brand.cream, side: const BorderSide(color: Brand.cream)),
                        onPressed: () => s.signOut(), child: const Text('Sign out')),
                  ]),
                ] else
                  SizedBox(width: 120, child: LinearProgressIndicator(color: Brand.gold, backgroundColor: Brand.cream.withValues(alpha: .15), minHeight: 2)),
              ]);
            },
          ),
        ),
      ),
    );
  }
}
