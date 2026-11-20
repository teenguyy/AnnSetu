import 'package:annsetu/core/constants/domain.dart';
import 'package:annsetu/core/models/models.dart';
import 'package:annsetu/core/utils/format.dart';
import 'package:annsetu/core/utils/impact.dart';
import 'package:annsetu/features/donations/create_listing_screen.dart' show validateListing;
import 'package:annsetu/features/feedback/feedback_screens.dart' show validateFeedback;
import 'package:flutter_test/flutter_test.dart';

Listing listing({String id = 'l1', String unit = 'portions', String category = 'Cooked meals', int qty = 40, int reserved = 0,
        String status = 'active', DateTime? by}) =>
    Listing.fromJson({
      'id': id, 'donor_org_id': 'd1', 'title': 'Biryani', 'category': category, 'unit': unit, 'status': status,
      'quantity': qty, 'qty_reserved': reserved, 'prepared_at': DateTime.now().subtract(const Duration(hours: 1)).toIso8601String(),
      'pickup_by': (by ?? DateTime.now().add(const Duration(hours: 3))).toIso8601String(),
    });

FoodRequest req(String status, int qty, {String ngo = 'n1', Listing? l, DateTime? completed}) {
  final r = FoodRequest.fromJson({
    'id': 'r$qty$status$ngo', 'listing_id': l?.id ?? 'l1', 'ngo_org_id': ngo, 'status': status, 'quantity': qty,
    'created_at': (completed ?? DateTime.now()).toIso8601String(), 'completed_at': completed?.toIso8601String(),
  });
  r.listing = l ?? listing();
  return r;
}

