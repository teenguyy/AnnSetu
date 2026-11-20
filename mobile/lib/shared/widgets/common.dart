import 'dart:async';
import 'package:flutter/material.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import 'brand.dart';

// ---------------------------------------------------------------- feedback to the user
void showOk(BuildContext c, String msg) {
  ScaffoldMessenger.of(c)..hideCurrentSnackBar()..showSnackBar(SnackBar(content: Row(children: [
    const Icon(Icons.check_circle_rounded, color: Brand.gold, size: 20), const SizedBox(width: 10), Expanded(child: Text(msg)),
  ])));
}

void showErr(BuildContext c, Object e) {
  ScaffoldMessenger.of(c)..hideCurrentSnackBar()..showSnackBar(SnackBar(
    duration: const Duration(seconds: 6),
    content: Row(children: [
      const Icon(Icons.error_outline_rounded, color: Brand.terracotta, size: 20), const SizedBox(width: 10),
      Expanded(child: Text(friendlyError(e))),
    ]),
  ));
}

/// Runs [fn], reports failure as a friendly snackbar. Returns true on success.
Future<bool> guard(BuildContext c, Future<void> Function() fn, {String? ok}) async {
  try {
    await fn();
    if (ok != null && c.mounted) showOk(c, ok);
    return true;
  } catch (e) {
    if (c.mounted) showErr(c, e);
    return false;
  }
}

// ---------------------------------------------------------------- async button
class BusyButton extends StatefulWidget {
  final Future<void> Function()? onPressed;
  final Widget child;
  final IconData? icon;
  final bool outlined, danger, tonal, expand;
  const BusyButton({super.key, required this.onPressed, required this.child, this.icon, this.outlined = false, this.danger = false, this.tonal = false, this.expand = false});
  @override
  State<BusyButton> createState() => _BusyButtonState();
}

class _BusyButtonState extends State<BusyButton> {
  bool busy = false;
  Future<void> _run() async {
    if (widget.onPressed == null || busy) return;
    setState(() => busy = true);
    try {
      await widget.onPressed!();
    } catch (e) {
      if (mounted) showErr(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final spinner = SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2.2,
        color: widget.outlined ? cs.primary : (widget.tonal ? cs.onSecondaryContainer : cs.onPrimary)));
    final content = Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
      if (busy) spinner else if (widget.icon != null) Icon(widget.icon, size: 19),
      if (busy || widget.icon != null) const SizedBox(width: 8),
      Flexible(child: widget.child),
    ]);
    final on = widget.onPressed == null || busy ? null : _run;
    Widget b;
    if (widget.outlined) {
      b = OutlinedButton(onPressed: on, style: widget.danger ? OutlinedButton.styleFrom(foregroundColor: cs.error, side: BorderSide(color: cs.error.withValues(alpha: .6))) : null, child: content);
    } else if (widget.tonal) {
      b = FilledButton.tonal(onPressed: on, child: content);
    } else {
      b = FilledButton(onPressed: on, style: widget.danger ? FilledButton.styleFrom(backgroundColor: cs.error, foregroundColor: cs.onError) : null, child: content);
    }
    return widget.expand ? SizedBox(width: double.infinity, child: b) : b;
  }
}

// ---------------------------------------------------------------- data loading with all states
/// Loads data, shows loading / error / content, supports pull-to-refresh and reloads automatically
/// whenever [AppSession.dataTick] fires (realtime change from the app or the website).
class Loader<T> extends StatefulWidget {
  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data, Future<void> Function() reload) builder;
  final bool live;
  final Widget? loading;
  const Loader({super.key, required this.load, required this.builder, this.live = true, this.loading});
  @override
  State<Loader<T>> createState() => LoaderState<T>();
}

class LoaderState<T> extends State<Loader<T>> {
  T? data;
  Object? error;
  bool loaded = false;
  int _gen = 0;

  @override
  void initState() {
    super.initState();
    reload();
    if (widget.live) AppSession.instance.dataTick.addListener(_onTick);
  }

  void _onTick() => reload();

  @override
  void dispose() {
    AppSession.instance.dataTick.removeListener(_onTick);
    super.dispose();
  }

