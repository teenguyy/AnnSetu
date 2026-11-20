import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';

/// AnnSetu mark: a bridge (setu) arch carrying a gold grain (ann) from one bank to the other.
class BridgePainter extends CustomPainter {
  final double progress; // 0..1 how much of the arch is drawn
  final double dot; // 0..1 position of the travelling grain
  final Color arch, deck, grain;
  BridgePainter({this.progress = 1, this.dot = .5, this.arch = Brand.cream, this.deck = Brand.cream, this.grain = Brand.gold});

  Path _archPath(Size s) => Path()
    ..moveTo(s.width * .12, s.height * .72)
    ..quadraticBezierTo(s.width * .5, s.height * .02, s.width * .88, s.height * .72);

  @override
  void paint(Canvas c, Size s) {
    final w = s.width;
    final p = Paint()..style = PaintingStyle.stroke..strokeCap = StrokeCap.round;
    // deck
    p..color = deck.withValues(alpha: .9)..strokeWidth = w * .055;
    c.drawLine(Offset(w * .06, s.height * .72), Offset(w * .94, s.height * .72), p);
    // hangers
    p..strokeWidth = w * .022..color = deck.withValues(alpha: .55);
    for (var i = 1; i < 6; i++) {
      final t = i / 6;
      final x = w * (.12 + .76 * t);
      final y = s.height * (.72 - 1.4 * t * (1 - t)); // point on the arch above x
      if (t <= progress) c.drawLine(Offset(x, y), Offset(x, s.height * .72), p);
    }
    // arch
    final arc = _archPath(s);
    final m = arc.computeMetrics().first;
    p..color = arch..strokeWidth = w * .07;
    c.drawPath(m.extractPath(0, m.length * progress), p);
    // grain
    if (progress >= 1) {
      final pos = m.getTangentForOffset(m.length * dot)!.position;
      c.drawCircle(pos, w * .075, Paint()..color = grain);
    }
  }

  @override
  bool shouldRepaint(BridgePainter o) => o.progress != progress || o.dot != dot || o.arch != arch;
}

class BrandMark extends StatelessWidget {
  final double size;
  final bool onDark;
  const BrandMark({super.key, this.size = 44, this.onDark = false});
  @override
  Widget build(BuildContext context) => Container(
        width: size, height: size,
        decoration: BoxDecoration(color: Brand.forest, borderRadius: BorderRadius.circular(size * .28),
            border: onDark ? Border.all(color: Brand.gold.withValues(alpha: .35)) : null),
        padding: EdgeInsets.all(size * .14),
        child: CustomPaint(painter: BridgePainter(dot: .5)),
      );
}

/// "AnnSetu" wordmark (website: Ann<span>Setu</span>, with Setu in gold).
class Wordmark extends StatelessWidget {
  final double size;
  final bool onDark;
  const Wordmark({super.key, this.size = 26, this.onDark = false});
  @override
  Widget build(BuildContext context) {
    final dark = onDark || Theme.of(context).brightness == Brightness.dark;
    return Text.rich(TextSpan(children: [
      TextSpan(text: 'Ann', style: TextStyle(color: dark ? Brand.cream : Brand.forest)),
      TextSpan(text: 'Setu', style: TextStyle(color: dark ? Brand.gold : Brand.goldDeep)),
    ]), style: TextStyle(fontFamily: serif, fontSize: size, height: 1));
  }
}

class Logo extends StatelessWidget {
  final double size;
  final bool onDark;
  const Logo({super.key, this.size = 36, this.onDark = false});
  @override
  Widget build(BuildContext context) => Row(mainAxisSize: MainAxisSize.min, children: [
        BrandMark(size: size, onDark: onDark),
        SizedBox(width: size * .3),
        Wordmark(size: size * .72, onDark: onDark),
      ]);
}

/// Custom loading animation: the bridge draws itself, then a grain crosses it.
class BridgeLoader extends StatefulWidget {
  final double size;
  final String? label;
  const BridgeLoader({super.key, this.size = 64, this.label});
  @override
  State<BridgeLoader> createState() => _BridgeLoaderState();
}

class _BridgeLoaderState extends State<BridgeLoader> with SingleTickerProviderStateMixin {
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final archColor = dark ? Brand.cream : Brand.forest;
    return Semantics(
      label: widget.label ?? 'Loading',
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
          width: widget.size, height: widget.size * .7,
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, _) {
              final t = reduce ? 1.0 : _c.value;
              final draw = (t / .45).clamp(0.0, 1.0);
              final dot = ((t - .45) / .55).clamp(0.0, 1.0);
              return CustomPaint(painter: BridgePainter(progress: Curves.easeOutCubic.transform(draw),
                  dot: .5 - .5 * math.cos(dot * math.pi), arch: archColor, deck: archColor));
            },
          ),
        ),
        if (widget.label != null) ...[const SizedBox(height: 12), Text(widget.label!, style: Theme.of(context).textTheme.bodySmall)],
      ]),
    );
  }
}
