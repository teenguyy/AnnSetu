import 'dart:async';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import '../constants/env.dart';
import '../models/models.dart';
import 'session.dart';
import 'supabase_service.dart';

/// Notification records live in Supabase (`notifications`), written by the existing triggers/RPCs,
/// so the website and the app show the same list and read state.
///
/// Delivery on the phone:
///  * App open: realtime INSERT -> in-app banner (and the bell badge).
///  * App in background: a local Android notification from the same realtime event while the process lives.
///  * App closed: Firebase Cloud Messaging push from the `push` Edge Function, when Firebase is configured.
class NotificationService with WidgetsBindingObserver {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _local = FlutterLocalNotificationsPlugin();
  bool _foreground = true;
  bool _pushReady = false;
  StreamSubscription? _sub;
  void Function(String route)? onOpenRoute;

  static const _channel = AndroidNotificationChannel('annsetu_updates', 'AnnSetu updates',
      description: 'Requests, pickups, messages, verification and feedback replies', importance: Importance.high);

  Future<void> init() async {
    WidgetsBinding.instance.addObserver(this);
    if (!kIsWeb) {
      await _local.initialize(
        settings: const InitializationSettings(android: AndroidInitializationSettings('@drawable/ic_stat_annsetu')),
        onDidReceiveNotificationResponse: (r) => onOpenRoute?.call(r.payload ?? '/notifications'),
      );
      await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.createNotificationChannel(_channel);
    }
    _sub = AppSession.instance.newNotifications.listen(_onNew);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) => _foreground = state == AppLifecycleState.resumed;

  final _banner = StreamController<AppNotification>.broadcast();
  /// In-app banners for the shell to display while the app is in the foreground.
  Stream<AppNotification> get banners => _banner.stream;

  void _onNew(AppNotification n) {
    if (_foreground) {
      _banner.add(n);
    } else if (!kIsWeb && !_pushReady) {
      // With FCM configured the server push already shows it; avoid duplicates.
      _local.show(id: n.id.hashCode, title: n.title, body: n.body,
          notificationDetails: NotificationDetails(android: AndroidNotificationDetails(_channel.id, _channel.name,
              channelDescription: _channel.description, importance: Importance.high, priority: Priority.high, color: const Color(0xFF183A32))),
          payload: '/notifications');
    }
  }

  /// Asks for Android 13+ notification permission, then (optionally) registers for FCM push.
  Future<void> enableForSignedInUser() async {
    if (kIsWeb) return;
    await _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()?.requestNotificationsPermission();
    if (!Env.pushConfigured || _pushReady) return;
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: const FirebaseOptions(
            apiKey: Env.fbApiKey, appId: Env.fbAppId, messagingSenderId: Env.fbSenderId, projectId: Env.fbProjectId));
      }
      final fm = FirebaseMessaging.instance;
      await fm.requestPermission();
      // The database sends a push to these tokens (via the AnnSetu API, FCM HTTP v1) for every new notification.
      // ignore: deprecated_member_use
      final token = await fm.getToken();
      if (token != null) await db.rpc('register_device_token', params: {'p_token': token, 'p_platform': 'android'});
      // ignore: deprecated_member_use
      fm.onTokenRefresh.listen((t) => db.rpc('register_device_token', params: {'p_token': t, 'p_platform': 'android'}));
      FirebaseMessaging.onMessageOpenedApp.listen((m) => onOpenRoute?.call(m.data['route'] ?? '/notifications'));
      _pushReady = true;
    } catch (e) {
      debugPrint('Push not available: $e');
    }
  }

  /// Removes this phone's push token before sign-out, so the next account does not receive old pushes.
  Future<void> forgetDevice() async {
    if (!_pushReady) return;
    try {
      // ignore: deprecated_member_use
      final t = await FirebaseMessaging.instance.getToken();
      if (t != null) await db.from('device_tokens').delete().eq('token', t);
    } catch (_) {}
  }

  // ---- notification records ----
  static Future<List<AppNotification>> list() async {
    final uid = db.auth.currentUser!.id;
    final rows = await db.from('notifications').select().eq('user_id', uid).order('created_at', ascending: false).limit(50);
    return rows.map(AppNotification.fromJson).toList();
  }

  static Future<int> unreadCount() async {
    final uid = db.auth.currentUser?.id;
    if (uid == null) return 0;
    final rows = await db.from('notifications').select('id').eq('user_id', uid).eq('read', false).limit(100);
    return rows.length;
  }

  static Future<void> markAllRead() async {
    final uid = db.auth.currentUser!.id;
    await db.from('notifications').update({'read': true}).eq('user_id', uid).eq('read', false);
  }

  static Future<void> markRead(String id) => db.from('notifications').update({'read': true}).eq('id', id);

  void dispose() {
    _sub?.cancel();
    WidgetsBinding.instance.removeObserver(this);
  }
}
