import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// AnnSetu brand palette (same values as the website's CSS variables).
class Brand {
  // "Ocean & Sunshine" (same as the website). Names kept from v1 so every screen picks up the new palette.
  static const forest = Color(0xFF164B70);     // Deep Ocean (primary)
  static const dark = Color(0xFF102F46);       // Deep Ink
  static const cream = Color(0xFFF4ECD8);      // warm light text on dark
  static const gold = Color(0xFFFFE28A);       // Sunshine (accents on dark)
  static const sage = Color(0xFF287FA6);       // Ocean Blue
  static const terracotta = Color(0xFFE87968); // Coral
  static const sky = Color(0xFF82C5DF);
  static const butter = Color(0xFFF5D98B);
  // Derived tones (website: --bg / --surface / --line)
  static const paper = Color(0xFFD6ECF4);
  static const parchment = Color(0xFFC4E2EE);
  static const line = Color(0xFFA8C8D8);
  static const night = Color(0xFF0F1A24);
  static const nightSurface = Color(0xFF182A38);
  static const nightLine = Color(0xFF2A4254);
  static const goldDeep = Color(0xFF8A6A10); // sunshine tone dark enough for text on light backgrounds (AA)
  static const terraDeep = Color(0xFFB5523F);
}

const serif = 'DMSerifDisplay';
const sans = 'DMSans';

class AppTheme {
  static ThemeData light() => _build(Brightness.light);
  static ThemeData dark() => _build(Brightness.dark);

