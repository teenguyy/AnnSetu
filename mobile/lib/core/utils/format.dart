import 'package:intl/intl.dart';

final _dt = DateFormat('d MMM yyyy, h:mm a');
final _d = DateFormat('d MMM yyyy');
final _t = DateFormat('h:mm a');

String fmtDT(DateTime? d) => d == null ? '' : _dt.format(d.toLocal());
String fmtD(DateTime? d) => d == null ? '' : _d.format(d.toLocal());
String fmtT(DateTime? d) => d == null ? '' : _t.format(d.toLocal());
String fmtNum(num n) => NumberFormat.decimalPattern('en_IN').format(n);

String ago(DateTime d, {DateTime? now}) {
  final m = (now ?? DateTime.now()).difference(d).inMinutes;
  if (m < 1) return 'just now';
  if (m < 60) return '${m}m ago';
  if (m < 1440) return '${m ~/ 60}h ago';
  return '${m ~/ 1440}d ago';
}

/// Time left until a pickup deadline (same wording as the website).
String timeLeft(DateTime by, {DateTime? now}) {
  final ms = by.difference(now ?? DateTime.now());
  if (ms.inSeconds <= 0) return 'expired';
  final h = ms.inHours;
  return h >= 24 ? '${h ~/ 24}d left' : '${h}h ${ms.inMinutes % 60}m left';
}

String initials(String? n) {
  final w = (n ?? '').trim().split(RegExp(r'\s+')).where((x) => x.isNotEmpty).take(2).map((x) => x[0]).join();
  return (w.isEmpty ? 'A' : w).toUpperCase();
}

String safeName(String n) => n.replaceAll(RegExp(r'[^a-zA-Z0-9._-]'), '_');

/// Turns database / auth errors into friendly messages (port of errMsg() in website/src/lib.js).
String friendlyError(Object? e) {
  var m = e?.toString() ?? 'Something went wrong';
  final match = RegExp(r'message: ([^,)]+)').firstMatch(m);
  if (match != null) m = match.group(1)!.trim();
  m = m.replaceFirst(RegExp(r'^(Exception|AuthException|PostgrestException|StorageException)[:(]\s*'), '');
  if (RegExp('row-level security|permission denied', caseSensitive: false).hasMatch(m)) {
    return 'You don’t have permission for that. Is your organisation verified and active?';
  }
  if (RegExp('duplicate key|already exists', caseSensitive: false).hasMatch(m)) {
    return 'That already exists, for example a pending request for the same listing.';
  }
  if (RegExp('Invalid login credentials', caseSensitive: false).hasMatch(m)) return 'Incorrect email or password.';
  if (RegExp('Email not confirmed', caseSensitive: false).hasMatch(m)) return 'Please confirm your email first. Check your inbox for the link.';
  if (RegExp('User already registered', caseSensitive: false).hasMatch(m)) return 'An account with this email already exists. Try signing in.';
  if (RegExp('SocketException|Failed host lookup|ClientException|Network', caseSensitive: false).hasMatch(m)) {
    return 'Network problem. Please check your connection and try again.';
  }
  return m;
}

/// Validators shared by every form. Return null when valid.
class V {
  static final email = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');
  static String? required(String? v, [String what = 'This field']) => (v == null || v.trim().isEmpty) ? '$what is required.' : null;
  static String? emailAddr(String? v) => (v == null || !email.hasMatch(v.trim())) ? 'Enter a valid email address.' : null;
  static String? password(String? v) => (v == null || v.length < 8) ? 'Use at least 8 characters.' : null;
  static String? minLen(String? v, int n, String what) => (v == null || v.trim().length < n) ? '$what must be at least $n characters.' : null;
  static String? intRange(String? v, int min, int max, String what) {
    final n = int.tryParse((v ?? '').trim());
    if (n == null || n < min || n > max) return '$what must be between $min and $max.';
    return null;
  }

  static String? phone(String? v) {
    final d = (v ?? '').replaceAll(RegExp(r'[^0-9+]'), '');
    return d.length < 6 ? 'Enter a valid phone number.' : null;
  }

  static String? otp(String? v) => RegExp(r'^\d{4}$').hasMatch((v ?? '').trim()) ? null : 'Enter the 4-digit OTP.';

  /// Password strength 0-4 (same scoring as the website's meter).
  static int strength(String v) {
    var s = 0;
    if (v.length >= 8) s++;
    if (RegExp('[A-Z]').hasMatch(v) && RegExp('[a-z]').hasMatch(v)) s++;
    if (RegExp(r'\d').hasMatch(v)) s++;
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(v) && v.length >= 8) s++;
    return s;
  }
}