  Future<void> reload() async {
    final g = ++_gen;
    try {
      final d = await widget.load();
      if (!mounted || g != _gen) return;
      setState(() { data = d; error = null; loaded = true; });
    } catch (e) {
      if (!mounted || g != _gen) return;
      setState(() { error = e; loaded = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!loaded) return widget.loading ?? const Center(child: Padding(padding: EdgeInsets.all(48), child: BridgeLoader(label: 'Loading')));
    if (error != null && data == null) {
      return ErrorState(error: error!, onRetry: () { setState(() => loaded = false); reload(); });
    }
    return widget.builder(context, data as T, reload);
  }
}

class ErrorState extends StatelessWidget {
  final Object error;
  final VoidCallback onRetry;
  const ErrorState({super.key, required this.error, required this.onRetry});
  @override
  Widget build(BuildContext context) => EmptyState(
        icon: Icons.cloud_off_rounded, title: 'We couldn’t load this', text: friendlyError(error), tone: Brand.terracotta,
        action: OutlinedButton.icon(onPressed: onRetry, icon: const Icon(Icons.refresh_rounded), label: const Text('Try again')),
      );
}

class EmptyState extends StatelessWidget {
  final IconData icon;
  final String title, text;
  final Widget? action;
  final Color? tone;
  const EmptyState({super.key, required this.icon, required this.title, required this.text, this.action, this.tone});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final c = tone ?? (t.brightness == Brightness.dark ? Brand.gold : Brand.forest);
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 40),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 84, height: 84,
            decoration: BoxDecoration(shape: BoxShape.circle, color: c.withValues(alpha: .1), border: Border.all(color: c.withValues(alpha: .25))),
            child: Icon(icon, size: 36, color: c),
          ),
          const SizedBox(height: 18),
          Text(title, style: t.textTheme.titleLarge, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          Text(text, style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant), textAlign: TextAlign.center),
          if (action != null) ...[const SizedBox(height: 20), action!],
        ]),
      ),
    );
  }
}

// ---------------------------------------------------------------- display bits
class StatusChip extends StatelessWidget {
  final String status;
  final String? label;
  const StatusChip(this.status, {super.key, this.label});
  @override
  Widget build(BuildContext context) {
    final tone = StatusTone.of(context, status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: tone.bg, borderRadius: BorderRadius.circular(20)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: tone.fg, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text((label ?? status).replaceAll('_', ' ').toUpperCase(),
            style: TextStyle(fontFamily: sans, fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: .8, color: tone.fg)),
      ]),
    );
  }
}

class SectionTitle extends StatelessWidget {
  final String title;
  final String? kicker;
  final Widget? trailing;
  const SectionTitle(this.title, {super.key, this.kicker, this.trailing});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 10),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (kicker != null) Text(kicker!.toUpperCase(), style: t.labelSmall),
          Text(title, style: t.headlineSmall),
        ])),
        ?trailing,
      ]),
    );
  }
}

/// Animated statistic (counts up once; respects reduced motion).
class StatCard extends StatelessWidget {
  final num value;
  final String label;
  final IconData icon;
  final bool highlight;
  final String? suffix;
  const StatCard({super.key, required this.value, required this.label, required this.icon, this.highlight = false, this.suffix});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final reduce = MediaQuery.of(context).disableAnimations;
    final fg = highlight ? Brand.cream : t.colorScheme.onSurface;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: highlight ? Brand.forest : t.colorScheme.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: highlight ? Brand.forest : t.colorScheme.outline.withValues(alpha: .7)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(color: (highlight ? Brand.gold : t.colorScheme.primary).withValues(alpha: .14), borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, size: 20, color: highlight ? Brand.gold : t.colorScheme.primary),
        ),
        const SizedBox(height: 14),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: value.toDouble()),
          duration: reduce ? Duration.zero : const Duration(milliseconds: 1100),
          curve: Curves.easeOutCubic,
          builder: (_, v, _) => Text('${fmtNum(v.round())}${suffix ?? ''}',
              style: TextStyle(fontFamily: serif, fontSize: 30, height: 1, color: fg)),
        ),
        const SizedBox(height: 6),
        Text(label, style: t.textTheme.bodySmall?.copyWith(color: highlight ? Brand.cream.withValues(alpha: .8) : null), maxLines: 2),
      ]),
    );
  }
}

class AppAvatar extends StatelessWidget {
  final String? name, url;
  final double size;
  const AppAvatar({super.key, this.name, this.url, this.size = 40});
  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(size * .3),
        child: Container(
          width: size, height: size, color: Brand.gold, alignment: Alignment.center,
          child: (url != null && url!.isNotEmpty)
              ? Image.network(url!, width: size, height: size, fit: BoxFit.cover, errorBuilder: (_, _, _) => _ini())
              : _ini(),
        ),
      );
  Widget _ini() => Text(initials(name), style: TextStyle(fontFamily: sans, fontWeight: FontWeight.w700, color: Brand.dark, fontSize: size * .38));
}

