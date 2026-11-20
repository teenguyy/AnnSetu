import '../models/models.dart';
import 'supabase_service.dart';

/// Badges, certificates and the leaderboard (same tables/RPCs as the website's Impact tab).
class ImpactData {
  final List<BadgeDef> defs;
  final Set<String> earned;
  final List<Certificate> certificates;
  final List<LeaderRow> board;
  ImpactData(this.defs, this.earned, this.certificates, this.board);
}

class ImpactService {
  static Future<ImpactData> load(String orgId, String kind) async {
    final r = await Future.wait<dynamic>([
      db.from('badge_definitions').select().eq('applies_to', kind).order('threshold'),
      db.from('org_badges').select('badge_code').eq('org_id', orgId),
      db.from('certificates').select().eq('org_id', orgId).order('issued_at', ascending: false),
      db.rpc('public_leaderboard', params: {'p_kind': kind}), // public top-% leaderboard, same as the website
    ]);
    return ImpactData(
      (r[0] as List).map((x) => BadgeDef.fromJson(Map<String, dynamic>.from(x))).toList(),
      (r[1] as List).map((x) => x['badge_code'] as String).toSet(),
      (r[2] as List).map((x) => Certificate.fromJson(Map<String, dynamic>.from(x))).toList(),
      (r[3] as List).map((x) => LeaderRow.fromJson(Map<String, dynamic>.from(x))).toList(),
    );
  }

  static Future<PlatformImpact?> platform() async {
    final p = await db.rpc('public_impact');
    return (p is List && p.isNotEmpty) ? PlatformImpact.fromJson(Map<String, dynamic>.from(p.first)) : null;
  }

  static Future<Map<String, dynamic>?> verifyCertificate(String serial) async {
    final rows = await db.rpc('verify_certificate', params: {'p_serial': serial.trim()});
    return (rows is List && rows.isNotEmpty) ? Map<String, dynamic>.from(rows.first) : null;
  }
}
