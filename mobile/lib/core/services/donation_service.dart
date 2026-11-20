import 'dart:typed_data';
import '../models/models.dart';
import 'organization_service.dart';
import 'supabase_service.dart';

/// Food listings (donor side) and discovery (receiver side).
class DonationService {
  static Listing _withPhoto(Listing l) {
    l.photoUrl = Store.publicUrl(Store.listingPhotos, l.photoPath);
    return l;
  }

  static Future<List<Listing>> myListings(String orgId) async {
    final rows = await db.from('food_listings').select().eq('donor_org_id', orgId).order('created_at', ascending: false);
    return rows.map((r) => _withPhoto(Listing.fromJson(r))).toList();
  }

  static Future<void> create({
    required String orgId, required String title, required String category, required int quantity, required String unit,
    required DateTime preparedAt, required DateTime pickupBy, String? safetyNotes, Uint8List? photo, String? photoName,
  }) async {
    String? photoPath;
    if (photo != null && photoName != null) {
      photoPath = await Store.upload(Store.listingPhotos, photo, photoName, Store.contentTypeFor(photoName));
    }
    await db.from('food_listings').insert({
      'donor_org_id': orgId, 'title': title.trim(), 'category': category, 'quantity': quantity, 'unit': unit,
      'prepared_at': preparedAt.toUtc().toIso8601String(), 'pickup_by': pickupBy.toUtc().toIso8601String(),
      'safety_notes': (safetyNotes ?? '').trim().isEmpty ? null : safetyNotes!.trim(), 'photo_path': photoPath,
    });
  }

  /// RLS allows withdrawing only while nothing is reserved (same as the website).
  static Future<void> withdraw(String listingId) =>
      db.from('food_listings').update({'status': 'withdrawn'}).eq('id', listingId);

  /// Live listings for verified receivers. With a location it uses the PostGIS RPC (nearest first);
  /// otherwise the plain query the website uses. RLS decides what is visible.
  static Future<List<Listing>> discover({double? lat, double? lng, double radiusKm = 15, String? category}) async {
    if (lat != null && lng != null) {
      final rows = await db.rpc('nearby_listings', params: {'p_lat': lat, 'p_lng': lng, 'p_radius_km': radiusKm, 'p_category': category});
      return (rows as List).map((r) => _withPhoto(Listing.fromJson(Map<String, dynamic>.from(r)))).toList();
    }
    var q = db.from('food_listings').select().eq('status', 'active').gt('pickup_by', DateTime.now().toUtc().toIso8601String());
    if (category != null) q = q.eq('category', category);
    final rows = await q.order('pickup_by', ascending: true).limit(100);
    final list = rows.map((r) => _withPhoto(Listing.fromJson(r))).where((l) => l.qtyReserved < l.quantity).toList();
    final orgs = await OrganizationService.byIds(list.map((l) => l.donorOrgId));
    for (final l in list) {
      l.donorName = orgs[l.donorOrgId]?.name ?? 'Verified donor';
      l.donorAddress = orgs[l.donorOrgId]?.address;
    }
    return list;
  }

  static Future<Listing?> byId(String id) async {
    final r = await db.from('food_listings').select().eq('id', id).maybeSingle();
    if (r == null) return null;
    final l = _withPhoto(Listing.fromJson(r));
    final o = await OrganizationService.byIds([l.donorOrgId]);
    l.donorName = o[l.donorOrgId]?.name;
    l.donorAddress = o[l.donorOrgId]?.address;
    return l;
  }

  // ---- receiver needs (requirements) ----
  static Future<List<Requirement>> myNeeds(String orgId) async {
    final rows = await db.from('requirements').select().eq('ngo_org_id', orgId).order('created_at', ascending: false);
    return rows.map(Requirement.fromJson).toList();
  }

  /// Open needs published by verified receivers (donors see them on their home screen).
  static Future<List<Requirement>> openNeeds() async {
    final rows = await db.from('requirements').select().eq('status', 'open').gt('needed_by', DateTime.now().toUtc().toIso8601String()).order('needed_by').limit(20);
    final list = rows.map(Requirement.fromJson).toList();
    final orgs = await OrganizationService.byIds(list.map((n) => n.ngoOrgId));
    for (final n in list) {
      n.ngoName = orgs[n.ngoOrgId]?.name;
    }
    return list;
  }

  static Future<void> addNeed(String orgId, String title, int qty, DateTime neededBy) => db.from('requirements').insert(
      {'ngo_org_id': orgId, 'title': title.trim(), 'quantity': qty, 'needed_by': neededBy.toUtc().toIso8601String()});
  static Future<void> fulfilNeed(String id) => db.from('requirements').update({'status': 'fulfilled'}).eq('id', id);
  static Future<void> deleteNeed(String id) => db.from('requirements').delete().eq('id', id);
}
