import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import 'brand.dart';

/// The website's hero art: the giving hand comes in from the top right and passes the apple
/// down to the open receiving hand at the bottom left, on a diagonal. Same placement as
/// src/home/Hero.jsx (viewBox 600 x 640). When [animate] is true the hands glide in from
/// their corners and a small spark appears where they meet.
class HandsArt extends StatefulWidget {
  final double height;
  final bool animate;
  const HandsArt({super.key, this.height = 260, this.animate = true});
  @override
  State<HandsArt> createState() => _HandsArtState();
}

class _HandsArtState extends State<HandsArt>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = !widget.animate || MediaQuery.of(context).disableAnimations;
    if (still) {
      _c.value = 1;
    } else if (!_c.isAnimating && _c.value == 0) {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  Widget _faded(String asset, Alignment from, double stop) => ShaderMask(
    blendMode: BlendMode.dstIn,
    shaderCallback: (r) => LinearGradient(
      begin: from,
      end: -from,
      colors: const [Colors.transparent, Colors.white],
      stops: [stop * .4, stop],
    ).createShader(r),
    child: Image.asset(
      asset,
      fit: BoxFit.fill,
      errorBuilder: (_, _, _) => const SizedBox(),
    ),
  );

  @override
  Widget build(BuildContext context) {
    final glide = CurvedAnimation(parent: _c, curve: Curves.easeOutCubic);
    final spark = CurvedAnimation(
      parent: _c,
      curve: const Interval(.75, 1, curve: Curves.easeOutBack),
    );
    return SizedBox(
      height: widget.height,
      child: FittedBox(
        child: ClipRect(
          child: SizedBox(
            // the website's 600 x 640 box, widened so the whole giving arm (top right)
            // and receiving arm (bottom left) show on the diagonal
            width: 680,
            height: 660,
            child: AnimatedBuilder(
              animation: _c,
              builder: (_, _) {
                final t = 1 - glide.value;
                return Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // receiving hand: bottom left, palm open, arm fading out to the left
                    Positioned(
                      left: -10 - 90 * t,
                      top: 300 + 90 * t,
                      width: 660,
                      height: 331,
                      child: Opacity(
                        opacity: glide.value,
                        child: _faded(
                          'assets/brand/hand-receiver.webp',
                          Alignment.centerLeft,
                          .42,
                        ),
                      ),
                    ),
                    // giving hand: top right, holding the apple, sleeve fading out at the top
                    Positioned(
                      left: 342 + 90 * t,
                      top: -30 - 90 * t,
                      width: 510,
                      height: 340,
                      child: Opacity(
                        opacity: glide.value,
                        child: _faded(
                          'assets/brand/hand-giver.webp',
                          Alignment.topCenter,
                          .34,
                        ),
                      ),
                    ),
                    Positioned(
                      left: 470 - 20,
                      top: 330 - 20,
                      child: Transform.scale(
                        scale: spark.value,
                        child: const Icon(
                          Icons.auto_awesome,
                          size: 40,
                          color: Brand.gold,
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Opening animation shown every time the app starts: the hands meet, then the A-bridge logo
/// and wordmark appear, then it fades into the app. About 1.8 s (shorter with reduced motion).
class SplashGate extends StatefulWidget {
  final Widget child;
  const SplashGate({super.key, required this.child});
  @override
  State<SplashGate> createState() => _SplashGateState();
}

class _SplashGateState extends State<SplashGate>
    with SingleTickerProviderStateMixin {
  late final AnimationController _logo = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  );
  bool _visible = true, _gone = false;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 700), () {
      if (mounted) _logo.forward();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    Future.delayed(Duration(milliseconds: reduced ? 900 : 1800), () {
      if (mounted && _visible) setState(() => _visible = false);
    });
  }

  @override
  void dispose() {
    _logo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Stack(
    children: [
      widget.child,
      if (!_gone)
        Positioned.fill(
          child: IgnorePointer(
            ignoring: !_visible,
            child: AnimatedOpacity(
              opacity: _visible ? 1 : 0,
              duration: const Duration(milliseconds: 380),
              onEnd: () => setState(() => _gone = true),
              child: Material(
                color: Brand.dark,
                child: Stack(
                  children: [
                    const Positioned.fill(
                      child: CustomPaint(painter: OceanWavesPainter()),
                    ),
                    Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const HandsArt(height: 240),
                          const SizedBox(height: 18),
                          FadeTransition(
                            opacity: _logo,
                            child: SlideTransition(
                              position:
                                  Tween(
                                    begin: const Offset(0, .25),
                                    end: Offset.zero,
                                  ).animate(
                                    CurvedAnimation(
                                      parent: _logo,
                                      curve: Curves.easeOutCubic,
                                    ),
                                  ),
                              child: const Logo(
                                size: 44,
                                onDark: true,
                                tagline: true,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
    ],
  );
}

/// Layered ocean curves, like the website hero background.
class OceanWavesPainter extends CustomPainter {
  const OceanWavesPainter();
  @override
  void paint(Canvas c, Size s) {
    void wave(double top, Color color, double amp) {
      final path = Path()..moveTo(0, s.height * top);
      path.cubicTo(
        s.width * .3,
        s.height * top - amp,
        s.width * .6,
        s.height * top + amp,
        s.width,
        s.height * top - amp * .4,
      );
      path
        ..lineTo(s.width, s.height)
        ..lineTo(0, s.height)
        ..close();
      c.drawPath(path, Paint()..color = color);
    }

    c.drawCircle(
      Offset(s.width * .92, s.height * .08),
      s.width * .45,
      Paint()..color = Brand.forest.withValues(alpha: .55),
    );
    wave(.62, Brand.forest.withValues(alpha: .55), 40);
    wave(.74, Brand.sage.withValues(alpha: .22), 30);
    wave(.86, Brand.forest.withValues(alpha: .7), 24);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
