import 'dart:convert';
import 'dart:math' as math;
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/env.dart';
import '../models/models.dart';
import 'supabase_service.dart';

class RouteInfo {
  final List<LatLng> path;
  final int mins;
  final double km;
  final bool rough;
  const RouteInfo(this.path, this.mins, this.km, this.rough);
}

/// A pickup as the representative sees it (rpc rep_my_pickups).
class RepPickup {
  final Map<String, dynamic> j;
  RepPickup(this.j);
  String get id => j['request_id'];
  String get status => j['status'] ?? 'accepted';
  String get tripStatus => j['trip_status'] ?? 'assigned';
  String get title => j['listing_title'] ?? 'Pickup';
  int get quantity => (j['quantity'] as num?)?.toInt() ?? 0;
  String get unit => j['unit'] ?? '';
  String? get otp => j['otp'];
  String? get safetyNotes => j['safety_notes'];
  String? get photoPath => j['photo_path'];
  DateTime? _t(String k) => j[k] == null ? null : DateTime.tryParse(j[k].toString())?.toLocal();
  DateTime? get pickupBy => _t('pickup_by');
  String get donorName => j['donor_name'] ?? 'Donor';
  String? get donorPhone => j['donor_phone'];
  String? get donorAddress => j['donor_address'];
  LatLng? get donor => _pt(j['donor_lat'], j['donor_lng']);
  String get ngoName => j['ngo_name'] ?? 'NGO';
  String? get ngoPhone => j['ngo_phone'];
  String? get ngoAddress => j['ngo_address'];
  LatLng? get ngo => _pt(j['ngo_lat'], j['ngo_lng']);
  bool get inTransit => status == 'accepted' || (status == 'completed' && tripStatus == 'collected');
  /// The same fields as FoodRequest so the shared step widget can render it.
  FoodRequest asRequest() => FoodRequest.fromJson({
        'id': id, 'listing_id': '', 'ngo_org_id': '', 'status': status, 'quantity': quantity,
        'trip_status': tripStatus, 'eta': j['eta'], 'trip_started_at': j['trip_started_at'], 'arrived_at': j['arrived_at'],
        'collected_at': j['collected_at'], 'delivered_at': j['delivered_at'], 'trip_updated_at': j['trip_updated_at'], 'created_at': j['created_at'],
      });
}

LatLng? _pt(dynamic lat, dynamic lng) {
  final a = lat is num ? lat.toDouble() : double.tryParse('$lat');
  final b = lng is num ? lng.toDouble() : double.tryParse('$lng');
  return a == null || b == null ? null : LatLng(a, b);
}

LatLng? orgPoint(Organization? o) => o == null ? null : _pt(o.lat, o.lng);

double kmBetween(LatLng a, LatLng b) => const Distance().as(LengthUnit.Meter, a, b) / 1000;

/// Delivery-app style tracking on the same database functions as the website.
class TrackingService {
  /// Links this account to the NGO that saved its email as a representative. Returns {linked, name, org_name}.
  static Future<Map<String, dynamic>> linkRep() async {
    try {
      final r = await db.rpc('link_my_rep');
      return r is Map ? Map<String, dynamic>.from(r) : {'linked': false};
    } catch (_) {
      return {'linked': false};
    }
  }

  static Future<List<RepPickup>> repPickups() async {
    final rows = await db.rpc('rep_my_pickups');
    return (rows as List).map((e) => RepPickup(Map<String, dynamic>.from(e))).toList();
  }

  /// status: on_the_way | arrived | delivered. Notifies the donor and the NGO.
  static Future<void> setTrip(String requestId, String status, {DateTime? eta}) =>
      db.rpc('set_trip_status', params: {'p_request': requestId, 'p_status': status, 'p_eta': eta?.toUtc().toIso8601String()});

  static Future<RepLocation?> location(String requestId) async {
    final r = await db.from('rep_locations').select().eq('request_id', requestId).maybeSingle();
    return r == null ? null : RepLocation.fromJson(r);
  }

  static RealtimeChannel watchLocation(String requestId, void Function() onChange) => db
      .channel('loc-$requestId-${DateTime.now().millisecondsSinceEpoch}')
      .onPostgresChanges(
        event: PostgresChangeEvent.all, schema: 'public', table: 'rep_locations',
        filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'request_id', value: requestId),
        callback: (_) => onChange(),
      )
      .subscribe();

  /// Road route + travel time from OSRM (free). Falls back to a straight line at ~22 km/h.
  static Future<RouteInfo> route(LatLng from, LatLng to) async {
    try {
      final u = Uri.parse('${Env.osrm}${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson');
      final res = await http.get(u, headers: {'User-Agent': 'AnnSetu-App/1.0'}).timeout(const Duration(seconds: 8));
      final j = jsonDecode(res.body) as Map<String, dynamic>;
      final best = (j['routes'] as List).first as Map<String, dynamic>;
      final coords = (best['geometry']['coordinates'] as List).map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble())).toList();
      return RouteInfo(coords, math.max(1, ((best['duration'] as num) / 60).round()), (best['distance'] as num) / 1000, false);
    } catch (_) {
      final d = kmBetween(from, to);
      return RouteInfo([from, to], math.max(1, (d / 22 * 60).round()), d, true);
    }
  }
}
