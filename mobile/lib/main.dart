import 'dart:async';
import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'core/routing/app_router.dart';
import 'core/services/notification_service.dart';
import 'core/services/session.dart';
import 'core/services/supabase_service.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('en_IN');
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent));
  // Nothing optional may stop the app from opening: each step falls back safely if it fails.
  await _safe('settings', () => Future.wait([ThemeController.instance.load(), Onboarding.load()]));
  await initSupabase();
  await _safe('notifications', NotificationService.instance.init);
  NotificationService.instance.onOpenRoute = (r) => appRouter.go(r);
  unawaited(AppSession.instance.start());
  AppSession.instance.addListener(() {
    if (AppSession.instance.status == SessionStatus.ready) NotificationService.instance.enableForSignedInUser();
  });
  _deepLinks();
  // End-to-end test builds (--dart-define=E2E=true) expose the accessibility tree so a browser
  // test can find widgets by their labels. Never set in release builds.
  if (const bool.fromEnvironment('E2E')) SemanticsBinding.instance.ensureSemantics();
  runApp(const AnnSetuApp());
}

Future<void> _safe(String what, Future<Object?> Function() step) async {
  try {
    await step();
  } catch (e, st) {
    debugPrint('Startup step "$what" failed, continuing: $e\n$st');
  }
}

/// `annsetu://open/PATH` opens a screen, e.g. annsetu://open/notifications or annsetu://open/home?tab=2.
/// Auth callbacks (annsetu://login-callback?...) are handled by supabase_flutter itself.
void _deepLinks() {
  if (kIsWeb) return;
  AppLinks().uriLinkStream.listen((uri) {
    if (uri.scheme == 'annsetu' && uri.host == 'open') {
      final path = uri.path.isEmpty ? '/home' : uri.path;
      appRouter.go(uri.hasQuery ? '$path?${uri.query}' : path);
    }
  });
}

class AnnSetuApp extends StatelessWidget {
  const AnnSetuApp({super.key});
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<ThemeMode>(
        valueListenable: ThemeController.instance,
        builder: (_, mode, _) => MaterialApp.router(
          title: 'AnnSetu',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: mode,
          routerConfig: appRouter,
        ),
      );
}
