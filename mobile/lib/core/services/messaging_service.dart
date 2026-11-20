import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';
import 'supabase_service.dart';

/// Per-request chat between the donor and the receiver (table `messages`, RLS: parties only).
/// The `message_sent` trigger notifies the other side.
class MessagingService {
  /// Threads: donor_ngo, donor_rep, ngo_rep. Each is visible only to its two parties (database policy).
  static Future<List<ChatMessage>> load(String requestId, [String thread = 'donor_ngo']) async {
    final rows = await db.from('messages').select().eq('request_id', requestId).eq('thread', thread).order('created_at', ascending: true).limit(300);
    return rows.map(ChatMessage.fromJson).toList();
  }

  static Future<void> send(String requestId, String body, [String thread = 'donor_ngo']) =>
      db.from('messages').insert({'request_id': requestId, 'body': body.trim(), 'thread': thread});

  /// Live stream of new messages in one conversation. Cancel the returned subscription to clean up.
  static RealtimeChannel watch(String requestId, void Function() onNew) => db
      .channel('msg-$requestId')
      .onPostgresChanges(
        event: PostgresChangeEvent.insert, schema: 'public', table: 'messages',
        filter: PostgresChangeFilter(type: PostgresChangeFilterType.eq, column: 'request_id', value: requestId),
        callback: (_) => onNew(),
      )
      .subscribe();
}