void main() {
  group('format', () {
    final now = DateTime(2026, 11, 18, 12);
    test('timeLeft matches the website wording', () {
      expect(timeLeft(now.add(const Duration(hours: 2, minutes: 5)), now: now), '2h 5m left');
      expect(timeLeft(now.add(const Duration(days: 2, hours: 1)), now: now), '2d left');
      expect(timeLeft(now.subtract(const Duration(minutes: 1)), now: now), 'expired');
    });
    test('ago', () {
      expect(ago(now, now: now), 'just now');
      expect(ago(now.subtract(const Duration(minutes: 5)), now: now), '5m ago');
      expect(ago(now.subtract(const Duration(hours: 3)), now: now), '3h ago');
      expect(ago(now.subtract(const Duration(days: 2)), now: now), '2d ago');
    });
    test('initials and safe file names', () {
      expect(initials('Spice Route Restaurant'), 'SR');
      expect(initials(''), 'A');
      expect(safeName('my photo (1).jpg'), 'my_photo__1_.jpg');
    });
    test('friendlyError maps database and auth errors like the website', () {
      expect(friendlyError(Exception('new row violates row-level security policy')), contains('permission'));
      expect(friendlyError('PostgrestException(message: duplicate key value violates unique constraint, code: 23505)'), contains('already exists'));
      expect(friendlyError('AuthException(message: Invalid login credentials, statusCode: 400)'), 'Incorrect email or password.');
      expect(friendlyError('ClientException: SocketException: Failed host lookup'), contains('Network problem'));
      expect(friendlyError(Exception('Choose a quantity between 1 and 40.')), 'Choose a quantity between 1 and 40.');
    });
  });

  group('validators', () {
    test('email, password, otp, phone, ranges', () {
      expect(V.emailAddr('a@b.org'), isNull);
      expect(V.emailAddr('nope'), isNotNull);
      expect(V.password('short'), isNotNull);
      expect(V.password('longenough'), isNull);
      expect(V.otp('1234'), isNull);
      expect(V.otp('12a4'), isNotNull);
      expect(V.otp('12345'), isNotNull);
      expect(V.phone('+91 98765 43210'), isNull);
      expect(V.phone('12'), isNotNull);
      expect(V.intRange('0', 1, 10, 'Quantity'), isNotNull);
      expect(V.intRange('7', 1, 10, 'Quantity'), isNull);
    });
    test('password strength meter (same scoring as the website)', () {
      expect(V.strength(''), 0);
      expect(V.strength('abcdefgh'), 1);
      expect(V.strength('Abcdefgh1'), 3);
      expect(V.strength('Abcdefg1!'), 4);
    });
    test('listing validation mirrors the database checks', () {
      final now = DateTime(2026, 11, 18, 12);
      final prep = now.subtract(const Duration(minutes: 30)), by = now.add(const Duration(hours: 3));
      expect(validateListing(title: 'Biryani', qty: 40, prepared: prep, pickupBy: by, now: now), isNull);
      expect(validateListing(title: 'B', qty: 40, prepared: prep, pickupBy: by, now: now), contains('name'));
      expect(validateListing(title: 'Biryani', qty: 0, prepared: prep, pickupBy: by, now: now), contains('Quantity'));
      expect(validateListing(title: 'Biryani', qty: 5, prepared: now.add(const Duration(minutes: 5)), pickupBy: by, now: now), contains('future'));
      expect(validateListing(title: 'Biryani', qty: 5, prepared: prep, pickupBy: now.subtract(const Duration(minutes: 1)), now: now), contains('Pickup time must be in the future'));
    });
    test('feedback validation mirrors the feedback table constraints', () {
      expect(validateFeedback(category: 'bug', subject: 'Upload fails', message: 'It fails every time on Android.'), isNull);
      expect(validateFeedback(category: 'weird', subject: 'Upload fails', message: 'It fails every time on Android.'), isNotNull);
      expect(validateFeedback(category: 'bug', subject: 'Up', message: 'It fails every time on Android.'), contains('Subject'));
      expect(validateFeedback(category: 'bug', subject: 'Upload fails', message: 'short'), contains('Message'));
      expect(validateFeedback(category: 'bug', subject: 'Upload fails', message: 'It fails every time.', rating: 6), contains('Rating'));
      expect(Domain.feedbackCategories.length, 7);
    });
  });

  group('models', () {
    test('listing availability and the website\'s expiry rule', () {
      expect(listing(qty: 40, reserved: 15).available, 25);
      expect(listing().requestable, isTrue);
      final old = listing(by: DateTime.now().subtract(const Duration(minutes: 1)));
      expect(old.effectiveStatus, 'expired');
      expect(old.requestable, isFalse);
      expect(listing(qty: 10, reserved: 10).requestable, isFalse);
    });
    test('organisation can act only when approved and not suspended', () {
      Organization o(String v, bool s) => Organization.fromJson({'id': 'o', 'owner_id': 'u', 'kind': 'ngo', 'org_type': 'NGO', 'name': 'Asha', 'verification': v, 'suspended': s});
      expect(o('approved', false).canAct, isTrue);
      expect(o('approved', true).canAct, isFalse);
      expect(o('pending', false).canAct, isFalse);
      expect(o('approved', true).statusLabel, 'suspended');
    });
    test('feedback item labels and unresolved state', () {
      final f = FeedbackItem.fromJson({'id': 'f', 'user_id': 'u', 'category': 'pickup', 'subject': 's', 'message': 'm', 'status': 'in_review', 'app_platform': 'android'});
      expect(f.categoryLabel, 'Pickup issue');
      expect(f.statusLabel, 'In review');
      expect(f.unresolved, isTrue);
    });
  });

  group('impact (real counts + labelled estimates)', () {
    final now = DateTime(2026, 11, 18, 12);
    final kgListing = listing(id: 'l2', unit: 'kg', category: 'Bakery');
    final reqs = [
      req('completed', 30, ngo: 'n1', completed: now.subtract(const Duration(days: 1))),
      req('completed', 10, ngo: 'n2', completed: now.subtract(const Duration(days: 9))),
      req('completed', 21, ngo: 'n2', l: kgListing, completed: now.subtract(const Duration(days: 2))),
      req('accepted', 99, ngo: 'n3'),
      req('cancelled', 50, ngo: 'n4'),
    ];
    final s = computeImpact(reqs, (r) => r.ngoOrgId, now: now);
    test('only completed (OTP-confirmed) pickups count', () {
      expect(s.completed, 3);
      expect(s.units, 61);
      expect(s.partners, 2);
      expect(s.portions, 40);
      expect(s.kg, 21);
    });
    test('meals estimate = portions + kg / 0.42, packs excluded', () {
      expect(s.estimatedMeals, 40 + (21 / 0.42).floor());
    });
    test('weekly series buckets pickups into the right weeks', () {
      expect(s.weekly.length, 8);
      expect(s.weekly.last.value, 2); // this week: yesterday + 2 days ago
      expect(s.weekly.fold<int>(0, (a, e) => a + e.value), 3);
    });
    test('category breakdown and badge progress', () {
      expect(s.byCategory, {'Cooked meals': 40, 'Bakery': 21});
      expect(badgeProgress(BadgeDef('x', 'donor', 'Regular giver', 'donations', 5), s), closeTo(.6, 1e-9));
      expect(badgeProgress(BadgeDef('y', 'donor', '100 units', 'units', 50), s), 1.0);
    });
    test('no data gives zero, not invented numbers', () {
      final e = computeImpact([], (r) => r.ngoOrgId, now: now);
      expect(e.hasData, isFalse);
      expect(e.estimatedMeals, 0);
    });
  });
}
