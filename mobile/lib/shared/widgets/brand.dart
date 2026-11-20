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

/// The AnnSetu "A-bridge" mark (same artwork as the website, rendered from its SVG).
class BrandMark extends StatelessWidget {
  final double size;
  final bool onDark;
  const BrandMark({super.key, this.size = 44, this.onDark = false});
  @override
  Widget build(BuildContext context) {
    final dark = onDark || Theme.of(context).brightness == Brightness.dark;
    return Image.asset(dark ? 'assets/brand/mark_reverse.png' : 'assets/brand/mark.png',
        width: size, height: size, filterQuality: FilterQuality.high, semanticLabel: 'AnnSetu');
  }
}

/// "AnnSetu" wordmark like the website: italic "Ann" + bold "Setu" (Setu in sunshine on dark backgrounds).
class Wordmark extends StatelessWidget {
  final double size;
  final bool onDark;
  const Wordmark({super.key, this.size = 26, this.onDark = false});
  @override
  Widget build(BuildContext context) {
    final dark = onDark || Theme.of(context).brightness == Brightness.dark;
    return Text.rich(TextSpan(children: [
      TextSpan(text: 'Ann', style: TextStyle(fontStyle: FontStyle.italic, fontWeight: FontWeight.w500, color: dark ? Brand.cream : Brand.dark)),
      TextSpan(text: 'Setu', style: TextStyle(fontWeight: FontWeight.w700, color: dark ? Brand.gold : Brand.forest)),
    ]), style: TextStyle(fontFamily: serif, fontSize: size, height: 1));
  }
}

class Logo extends StatelessWidget {
  final double size;
  final bool onDark;
  final bool tagline;
  const Logo({super.key, this.size = 36, this.onDark = false, this.tagline = false});
  @override
  Widget build(BuildContext context) {
    final dark = onDark || Theme.of(context).brightness == Brightness.dark;
    return Row(mainAxisSize: MainAxisSize.min, children: [
      BrandMark(size: size, onDark: onDark),
      SizedBox(width: size * .25),
      Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wordmark(size: size * .72, onDark: onDark),
        if (tagline) Padding(padding: EdgeInsets.only(top: size * .08),
            child: Text('CONNECT · SHARE · NOURISH', style: TextStyle(fontFamily: grot, fontSize: size * .2, fontWeight: FontWeight.w700,
                letterSpacing: size * .05, color: dark ? Brand.sky : Brand.sage))),
      ]),
    ]);
  }
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
  late final _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 1400))..repeat();
  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.of(context).disableAnimations;
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Semantics(
      label: widget.label ?? 'Loading',
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
          width: widget.size, height: widget.size,
          child: AnimatedBuilder(
            animation: _c,
            builder: (_, child) => Stack(alignment: Alignment.center, children: [
              SizedBox(width: widget.size, height: widget.size,
                  child: CircularProgressIndicator(strokeWidth: 2.5, value: reduce ? 1 : null, color: dark ? Brand.gold : Brand.sage,
                      backgroundColor: (dark ? Brand.gold : Brand.sage).withValues(alpha: .15))),
              Transform.scale(scale: reduce ? 1 : 1 + .05 * math.sin(_c.value * 2 * math.pi), child: child),
            ]),
            child: BrandMark(size: widget.size * .62),
          ),
        ),
        if (widget.label != null) ...[const SizedBox(height: 12), Text(widget.label!, style: Theme.of(context).textTheme.bodySmall)],
      ]),
    );
  }
}