  static ThemeData _build(Brightness b) {
    final isDark = b == Brightness.dark;
    final bg = isDark ? Brand.night : Brand.paper;
    final surface = isDark ? Brand.nightSurface : const Color(0xFFE8F4F9);
    final onSurface = isDark ? const Color(0xFFDCE8EF) : Brand.dark;
    final muted = isDark ? const Color(0xFF93AAB8) : const Color(0xFF3F5E72);
    final line = isDark ? Brand.nightLine : Brand.line;
    final scheme = ColorScheme(
      brightness: b,
      primary: isDark ? Brand.gold : Brand.forest,
      onPrimary: isDark ? Brand.dark : Brand.cream,
      primaryContainer: isDark ? const Color(0xFF1E4A40) : const Color(0xFFDCE5DD),
      onPrimaryContainer: isDark ? Brand.cream : Brand.forest,
      secondary: Brand.gold,
      onSecondary: Brand.dark,
      secondaryContainer: isDark ? const Color(0xFF3A3020) : const Color(0xFFF1E5C8),
      onSecondaryContainer: isDark ? Brand.cream : Brand.goldDeep,
      tertiary: Brand.terracotta,
      onTertiary: Colors.white,
      error: isDark ? const Color(0xFFE59A80) : Brand.terraDeep,
      onError: Colors.white,
      errorContainer: isDark ? const Color(0xFF4A2A20) : const Color(0xFFF4DED5),
      onErrorContainer: isDark ? const Color(0xFFF6CDBF) : Brand.terraDeep,
      surface: surface,
      onSurface: onSurface,
      onSurfaceVariant: muted,
      surfaceContainerLowest: bg,
      surfaceContainerLow: isDark ? const Color(0xFF0F231C) : const Color(0xFFF0EADA),
      surfaceContainer: isDark ? Brand.nightSurface : Brand.parchment,
      surfaceContainerHigh: isDark ? const Color(0xFF173129) : const Color(0xFFE4DAC0),
      surfaceContainerHighest: isDark ? const Color(0xFF1C3A30) : const Color(0xFFDDD2B5),
      outline: line,
      outlineVariant: line.withValues(alpha: .6),
      shadow: Colors.black,
      inverseSurface: isDark ? Brand.cream : Brand.forest,
      onInverseSurface: isDark ? Brand.dark : Brand.cream,
      inversePrimary: Brand.gold,
    );

    final base = ThemeData(useMaterial3: true, colorScheme: scheme, fontFamily: sans, brightness: b);
    final t = base.textTheme;
    TextStyle s(TextStyle? x, {double? size, FontWeight? w, String? family, double? height, double? ls}) =>
        (x ?? const TextStyle()).copyWith(fontFamily: family ?? sans, fontSize: size, fontWeight: w, height: height, letterSpacing: ls, color: onSurface);
    final text = t.copyWith(
      displayLarge: s(t.displayLarge, family: serif, size: 48, height: 1.05, ls: -0.5),
      displayMedium: s(t.displayMedium, family: serif, size: 38, height: 1.08, ls: -0.3),
      displaySmall: s(t.displaySmall, family: serif, size: 32, height: 1.1),
      headlineLarge: s(t.headlineLarge, family: serif, size: 30, height: 1.12),
      headlineMedium: s(t.headlineMedium, family: serif, size: 26, height: 1.15),
      headlineSmall: s(t.headlineSmall, family: serif, size: 22, height: 1.2),
      titleLarge: s(t.titleLarge, family: serif, size: 20, height: 1.25),
      titleMedium: s(t.titleMedium, size: 16, w: FontWeight.w600),
      titleSmall: s(t.titleSmall, size: 14, w: FontWeight.w600),
      bodyLarge: s(t.bodyLarge, size: 16, height: 1.5),
      bodyMedium: s(t.bodyMedium, size: 14.5, height: 1.5),
      bodySmall: s(t.bodySmall, size: 12.5, height: 1.4).copyWith(color: muted),
      labelLarge: s(t.labelLarge, size: 14, w: FontWeight.w600, ls: .2),
      labelMedium: s(t.labelMedium, size: 12, w: FontWeight.w600, ls: .6),
      labelSmall: s(t.labelSmall, size: 11, w: FontWeight.w600, ls: 1.2).copyWith(color: muted),
    );
    final radius = BorderRadius.circular(14);
    return base.copyWith(
      scaffoldBackgroundColor: bg,
      textTheme: text,
      appBarTheme: AppBarTheme(
        backgroundColor: bg, foregroundColor: onSurface, elevation: 0, scrolledUnderElevation: 0.5, centerTitle: false,
        titleTextStyle: text.titleLarge,
        systemOverlayStyle: isDark ? SystemUiOverlayStyle.light : SystemUiOverlayStyle.dark,
      ),
      cardTheme: CardThemeData(
        color: surface, elevation: 0, margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: radius, side: BorderSide(color: line.withValues(alpha: .7))),
      ),
      dividerTheme: DividerThemeData(color: line.withValues(alpha: .7), thickness: 1, space: 1),
      inputDecorationTheme: InputDecorationTheme(
        filled: true, fillColor: isDark ? const Color(0xFF0F231C) : Colors.white.withValues(alpha: .6),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: line)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: scheme.primary, width: 1.6)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: scheme.error)),
        labelStyle: TextStyle(color: muted), floatingLabelStyle: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600),
      ),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        minimumSize: const Size(64, 52), padding: const EdgeInsets.symmetric(horizontal: 22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)), textStyle: text.labelLarge,
      )),
      outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 50), padding: const EdgeInsets.symmetric(horizontal: 20), foregroundColor: onSurface,
        side: BorderSide(color: line, width: 1.4), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: text.labelLarge,
      )),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: isDark ? Brand.gold : Brand.forest, textStyle: text.labelLarge)),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: surface, selectedColor: isDark ? Brand.gold : Brand.forest, side: BorderSide(color: line),
        labelStyle: text.labelMedium, secondaryLabelStyle: text.labelMedium?.copyWith(color: isDark ? Brand.dark : Brand.cream),
        checkmarkColor: isDark ? Brand.dark : Brand.cream, shape: const StadiumBorder(),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: isDark ? Brand.nightSurface : Brand.forest, height: 70, elevation: 0,
        indicatorColor: isDark ? Brand.gold.withValues(alpha: .22) : Brand.gold.withValues(alpha: .28),
        indicatorShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        iconTheme: WidgetStateProperty.resolveWith((st) => IconThemeData(color: st.contains(WidgetState.selected) ? Brand.gold : Brand.cream.withValues(alpha: .72), size: 24)),
        labelTextStyle: WidgetStateProperty.resolveWith((st) => TextStyle(fontFamily: sans, fontSize: 11.5,
            fontWeight: st.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
            color: st.contains(WidgetState.selected) ? Brand.cream : Brand.cream.withValues(alpha: .72))),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: onSurface, unselectedLabelColor: muted, indicatorColor: Brand.gold, dividerColor: line.withValues(alpha: .6),
        labelStyle: text.labelLarge, unselectedLabelStyle: text.labelLarge?.copyWith(fontWeight: FontWeight.w500),
        indicatorSize: TabBarIndicatorSize.label,
      ),
      snackBarTheme: SnackBarThemeData(
        behavior: SnackBarBehavior.floating, backgroundColor: isDark ? Brand.cream : Brand.dark,
        contentTextStyle: TextStyle(fontFamily: sans, color: isDark ? Brand.dark : Brand.cream, fontSize: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      bottomSheetTheme: BottomSheetThemeData(backgroundColor: bg, showDragHandle: true,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24)))),
      dialogTheme: DialogThemeData(backgroundColor: bg, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20))),
      listTileTheme: ListTileThemeData(iconColor: muted, contentPadding: const EdgeInsets.symmetric(horizontal: 16)),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: isDark ? Brand.gold : Brand.forest, linearTrackColor: line.withValues(alpha: .5)),
      pageTransitionsTheme: const PageTransitionsTheme(builders: {
        TargetPlatform.android: FadeForwardsPageTransitionsBuilder(),
      }),
    );
  }
}

/// Status → colours, consistent everywhere (chips, timeline, admin tables).
class StatusTone {
  final Color bg, fg;
  const StatusTone(this.bg, this.fg);
  static StatusTone of(BuildContext c, String s) {
    final dark = Theme.of(c).brightness == Brightness.dark;
    switch (s) {
      case 'approved': case 'accepted': case 'completed': case 'active': case 'open': case 'resolved': case 'fulfilled': case 'replied':
        return dark ? const StatusTone(Color(0xFF1E4A40), Color(0xFFBFD8C9)) : const StatusTone(Color(0xFFDCE5DD), Brand.forest);
      case 'pending': case 'reviewing': case 'in_review': case 'new': case 'reserved':
        return dark ? const StatusTone(Color(0xFF3A3020), Color(0xFFE7CC8F)) : const StatusTone(Color(0xFFF1E5C8), Brand.goldDeep);
      case 'rejected': case 'cancelled': case 'withdrawn': case 'suspended': case 'dismissed':
        return dark ? const StatusTone(Color(0xFF4A2A20), Color(0xFFF2B9A5)) : const StatusTone(Color(0xFFF4DED5), Brand.terraDeep);
      default:
        return dark ? const StatusTone(Color(0xFF1C3A30), Color(0xFFA9B8AE)) : const StatusTone(Color(0xFFE4DAC0), Color(0xFF4B5F55));
    }
  }
}
