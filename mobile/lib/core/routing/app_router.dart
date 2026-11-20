import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../features/admin/admin_feedback_screen.dart';
import '../../features/admin/admin_sections.dart';
import '../../features/authentication/auth_screens.dart';
import '../../features/donations/create_listing_screen.dart';
import '../../features/feedback/feedback_screens.dart';
import '../../features/messaging/chat_screen.dart';
import '../../features/assistant/assistant_screen.dart';
import '../../features/donor/community_needs.dart';
import '../../features/notifications/notifications_screen.dart';
import '../../features/onboarding/onboarding_screen.dart';
import '../../features/onboarding/splash_screen.dart';
import '../../features/receiver/needs_screen.dart';
import '../../features/shell/role_shell.dart';
import '../constants/domain.dart';
import '../services/session.dart';

class Onboarding {
  static bool seen = false;
  static const _k = 'annsetu.onboarding_seen';
  static Future<void> load() async => seen = (await SharedPreferences.getInstance()).getBool(_k) ?? false;
  static Future<void> done() async {
    seen = true;
    await (await SharedPreferences.getInstance()).setBool(_k, true);
  }
}

const _authPaths = {'/signin', '/register', '/forgot'};

/// Every protected route is guarded here AND by the database (RLS / RPC checks).
final GoRouter appRouter = GoRouter(
  initialLocation: '/splash',
  refreshListenable: AppSession.instance,
  redirect: (context, state) {
    final s = AppSession.instance;
    final loc = state.matchedLocation;
    if (s.status == SessionStatus.loading) return loc == '/splash' ? null : '/splash';
    if (s.recoveringPassword) return loc == '/reset-password' ? null : '/reset-password';
    if (s.status == SessionStatus.error) return loc == '/splash' ? null : '/splash';
    if (s.status == SessionStatus.signedOut) {
      if (loc == '/onboarding' || _authPaths.contains(loc)) return null;
      return Onboarding.seen ? '/signin' : '/onboarding';
    }
    // signed in
    if (loc == '/splash' || loc == '/onboarding' || _authPaths.contains(loc) || loc == '/reset-password') return '/home';
    if (loc.startsWith('/admin') && s.role != Role.admin) return '/home';
    if (loc.startsWith('/listing/new') && s.role != Role.donor) return '/home';
    if (loc.startsWith('/needs') && s.role != Role.ngo) return '/home';
    return null;
  },
  routes: [
    GoRoute(path: '/splash', builder: (_, _) => const SplashScreen()),
    GoRoute(path: '/onboarding', builder: (_, _) => const OnboardingScreen()),
    GoRoute(path: '/signin', builder: (_, _) => const SignInScreen()),
    GoRoute(path: '/register', builder: (_, s) => RegisterScreen(initialRole: roleFrom(s.uri.queryParameters['role']))),
    GoRoute(path: '/forgot', builder: (_, _) => const ForgotPasswordScreen()),
    GoRoute(path: '/reset-password', builder: (_, _) => const ResetPasswordScreen()),
    GoRoute(path: '/home', builder: (_, s) => RoleShell(initialTab: int.tryParse(s.uri.queryParameters['tab'] ?? ''))),
    GoRoute(path: '/notifications', builder: (_, _) => const NotificationsScreen()),
    GoRoute(path: '/listing/new', builder: (_, s) => CreateListingScreen(initialTitle: s.uri.queryParameters['title'], initialQty: int.tryParse(s.uri.queryParameters['qty'] ?? ''))),
    GoRoute(path: '/needs', builder: (_, _) => const NeedsScreen()),
    GoRoute(path: '/chat/:id', builder: (_, s) {
      final q = s.uri.queryParameters;
      return ChatScreen(requestId: s.pathParameters['id']!, title: q['title'] ?? 'Messages', side: q['side'] ?? 'donor',
          names: {if (q['d'] != null) 'donor': q['d']!, if (q['n'] != null) 'ngo': q['n']!, if (q['r'] != null) 'rep': q['r']!});
    }),
    GoRoute(path: '/assistant', builder: (_, _) => const AssistantScreen()),
    GoRoute(path: '/community-needs', builder: (_, _) => const CommunityNeedsScreen()),
    GoRoute(path: '/feedback', builder: (_, _) => const MyFeedbackScreen()),
    GoRoute(path: '/feedback/new', builder: (_, s) => FeedbackFormScreen(initialCategory: s.uri.queryParameters['category'])),
    GoRoute(path: '/admin/feedback', builder: (_, _) => const AdminFeedbackScreen()),
    GoRoute(path: '/admin/:section', builder: (_, s) => AdminSectionScreen(section: s.pathParameters['section']!)),
  ],
  errorBuilder: (_, _) => const RedirectHome(),
);

class RedirectHome extends StatelessWidget {
  const RedirectHome({super.key});
  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) => context.go('/home'));
    return const Scaffold();
  }
}
