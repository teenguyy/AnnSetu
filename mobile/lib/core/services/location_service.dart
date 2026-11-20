import 'package:flutter/foundation.dart';
import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'supabase_service.dart';

/// Live pickup location: the receiver's representative shares their position during an ACCEPTED pickup only.
/// The update_location RPC refuses any other case, and rep_locations rows are deleted when the pickup ends.
/// Only the two organisations in the request (and admins) can read it (RLS: loc_read).
class LocationService {
  static final Map<String, StreamSubscription<Position>> _active = {};
  static bool isSharing(String requestId) => _active.containsKey(requestId);

  /// Returns null on success or a human-readable reason it can't share.
  static Future<String?> ensurePermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return 'Turn on location services to share your position.';
    var p = await Geolocator.checkPermission();
    if (p == LocationPermission.denied) p = await Geolocator.requestPermission();
    if (p == LocationPermission.denied) return 'Location permission was denied.';
    if (p == LocationPermission.deniedForever) return 'Location is blocked for AnnSetu. Enable it in Android settings.';
    return null;
  }

  static Future<Position?> current() async {
    if (await ensurePermission() != null) return null;
    return Geolocator.getCurrentPosition(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 15)));
  }

  static Future<String?> start(String requestId, {void Function(DateTime at)? onSent, void Function(String error)? onError}) async {
    final denied = await ensurePermission();
    if (denied != null) return denied;
    var last = DateTime.fromMillisecondsSinceEpoch(0);
    // On Android a foreground service keeps sending the location while the app is in the background
    // or the screen is off (like delivery apps). A persistent notification shows while it runs.
    final settings = defaultTargetPlatform == TargetPlatform.android
        ? AndroidSettings(
            accuracy: LocationAccuracy.high, distanceFilter: 10, intervalDuration: const Duration(seconds: 5),
            foregroundNotificationConfig: const ForegroundNotificationConfig(
              notificationTitle: 'AnnSetu pickup in progress',
              notificationText: 'Sharing your live location with the donor and NGO until delivery.',
              notificationChannelName: 'Pickup tracking', enableWakeLock: true, setOngoing: true,
            ),
          )
        : const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10);
    _active[requestId] = Geolocator.getPositionStream(locationSettings: settings).listen((p) async {
      if (DateTime.now().difference(last).inSeconds < 5) return; // the RPC also throttles to 3 s
      last = DateTime.now();
      try {
        await db.rpc('update_location', params: {
          'p_request': requestId, 'p_lat': double.parse(p.latitude.toStringAsFixed(6)),
          'p_lng': double.parse(p.longitude.toStringAsFixed(6)), 'p_acc': p.accuracy.round(),
        });
        onSent?.call(DateTime.now());
      } catch (e) {
        stop(requestId);
        onError?.call(e.toString());
      }
    }, onError: (e) {
      stop(requestId);
      onError?.call('Location stopped: $e');
    });
    return null;
  }

  static void stop(String requestId) => _active.remove(requestId)?.cancel();
  static void stopAll() {
    for (final s in _active.values) {
      s.cancel();
    }
    _active.clear();
  }
}
