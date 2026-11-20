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

const serif = 'Fraunces';        // website headings
const sans = 'DMSans';           // website body
const grot = 'SpaceGrotesk';     // website labels, buttons, navigation

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
      primaryContainer: isDark ? const Color(0xFF1E3D52) : const Color(0xFFCFE6F1),
      onPrimaryContainer: isDark ? Brand.cream : Brand.forest,
      secondary: Brand.gold,
      onSecondary: Brand.dark,
      secondaryContainer: isDark ? const Color(0xFF3A3420) : const Color(0xFFFFF1C4),
      onSecondaryContainer: isDark ? Brand.cream : Brand.goldDeep,
      tertiary: Brand.terracotta,
      onTertiary: Colors.white,
      error: isDark ? const Color(0xFFE59A80) : Brand.terraDeep,
      onError: Colors.white,
      errorContainer: isDark ? const Color(0xFF4A2826) : const Color(0xFFF6D3CC),
      onErrorContainer: isDark ? const Color(0xFFF6CDBF) : Brand.terraDeep,
      surface: surface,
      onSurface: onSurface,
      onSurfaceVariant: muted,
      surfaceContainerLowest: bg,
      surfaceContainerLow: isDark ? const Color(0xFF13212C) : const Color(0xFFE2F0F6),
      surfaceContainer: isDark ? Brand.nightSurface : const Color(0xFFDDEEF5),
      surfaceContainerHigh: isDark ? const Color(0xFF1E3344) : const Color(0xFFD2E8F1),
      surfaceContainerHighest: isDark ? const Color(0xFF24394A) : const Color(0xFFC8E1EC),
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
      titleLarge: s(t.titleLarge, family: serif, size: 21, w: FontWeight.w600, height: 1.2),
      titleMedium: s(t.titleMedium, size: 16, w: FontWeight.w600),
      titleSmall: s(t.titleSmall, size: 14, w: FontWeight.w600),
      bodyLarge: s(t.bodyLarge, size: 16, height: 1.5),
      bodyMedium: s(t.bodyMedium, size: 14.5, height: 1.5),
      bodySmall: s(t.bodySmall, size: 12.5, height: 1.4).copyWith(color: muted),
      labelLarge: s(t.labelLarge, family: grot, size: 15, w: FontWeight.w700, ls: .1),
      labelMedium: s(t.labelMedium, family: grot, size: 12.5, w: FontWeight.w600, ls: .4),
      labelSmall: s(t.labelSmall, family: grot, size: 11, w: FontWeight.w700, ls: 1.4).copyWith(color: muted),
    );
    final radius = BorderRadius.circular(22); // website cards: soft, rounded
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
        filled: true, fillColor: isDark ? const Color(0xFF13212C) : const Color(0xFFF2F9FC),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: line)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: line)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: isDark ? const Color(0xFF8CC8DE) : Brand.sage, width: 2)),
        errorBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide(color: scheme.error)),
        labelStyle: TextStyle(color: muted), floatingLabelStyle: TextStyle(color: scheme.primary, fontWeight: FontWeight.w600),
      ),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(
        minimumSize: const Size(64, 54), padding: const EdgeInsets.symmetric(horizontal: 24),
        backgroundColor: isDark ? Brand.gold : Brand.dark, foregroundColor: isDark ? Brand.dark : Brand.gold,
        shape: const StadiumBorder(), textStyle: text.labelLarge, // bold pill buttons, like the website
      )),
      outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 50), padding: const EdgeInsets.symmetric(horizontal: 20), foregroundColor: onSurface,
        side: BorderSide(color: isDark ? line : Brand.dark, width: 1.6), shape: const StadiumBorder(),
        textStyle: text.labelLarge,
      )),
      textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(foregroundColor: isDark ? Brand.gold : Brand.forest, textStyle: text.labelLarge)),
      chipTheme: base.chipTheme.copyWith(
        backgroundColor: surface, selectedColor: isDark ? Brand.gold : Brand.forest, side: BorderSide(color: line),
        labelStyle: text.labelMedium, secondaryLabelStyle: text.labelMedium?.copyWith(color: isDark ? Brand.dark : Brand.cream),
        checkmarkColor: isDark ? Brand.dark : Brand.cream, shape: const StadiumBorder(),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: Brand.dark, height: 72, elevation: 0, // website sidebar: deep ink with a sunshine pill
        indicatorColor: Brand.gold,
        indicatorShape: const StadiumBorder(),
        iconTheme: WidgetStateProperty.resolveWith((st) => IconThemeData(color: st.contains(WidgetState.selected) ? Brand.dark : Brand.cream.withValues(alpha: .72), size: 24)),
        labelTextStyle: WidgetStateProperty.resolveWith((st) => TextStyle(fontFamily: grot, fontSize: 11.5,
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      bottomSheetTheme: BottomSheetThemeData(backgroundColor: bg, showDragHandle: true,
          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24)))),
      dialogTheme: DialogThemeData(backgroundColor: surface, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(26))),
      listTileTheme: ListTileThemeData(iconColor: muted, contentPadding: const EdgeInsets.symmetric(horizontal: 16)),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: isDark ? Brand.gold : Brand.sage, linearTrackColor: line.withValues(alpha: .5)),
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
        return dark ? const StatusTone(Color(0x298CC8DE), Color(0xFFA9D3E3)) : const StatusTone(Color(0xFFA8D9E9), Color(0xFF0E3553));
      case 'pending': case 'reviewing': case 'in_review': case 'new': case 'reserved':
        return dark ? const StatusTone(Color(0x24F2D88C), Color(0xFFEBD493)) : const StatusTone(Color(0xFFF5D98B), Color(0xFF4A3A0C));
      case 'rejected': case 'cancelled': case 'withdrawn': case 'suspended': case 'dismissed':
        return dark ? const StatusTone(Color(0x29E8907F), Color(0xFFEBA898)) : const StatusTone(Color(0xFFF6D3CC), Color(0xFF8E2F20));
      default:
        return dark ? const StatusTone(Color(0xFF24394A), Color(0xFF93AAB8)) : const StatusTone(Color(0xFFD2E8F1), Color(0xFF3A5C74));
    }
  }
}
