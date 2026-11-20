import '../models/models.dart';
import 'organization_service.dart';
import 'supabase_service.dart';

/// The donation workflow. Every state change goes through the existing security-definer RPCs.
class RequestService {
  // ---- receiver ----
  static Future<String> create(String listingId, int qty, String repId) async =>
      (await db.rpc('create_request', params: {'p_listing': listingId, 'p_qty': qty, 'p_rep': repId})) as String;

  static Future<void> cancel(String requestId) => db.rpc('cancel_request', params: {'p_request': requestId});

  static Future<List<FoodRequest>> forReceiver(String orgId) async {
    final rows = await db.from('food_requests').select().eq('ngo_org_id', orgId).order('created_at', ascending: false);
    final reqs = rows.map(FoodRequest.fromJson).toList();
    final ids = reqs.map((r) => r.listingId).toSet().toList();
    final listings = ids.isEmpty ? <Listing>[] : (await db.from('food_listings').select().inFilter('id', ids)).map(Listing.fromJson).toList();
    final byId = {for (final l in listings) l.id: l};
    final donors = await OrganizationService.byIds(listings.map((l) => l.donorOrgId));
    for (final r in reqs) {
      r.listing = byId[r.listingId];
      if (r.listing != null) {
        r.listing!.photoUrl = Store.publicUrl(Store.listingPhotos, r.listing!.photoPath);
        r.donor = donors[r.listing!.donorOrgId];
      }
    }
    return reqs;
  }

  /// Only the receiver can read its OTP (RLS); donors get an empty map.
  static Future<Map<String, PickupOtp>> otps(List<String> acceptedIds) async {
    if (acceptedIds.isEmpty) return {};
    final rows = await db.from('pickup_otps').select('request_id,otp,expires_at').inFilter('request_id', acceptedIds);
    return {for (final r in rows) r['request_id'] as String: PickupOtp.fromJson(r)};
  }

  // ---- donor ----
  static Future<List<FoodRequest>> forDonor(List<Listing> myListings) async {
    if (myListings.isEmpty) return [];
    final byId = {for (final l in myListings) l.id: l};
    final rows = await db.from('food_requests').select().inFilter('listing_id', byId.keys.toList()).order('created_at', ascending: false);
    final reqs = rows.map(FoodRequest.fromJson).toList();
    final ngos = await OrganizationService.byIds(reqs.map((r) => r.ngoOrgId));
    for (final r in reqs) {
      r.listing = byId[r.listingId];
      r.ngo = ngos[r.ngoOrgId];
    }
    return reqs;
  }

  static Future<void> respond(String requestId, bool accept) =>
      db.rpc('respond_request', params: {'p_request': requestId, 'p_accept': accept});

  /// true = completed, false = wrong OTP (attempt counted). Locked/expired OTPs throw.
  static Future<bool> confirmPickup(String requestId, String otp) async =>
      (await db.rpc('confirm_pickup', params: {'p_request': requestId, 'p_otp': otp.trim()})) == true;

  static Future<Map<String, RepLocation>> locations(List<String> requestIds) async {
    if (requestIds.isEmpty) return {};
    final rows = await db.from('rep_locations').select().inFilter('request_id', requestIds);
    return {for (final r in rows) r['request_id'] as String: RepLocation.fromJson(r)};
  }

  // ---- both ----
  static Future<void> report({required String reporterOrg, required String reportedOrg, String? requestId, required String reason, String? details}) =>
      db.from('reports').insert({
        'reporter_org': reporterOrg, 'reported_org': reportedOrg, 'request_id': requestId, 'reason': reason,
        'details': (details ?? '').trim().isEmpty ? null : details!.trim(),
      });
}
