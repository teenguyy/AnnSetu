import 'package:annsetu/core/theme/app_theme.dart';
import 'package:annsetu/features/authentication/auth_screens.dart';
import 'package:annsetu/features/donations/create_listing_screen.dart';
import 'package:annsetu/features/feedback/feedback_screens.dart';
import 'package:annsetu/shared/widgets/brand.dart';
import 'package:annsetu/shared/widgets/common.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget app(Widget child, {ThemeMode mode = ThemeMode.light}) =>
    MaterialApp(theme: AppTheme.light(), darkTheme: AppTheme.dark(), themeMode: mode, home: child);

void main() {
  testWidgets('light and dark themes build with the brand palette', (t) async {
    for (final m in [ThemeMode.light, ThemeMode.dark]) {
      await t.pumpWidget(app(const Scaffold(body: Center(child: Logo())), mode: m));
      expect(find.byType(BrandMark), findsOneWidget);
    }
    expect(AppTheme.light().colorScheme.primary, Brand.forest);
    expect(AppTheme.dark().colorScheme.primary, Brand.gold);
  });

  testWidgets('status chip, empty state and stat card render', (t) async {
    await t.pumpWidget(app(const Scaffold(body: Column(children: [
      StatusChip('in_review'),
      StatCard(value: 42, label: 'Units donated', icon: Icons.scale),
      Expanded(child: EmptyState(icon: Icons.inbox, title: 'No requests', text: 'They appear here.')),
    ]))));
    await t.pumpAndSettle();
    expect(find.text('IN REVIEW'), findsOneWidget);
    expect(find.text('42'), findsOneWidget); // count-up animation lands on the real value
    expect(find.text('No requests'), findsOneWidget);
  });

  testWidgets('BusyButton shows a friendly error instead of crashing', (t) async {
    await t.pumpWidget(app(Scaffold(body: BusyButton(onPressed: () async => throw Exception('new row violates row-level security policy'), child: const Text('Go')))));
    await t.tap(find.text('Go'));
    await t.pump(const Duration(milliseconds: 100));
    expect(find.textContaining('permission'), findsOneWidget);
  });

  testWidgets('bridge loader animates and is labelled for screen readers', (t) async {
    final sem = t.ensureSemantics();
    await t.pumpWidget(app(const Scaffold(body: Center(child: BridgeLoader(label: 'Loading')))));
    await t.pump(const Duration(milliseconds: 800));
    expect(find.bySemanticsLabel(RegExp('Loading')), findsWidgets);
    sem.dispose();
  });

  testWidgets('sign-in validates before contacting the backend', (t) async {
    await t.pumpWidget(app(const SignInScreen()));
    await t.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await t.pump();
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);
    expect(find.text('Continue with Google'), findsOneWidget);
    expect(find.text('Forgot password?'), findsOneWidget);
  });

  testWidgets('registration requires a role, offers Donor and Receiver, and meters the password', (t) async {
    await t.pumpWidget(app(const RegisterScreen()));
    expect(find.text('Donor'), findsOneWidget);
    expect(find.text('Receiver'), findsOneWidget);
    final create = find.widgetWithText(FilledButton, 'Create account');
    await t.ensureVisible(create);
    await t.tap(create);
    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('Please choose how you are joining.'), findsOneWidget);
    ScaffoldMessenger.of(t.element(find.byType(Scaffold).first)).removeCurrentSnackBar(); // it would cover the button
    await t.pumpAndSettle();
    await t.ensureVisible(find.text('Receiver'));
    await t.tap(find.text('Receiver'));
    await t.enterText(find.widgetWithText(TextFormField, 'Password'), 'Abcdefg1!');
    await t.pump();
    await t.ensureVisible(create);
    await t.tap(create);
    await t.pump(const Duration(milliseconds: 100));
    expect(find.text('Your name must be at least 2 characters.'), findsOneWidget);
    expect(find.text('Enter a valid email address.'), findsOneWidget);
  });

  testWidgets('new listing form validates required fields locally', (t) async {
    await t.pumpWidget(app(const CreateListingScreen()));
    final publish = find.widgetWithText(FilledButton, 'Publish listing');
    await t.scrollUntilVisible(publish, 300, scrollable: find.byType(Scrollable).first);
    await t.tap(publish);
    await t.pump();
    expect(find.text('Food item must be at least 2 characters.'), findsOneWidget);
    expect(find.text('Quantity must be between 1 and 10000.'), findsOneWidget);
    expect(find.text('Cooked meals'), findsOneWidget); // default category
  });

  testWidgets('feedback form offers all 7 categories, a rating and validates', (t) async {
    await t.pumpWidget(app(const FeedbackFormScreen(initialCategory: 'bug')));
    for (final c in ['General feedback', 'Bug report', 'Feature request', 'Account issue', 'Donation issue', 'Pickup issue', 'Other']) {
      expect(find.text(c), findsOneWidget);
    }
    expect(find.text('Attach a screenshot (optional)'), findsOneWidget); // offered for bug reports
    await t.tap(find.byTooltip('4 stars'));
    await t.pump();
    expect(find.text('4 / 5'), findsOneWidget);
    final send = find.widgetWithText(FilledButton, 'Send feedback');
    await t.scrollUntilVisible(send, 300, scrollable: find.byType(Scrollable).first);
    await t.tap(send);
    await t.pump();
    expect(find.text('Subject must be at least 3 characters.'), findsOneWidget);
    expect(find.text('Message must be at least 10 characters.'), findsOneWidget);
  });
}
