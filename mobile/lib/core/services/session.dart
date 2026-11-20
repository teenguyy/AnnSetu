import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/domain.dart';
import '../models/models.dart';
import 'organization_service.dart';
import 'supabase_service.dart';

enum SessionStatus { loading, signedOut, ready, error }

/// App-wide auth + identity state. The router redirects from this, screens read it.
class AppSession extends ChangeNotifier {
  AppSession._();
  static final AppSession instance = AppSession._();

  SessionStatus status = SessionStatus.loading;
  User? user;
  Profile? profile;
  Organization? org;
  String? error;
  bool recoveringPassword = false;

  /// Bumped whenever shared data may have changed (realtime event, poll, or a local write),
  /// so any open screen reloads from the database. This is what keeps the app in step with the website.
  final ValueNotifier<int> dataTick = ValueNotifier(0);
  void touch() => dataTick.value++;

  StreamSubscription<AuthState>? _authSub;
  RealtimeChannel? _channel;
  Timer? _poll;
  final _notificationCtrl = StreamController<AppNotification>.broadcast();
  /// New notification rows for the signed-in user, as they are inserted (any client, any trigger).
  Stream<AppNotification> get newNotifications => _notificationCtrl.stream;

  Role? get role => profile?.role;
  bool get isAdmin => role == Role.admin;

  static const _pendingRoleKey = 'annsetu.pending_role';
  static Future<void> rememberRoleForOAuth(Role r) async =>
      (await SharedPreferences.getInstance()).setString(_pendingRoleKey, r.name);

  Future<void> start() async {
    _authSub = db.auth.onAuthStateChange.listen((s) async {
      if (s.event == AuthChangeEvent.passwordRecovery) {
        recoveringPassword = true;
        notifyListeners();
      }
      if (s.event == AuthChangeEvent.signedOut) {
        _clear();
      } else if (s.event == AuthChangeEvent.signedIn || s.event == AuthChangeEvent.initialSession || s.event == AuthChangeEvent.userUpdated) {
        if (s.session != null && (user?.id != s.session!.user.id || status != SessionStatus.ready)) await load();
      }
    });
    if (db.auth.currentSession == null) {
      status = SessionStatus.signedOut;
      notifyListeners();
    } else {
      await load();
    }
  }

  Future<void> load() async {
    final u = db.auth.currentUser;
    if (u == null) return _clear();
    try {
      user = u;
      final p = await db.from('profiles').select('id,role,full_name').eq('id', u.id).maybeSingle();
      if (p == null) throw Exception('Your profile isn’t ready yet. Please sign in again.');
      profile = Profile.fromJson(p);
      await _applyPendingRole();
      // Representatives: link this account to the NGO that saved its email (same as the website).
      if (profile!.role != Role.admin) {
        try {
          final r = await db.rpc('link_my_rep');
          if (r is Map && r['linked'] == true && profile!.role != Role.rep) {
            final p2 = await db.from('profiles').select('id,role,full_name').eq('id', u.id).single();
            profile = Profile.fromJson(p2);
          }
        } catch (_) {/* not a representative */}
      }
      org = await OrganizationService.mine();
      status = SessionStatus.ready;
      error = null;
      _listen();
    } catch (e) {
      status = SessionStatus.error;
      error = e.toString();
    }
    notifyListeners();
  }

  /// Google sign-ups choose Donor/Receiver before the redirect (same rule as the website):
  /// applied only while the account has no organisation; admins are never changed.
  Future<void> _applyPendingRole() async {
    final prefs = await SharedPreferences.getInstance();
    final pick = prefs.getString(_pendingRoleKey);
    if (pick == null) return;
    await prefs.remove(_pendingRoleKey);
    if (profile!.role == Role.admin || profile!.role?.name == pick) return;
    try {
      await db.rpc('set_my_role', params: {'p_role': pick});
      final p = await db.from('profiles').select('id,role,full_name').eq('id', user!.id).single();
      profile = Profile.fromJson(p);
    } catch (_) {/* role is locked once an organisation exists */}
  }

  Future<void> refreshOrg() async {
    org = await OrganizationService.mine();
    notifyListeners();
    touch();
  }

  void _listen() {
    _channel?.unsubscribe();
    final uid = user!.id;
    void bump(PostgresChangePayload _) => touch();
    _channel = db
        .channel('annsetu-app-$uid')
        .onPostgresChanges(
          event: PostgresChangeEvent.insert, schema: 'public', table: 'notifications',
          filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'user_id', value: uid),
          callback: (p) {
            try { _notificationCtrl.add(AppNotification.fromJson(p.newRecord)); } catch (_) {}
            touch();
            // Verification / suspension decisions arrive as notifications: refresh the organisation.
            final t = (p.newRecord['title'] ?? '').toString();
            if (RegExp('verified|Verification|suspended|reinstated|Document', caseSensitive: false).hasMatch(t)) refreshOrg();
          })
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'food_requests', callback: bump)
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'food_listings', callback: bump)
        .onPostgresChanges(event: PostgresChangeEvent.all, schema: 'public', table: 'rep_locations', callback: bump)
        .subscribe();
    _poll?.cancel();
    _poll = Timer.periodic(const Duration(seconds: 45), (_) => touch()); // same fallback as the website
  }

  Future<void> signOut() async {
    await db.auth.signOut();
    _clear();
  }

  void _clear() {
    _channel?.unsubscribe();
    _channel = null;
    _poll?.cancel();
    user = null;
    profile = null;
    org = null;
    recoveringPassword = false;
    status = SessionStatus.signedOut;
    notifyListeners();
  }

  @override
  void dispose() {
    _authSub?.cancel();
    _channel?.unsubscribe();
    _poll?.cancel();
    _notificationCtrl.close();
    super.dispose();
  }
}
