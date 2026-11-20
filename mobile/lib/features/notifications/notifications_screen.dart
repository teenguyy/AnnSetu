import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/services/notification_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';

IconData _iconFor(String title) {
  final t = title.toLowerCase();
  if (t.contains('message')) return Icons.chat_bubble_rounded;
  if (t.contains('request')) return Icons.inbox_rounded;
  if (t.contains('pickup')) return Icons.local_shipping_rounded;
  if (t.contains('verif') || t.contains('document')) return Icons.verified_user_rounded;
  if (t.contains('badge')) return Icons.workspace_premium_rounded;
  if (t.contains('feedback')) return Icons.support_agent_rounded;
  if (t.contains('announcement')) return Icons.campaign_rounded;
  if (t.contains('suspend') || t.contains('report')) return Icons.gpp_maybe_rounded;
  return Icons.notifications_rounded;
}

/// Same `notifications` rows as the website's bell, including read state.
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});
  @override
  Widget build(BuildContext context) => Loader<List<AppNotification>>(
        load: NotificationService.list,
        loading: Scaffold(appBar: AppBar(title: const Text('Notifications')), body: const SizedBox()),
        builder: (context, list, reload) {
          final unread = list.where((n) => !n.read).length;
          final t = Theme.of(context);
          return Scaffold(
            appBar: AppBar(title: const Text('Notifications'), actions: [
              if (unread > 0) TextButton.icon(onPressed: () => guard(context, () async { await NotificationService.markAllRead(); await reload(); }),
                  icon: const Icon(Icons.done_all_rounded, size: 18), label: const Text('Mark all read')),
            ]),
            body: RefreshIndicator(
              onRefresh: reload,
              child: list.isEmpty
                  ? ListView(children: const [EmptyState(icon: Icons.notifications_none_rounded, title: 'You’re all caught up', text: 'Requests, pickups, messages and verification updates will appear here.')])
                  : ListView.separated(
                      itemCount: list.length,
                      separatorBuilder: (_, _) => const Divider(indent: 72),
                      itemBuilder: (_, i) {
                        final n = list[i];
                        return ListTile(
                          tileColor: n.read ? null : (t.brightness == Brightness.dark ? Brand.gold.withValues(alpha: .07) : Brand.gold.withValues(alpha: .1)),
                          leading: CircleAvatar(backgroundColor: Brand.forest, child: Icon(_iconFor(n.title), color: Brand.gold, size: 20)),
                          title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.w500 : FontWeight.w700)),
                          subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            if ((n.body ?? '').isNotEmpty) Text(n.body!),
                            const SizedBox(height: 2),
                            Text(ago(n.createdAt), style: t.textTheme.bodySmall),
                          ]),
                          isThreeLine: (n.body ?? '').isNotEmpty,
                          onTap: n.read ? null : () async { await NotificationService.markRead(n.id); await reload(); },
                        );
                      },
                    ),
            ),
          );
        },
      );
}
