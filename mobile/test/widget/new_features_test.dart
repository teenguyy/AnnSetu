import 'package:annsetu/core/models/models.dart';
import 'package:annsetu/core/theme/app_theme.dart';
import 'package:annsetu/features/assistant/assistant_screen.dart';
import 'package:annsetu/features/authentication/auth_screens.dart';
import 'package:annsetu/features/tracking/live_track.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget app(Widget child) => MaterialApp(theme: AppTheme.light(), home: Scaffold(body: SingleChildScrollView(child: child)));

void main() {
  testWidgets('trip steps show all 5 delivery steps and the current one', (t) async {
    final r = FoodRequest.fromJson({'id': 'r1', 'listing_id': 'l1', 'ngo_org_id': 'n1', 'status': 'accepted', 'quantity': 10,
        'trip_status': 'on_the_way', 'created_at': '2026-11-20T08:00:00Z', 'trip_started_at': '2026-11-20T08:10:00Z'});
    await t.pumpWidget(app(TripSteps(r)));
    for (final s in ['Pickup confirmed', 'On the way', 'Reached donor', 'Food collected', 'Delivered']) {
      expect(find.text(s), findsOneWidget);
    }
    expect(r.inTransit, isTrue);
    final collected = FoodRequest.fromJson({'id': 'r2', 'listing_id': 'l', 'ngo_org_id': 'n', 'status': 'completed', 'quantity': 1, 'trip_status': 'collected'});
    final delivered = FoodRequest.fromJson({'id': 'r3', 'listing_id': 'l', 'ngo_org_id': 'n', 'status': 'completed', 'quantity': 1, 'trip_status': 'delivered'});
    expect(collected.inTransit, isTrue, reason: 'still on the way to the NGO');
    expect(delivered.inTransit, isFalse);
  });

  testWidgets('sign-up offers the Representative role', (t) async {
    await t.pumpWidget(MaterialApp(theme: AppTheme.light(), home: const RegisterScreen()));
    expect(find.text('Representative'), findsOneWidget);
    await t.ensureVisible(find.text('Representative'));
    await t.tap(find.text('Representative'));
    await t.pump();
    expect(find.textContaining('same email your NGO saved'), findsOneWidget);
  });

  testWidgets('assistant answers common questions instantly with clean bullets', (t) async {
    await t.pumpWidget(MaterialApp(theme: AppTheme.light(), home: const AssistantScreen()));
    await t.tap(find.text('How does the pickup OTP work?'));
    await t.pump();
    expect(find.textContaining('instant answer'), findsOneWidget);
    expect(find.textContaining('4-digit OTP', findRichText: true), findsOneWidget);
  });
}
