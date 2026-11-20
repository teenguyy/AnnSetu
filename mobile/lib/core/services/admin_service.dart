import '../models/models.dart';
import 'supabase_service.dart';

/// Administrator operations. Every call is protected server-side by is_admin() checks and RLS;
/// the app only hides screens from non-admins for convenience, it never relies on that for security.
class AdminData {
  final List<Organization> orgs;
  final List<VerificationDoc> docs;
  final List<Listing> listings;
  final List<FoodRequest> requests;
  final List<Report> reports;
  final List<ContactMessage> contacts;
  final List<Faq> faqs;
  final List<Testimonial> testimonials;
  final List<AuditEntry> audit;
  final Map<String, Map<String, dynamic>> profiles;
  final PlatformImpact? impact;
  AdminData(this.orgs, this.docs, this.listings, this.requests, this.reports, this.contacts, this.faqs, this.testimonials, this.audit, this.profiles, this.impact);
  late final Map<String, Organization> orgById = {for (final o in orgs) o.id: o};
  String orgName(String? id) => orgById[id]?.name ?? '(removed)';
}

class AdminService {
  static Future<AdminData> load() async {
    final r = await Future.wait([
      db.from('organizations').select().order('created_at', ascending: false),
      db.from('verification_documents').select().order('created_at', ascending: false),
      db.from('food_listings').select().order('created_at', ascending: false).limit(500),
      db.from('food_requests').select().order('created_at', ascending: false).limit(500),
      db.from('reports').select().order('created_at', ascending: false),
      db.from('contact_messages').select().order('created_at', ascending: false).limit(100),
      db.from('faqs').select().order('sort_order'),
      db.from('testimonials').select().order('created_at', ascending: false),
      db.from('audit_log').select().order('created_at', ascending: false).limit(150),
      db.from('profiles').select('id,full_name,role'),
    ]);
    PlatformImpact? impact;
    try {
      final p = await db.rpc('public_impact');
      if (p is List && p.isNotEmpty) impact = PlatformImpact.fromJson(Map<String, dynamic>.from(p.first));
    } catch (_) {}
    final orgs = r[0].map(Organization.fromJson).toList();
    for (final o in orgs) {
      o.logoUrl = Store.publicUrl(Store.orgLogos, o.logoPath);
    }
    final listings = r[2].map(Listing.fromJson).toList();
    final byL = {for (final l in listings) l.id: l};
    final reqs = r[3].map(FoodRequest.fromJson).toList();
    for (final q in reqs) {
      q.listing = byL[q.listingId];
    }
    return AdminData(orgs, r[1].map(VerificationDoc.fromJson).toList(), listings, reqs, r[4].map(Report.fromJson).toList(),
        r[5].map(ContactMessage.fromJson).toList(), r[6].map(Faq.fromJson).toList(), r[7].map(Testimonial.fromJson).toList(),
        r[8].map(AuditEntry.fromJson).toList(), {for (final p in r[9]) p['id'] as String: p}, impact);
  }

  static Future<void> reviewDocument(String docId, bool approve, [String? note]) =>
      db.rpc('review_document', params: {'p_doc': docId, 'p_status': approve ? 'approved' : 'rejected', 'p_note': note});
  static Future<void> reviewOrg(String orgId, bool approve, [String? note]) =>
      db.rpc('review_org', params: {'p_org': orgId, 'p_approve': approve, 'p_note': note});
  static Future<void> suspend(String orgId, bool suspend, [String? reason]) =>
      db.rpc('suspend_org', params: {'p_org': orgId, 'p_suspend': suspend, 'p_reason': reason});
  static Future<void> withdrawListing(String listingId, String reason) =>
      db.rpc('admin_withdraw_listing', params: {'p_listing': listingId, 'p_reason': reason});
  static Future<void> resolveReport(String id, String status, String? note, {bool suspend = false}) =>
      db.rpc('resolve_report', params: {'p_report': id, 'p_status': status, 'p_note': note, 'p_suspend': suspend});
  static Future<int> announce(String title, String body, String audience) async =>
      ((await db.rpc('admin_announce', params: {'p_title': title, 'p_body': body, 'p_audience': audience})) as num).toInt();
  static Future<String> docUrl(String path) => Store.signedUrl(Store.verificationDocs, path);

  static Future<void> setContactStatus(String id, String status) => db.from('contact_messages').update({'status': status}).eq('id', id);
  static Future<void> addFaq(String q, String a, int order) => db.from('faqs').insert({'question': q.trim(), 'answer': a.trim(), 'sort_order': order});
  static Future<void> setFaqPublished(String id, bool v) => db.from('faqs').update({'published': v}).eq('id', id);
  static Future<void> deleteFaq(String id) => db.from('faqs').delete().eq('id', id);
  static Future<void> addTestimonial(String quote, String author, String? role) =>
      db.from('testimonials').insert({'quote': quote.trim(), 'author_name': author.trim(), 'author_role': (role ?? '').trim().isEmpty ? null : role!.trim()});
  static Future<void> setTestimonialPublished(String id, bool v) => db.from('testimonials').update({'published': v}).eq('id', id);
  static Future<void> deleteTestimonial(String id) => db.from('testimonials').delete().eq('id', id);
}
