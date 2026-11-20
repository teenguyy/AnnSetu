import 'dart:convert';
import 'package:http/http.dart' as http;
import '../constants/env.dart';
import 'dart:typed_data';
import '../constants/domain.dart';
import '../models/models.dart';
import 'supabase_service.dart';

/// Organisation profile, verification documents and pickup representatives.
class OrganizationService {
  static Future<Organization?> mine() async {
    final uid = db.auth.currentUser?.id;
    if (uid == null) return null;
    final row = await db.from('organizations').select().eq('owner_id', uid).maybeSingle();
    if (row == null) return null;
    final o = Organization.fromJson(row);
    o.logoUrl = Store.publicUrl(Store.orgLogos, o.logoPath);
    return o;
  }

  static Future<Map<String, Organization>> byIds(Iterable<String> ids) async {
    final list = ids.where((x) => x.isNotEmpty).toSet().toList();
    if (list.isEmpty) return {};
    final rows = await db.from('organizations').select('id,owner_id,kind,org_type,name,phone,address,lat,lng,logo_path,verification,suspended').inFilter('id', list);
    return {for (final r in rows) r['id'] as String: Organization.fromJson(r)};
  }

  /// Insert or update the caller's organisation (only granted columns, as on the website).
  static Future<void> save({
    required Role role, Organization? existing, required String name, required String type, String? phone,
    String? address, String? about, String? area, double? lat, double? lng, String? logoPath,
  }) async {
    String? n(String? v) => (v == null || v.trim().isEmpty) ? null : v.trim();
    final row = <String, dynamic>{
      'org_type': type, 'name': name.trim(), 'phone': n(phone), 'address': n(address), 'about': n(about),
      'area_served': role == Role.ngo ? n(area) : null, 'lat': lat, 'lng': lng,
      'logo_path': ?logoPath,
    };
    if (existing != null) {
      await db.from('organizations').update(row).eq('id', existing.id);
    } else {
      await db.from('organizations').insert({'owner_id': db.auth.currentUser!.id, 'kind': role.name, ...row});
    }
  }

  static Future<String> uploadLogo(Uint8List bytes, String name) =>
      Store.upload(Store.orgLogos, bytes, name, Store.contentTypeFor(name));

  static Future<List<VerificationDoc>> docs(String orgId) async {
    final rows = await db.from('verification_documents').select().eq('org_id', orgId).order('created_at', ascending: false);
    return rows.map(VerificationDoc.fromJson).toList();
  }

  static Future<void> uploadDoc(String orgId, String docType, Uint8List bytes, String name) async {
    final path = await Store.upload(Store.verificationDocs, bytes, name, Store.contentTypeFor(name), sub: '$orgId/');
    final row = await db.from('verification_documents').insert({'org_id': orgId, 'path': path, 'doc_type': docType}).select('id').single();
    // The AI reads and checks the document straight away, so the admin's summary is ready (fire and forget).
    final token = db.auth.currentSession?.accessToken;
    if (token != null) {
      http.post(Uri.parse('${Env.apiBase}/ai/auto-review'), headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'},
          body: jsonEncode({'document_id': row['id']})).ignore();
    }
  }

  /// "We don't have a registration certificate": ask an admin for manual review (3-5 business days).
  static Future<void> requestNoCertificate(String orgId, String note) =>
      db.from('organizations').update({'no_certificate': true, 'no_certificate_note': note.trim()}).eq('id', orgId);
  static Future<void> withdrawNoCertificate(String orgId) =>
      db.from('organizations').update({'no_certificate': false}).eq('id', orgId);

  static Future<void> deleteDoc(String id) => db.from('verification_documents').delete().eq('id', id);

  static Future<List<Representative>> reps(String orgId) async {
    final rows = await db.from('representatives').select().eq('org_id', orgId).order('name');
    return rows.map(Representative.fromJson).toList();
  }

  static Future<void> addRep(String orgId, String name, String phone) =>
      db.from('representatives').insert({'org_id': orgId, 'name': name.trim(), 'phone': phone.trim()});

  static Future<void> deleteRep(String id) => db.from('representatives').delete().eq('id', id);
}
