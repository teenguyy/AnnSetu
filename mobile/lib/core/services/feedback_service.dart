import 'package:flutter/foundation.dart';
import '../models/models.dart';
import 'supabase_service.dart';

/// Feedback & support (table `feedback`, migration part 6). Users see their own; admins see all
/// and respond through the audited `respond_feedback` RPC, which notifies the user.
class FeedbackService {
  static Future<void> submit({
    required String category, required String subject, required String message, int? rating, String? orgId,
    Uint8List? screenshot, String? screenshotName, String? appVersion,
  }) async {
    String? path;
    if (screenshot != null && screenshotName != null) {
      path = await Store.upload(Store.feedbackShots, screenshot, screenshotName, Store.contentTypeFor(screenshotName));
    }
    await db.from('feedback').insert({
      'category': category, 'subject': subject.trim(), 'message': message.trim(), 'rating': rating, 'org_id': orgId,
      'screenshot_path': path, 'app_platform': kIsWeb ? 'web' : 'android', 'app_version': appVersion,
    });
  }

  static Future<List<FeedbackItem>> mine() async {
    final uid = db.auth.currentUser!.id;
    final rows = await db.from('feedback').select().eq('user_id', uid).order('created_at', ascending: false);
    return rows.map(FeedbackItem.fromJson).toList();
  }

  /// Admin view with sender details (profiles + organisation names are readable by admins).
  static Future<List<FeedbackItem>> all({String? category, String? status}) async {
    var q = db.from('feedback').select();
    if (category != null) q = q.eq('category', category);
    if (status != null) q = q.eq('status', status);
    final rows = await q.order('created_at', ascending: false).limit(300);
    final items = rows.map(FeedbackItem.fromJson).toList();
    final uids = items.map((f) => f.userId).toSet().toList();
    final oids = items.map((f) => f.orgId).whereType<String>().toSet().toList();
    final profiles = uids.isEmpty ? [] : await db.from('profiles').select('id,full_name,role').inFilter('id', uids);
    final orgs = oids.isEmpty ? [] : await db.from('organizations').select('id,name').inFilter('id', oids);
    final p = {for (final r in profiles) r['id']: r};
    final o = {for (final r in orgs) r['id']: r['name']};
    for (final f in items) {
      f.senderName = p[f.userId]?['full_name'];
      f.senderRole = p[f.userId]?['role'];
      f.orgName = o[f.orgId];
    }
    return items;
  }

  static Future<void> respond(String id, String status, String? response) =>
      db.rpc('respond_feedback', params: {'p_feedback': id, 'p_status': status, 'p_response': response});

  static Future<String> screenshotUrl(String path) => Store.signedUrl(Store.feedbackShots, path);
}