class Pad extends StatelessWidget {
  final Widget child;
  const Pad(this.child, {super.key});
  @override
  Widget build(BuildContext context) => Padding(padding: const EdgeInsets.symmetric(horizontal: 20), child: child);
}

// ---------------------------------------------------------------- dialogs
Future<String?> askText(BuildContext c, {required String title, required String label, String cta = 'Submit', bool required = true, bool danger = false, int maxLength = 300}) {
  final ctl = TextEditingController();
  final key = GlobalKey<FormState>();
  return showDialog<String>(
    context: c,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: Form(key: key, child: TextFormField(
        controller: ctl, autofocus: true, maxLines: 3, maxLength: maxLength, decoration: InputDecoration(labelText: label),
        validator: (v) => required && (v ?? '').trim().isEmpty ? 'Please write a short reason.' : null,
      )),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
        FilledButton(
          style: danger ? FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error) : null,
          onPressed: () { if (key.currentState!.validate()) Navigator.pop(ctx, ctl.text.trim()); },
          child: Text(cta),
        ),
      ],
    ),
  );
}

Future<bool> confirm(BuildContext c, {required String title, required String text, String cta = 'Confirm', bool danger = false}) async =>
    await showDialog<bool>(
      context: c,
      builder: (ctx) => AlertDialog(title: Text(title), content: Text(text), actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(style: danger ? FilledButton.styleFrom(backgroundColor: Theme.of(ctx).colorScheme.error) : null,
            onPressed: () => Navigator.pop(ctx, true), child: Text(cta)),
      ]),
    ) ==
    true;

/// Tappable card with consistent styling.
class TapCard extends StatelessWidget {
  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final Color? color;
  const TapCard({super.key, required this.child, this.onTap, this.padding = const EdgeInsets.all(16), this.color});
  @override
  Widget build(BuildContext context) => Card(
        color: color,
        clipBehavior: Clip.antiAlias,
        child: InkWell(onTap: onTap, child: Padding(padding: padding, child: child)),
      );
}

class InfoRow extends StatelessWidget {
  final IconData icon;
  final String text;
  const InfoRow(this.icon, this.text, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(icon, size: 16, color: t.colorScheme.onSurfaceVariant),
        const SizedBox(width: 8),
        Expanded(child: Text(text, style: t.textTheme.bodyMedium?.copyWith(color: t.colorScheme.onSurfaceVariant))),
      ]),
    );
  }
}

/// Banner explaining why actions are locked (no organisation / pending / rejected / suspended).
class VerifyBanner extends StatelessWidget {
  final VoidCallback onOpenProfile;
  const VerifyBanner({super.key, required this.onOpenProfile});
  @override
  Widget build(BuildContext context) {
    final o = AppSession.instance.org;
    final (IconData, String, String, String)? m = o == null
        ? (Icons.storefront_rounded, 'Set up your organisation', 'Add your details and verification documents to get started.', 'pending')
        : o.suspended
            ? (Icons.block_rounded, 'Your account is suspended', o.suspendedReason ?? 'Please contact AnnSetu support.', 'rejected')
            : o.verification == 'pending'
                ? (Icons.hourglass_top_rounded, 'Verification pending', 'An admin is reviewing your organisation. Make sure your documents are uploaded.', 'pending')
                : o.verification == 'rejected'
                    ? (Icons.report_gmailerrorred_rounded, 'Verification was rejected', o.verificationNote ?? 'Review your documents and try again.', 'rejected')
                    : null;
    if (m == null) return const SizedBox.shrink();
    final tone = StatusTone.of(context, m.$4);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
      child: Material(
        color: tone.bg, borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16), onTap: onOpenProfile,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Icon(m.$1, color: tone.fg),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(m.$2, style: TextStyle(fontWeight: FontWeight.w700, color: tone.fg)),
                Text(m.$3, style: TextStyle(color: tone.fg.withValues(alpha: .85), fontSize: 13)),
              ])),
              Icon(Icons.chevron_right_rounded, color: tone.fg),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Debounces rapid calls (search fields).
class Debouncer {
  final Duration delay;
  Timer? _t;
  Debouncer([this.delay = const Duration(milliseconds: 300)]);
  void call(VoidCallback f) { _t?.cancel(); _t = Timer(delay, f); }
  void dispose() => _t?.cancel();
}
