import 'package:flutter/material.dart';
import '../../core/constants/domain.dart';
import '../../core/models/models.dart';
import '../../core/services/feedback_service.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';
import '../feedback/feedback_screens.dart';

/// Admin feedback management: filter, review the sender, view screenshots, reply, change status.
class AdminFeedbackScreen extends StatefulWidget {
  const AdminFeedbackScreen({super.key});
  @override
  State<AdminFeedbackScreen> createState() => _AdminFeedbackScreenState();
}

class _AdminFeedbackScreenState extends State<AdminFeedbackScreen> {
  String? _cat;
  String? _status = 'unresolved';
  final _key = GlobalKey<LoaderState<List<FeedbackItem>>>();

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Feedback management')),
        body: Column(children: [
          SizedBox(height: 50, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
            for (final s in ['unresolved', 'open', 'in_review', 'resolved', 'closed', 'all'])
              Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                label: Text(s == 'all' ? 'All' : s == 'unresolved' ? 'Unresolved' : Domain.feedbackStatuses[s]!),
                selected: (_status ?? 'all') == s, onSelected: (_) => setState(() => _status = s == 'all' ? null : s))),
          ])),
          SizedBox(height: 50, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
            Padding(padding: const EdgeInsets.only(right: 8), child: FilterChip(label: const Text('Any category'), selected: _cat == null, onSelected: (_) => setState(() => _cat = null))),
            for (final e in Domain.feedbackCategories.entries)
              Padding(padding: const EdgeInsets.only(right: 8), child: FilterChip(avatar: Icon(feedbackIcons[e.key], size: 16), label: Text(e.value),
                  selected: _cat == e.key, onSelected: (_) => setState(() => _cat = _cat == e.key ? null : e.key))),
          ])),
          Expanded(child: Loader<List<FeedbackItem>>(
            key: _key, load: () => FeedbackService.all(),
            builder: (context, all, reload) {
              final unresolved = all.where((f) => f.unresolved).length;
              final complaints = all.where((f) => f.unresolved && const ['donation', 'pickup', 'account'].contains(f.category)).length;
              final xs = all.where((f) => (_cat == null || f.category == _cat) &&
                  (_status == null || (_status == 'unresolved' ? f.unresolved : f.status == _status))).toList();
              return RefreshIndicator(
                onRefresh: reload,
                child: ListView(padding: const EdgeInsets.fromLTRB(16, 4, 16, 32), children: [
                  Row(children: [
                    Expanded(child: StatCard(value: unresolved, label: 'Unresolved', icon: Icons.pending_actions_rounded, highlight: unresolved > 0)),
                    const SizedBox(width: 12),
                    Expanded(child: StatCard(value: complaints, label: 'Open complaints (account, donation, pickup)', icon: Icons.report_outlined)),
                  ]),
                  const SizedBox(height: 14),
                  if (xs.isEmpty) const EmptyState(icon: Icons.inbox_outlined, title: 'Nothing here', text: 'No feedback matches these filters.')
                  else for (final f in xs) Padding(padding: const EdgeInsets.only(bottom: 12),
                      child: FeedbackCard(f, showSender: true, onTap: () => _open(context, f, reload))),
                ]),
              );
            },
          )),
        ]),
      );

  void _open(BuildContext context, FeedbackItem f, Future<void> Function() reload) {
    final reply = TextEditingController(text: f.adminResponse);
    String status = f.status == 'open' ? 'in_review' : f.status;
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (c) => StatefulBuilder(builder: (c, set) {
        final t = Theme.of(c);
        return Padding(
          padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 24),
          child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            Row(children: [Expanded(child: Text(f.categoryLabel.toUpperCase(), style: t.textTheme.labelSmall)), StatusChip(f.status, label: f.statusLabel)]),
            Text(f.subject, style: t.textTheme.headlineSmall),
            const SizedBox(height: 8),
            Text(f.message),
            const SizedBox(height: 12),
            InfoRow(Icons.person_outline_rounded, '${f.senderName ?? 'User'} · ${roleLabel(roleFrom(f.senderRole) ?? Role.donor)}${f.orgName != null ? ' · ${f.orgName}' : ''}'),
            InfoRow(Icons.schedule_rounded, 'Sent ${fmtDT(f.createdAt)} from ${f.appPlatform}${f.appVersion != null ? ' ${f.appVersion}' : ''}'),
            if (f.rating != null) InfoRow(Icons.star_rounded, 'Rated ${f.rating} / 5'),
            if (f.screenshotPath != null) Padding(
              padding: const EdgeInsets.only(top: 12),
              child: FutureBuilder<String>(
                future: FeedbackService.screenshotUrl(f.screenshotPath!),
                builder: (c, s) => s.hasData
                    ? ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.network(s.data!, height: 220, width: double.infinity, fit: BoxFit.contain,
                        semanticLabel: 'Screenshot attached by the user', errorBuilder: (_, _, _) => const Text('Screenshot could not be loaded.')))
                    : s.hasError ? Text('Screenshot unavailable: ${friendlyError(s.error)}') : const LinearProgressIndicator(),
              ),
            ),
            const SizedBox(height: 18),
            DropdownButtonFormField<String>(
              initialValue: status, decoration: const InputDecoration(labelText: 'Status'),
              items: [for (final e in Domain.feedbackStatuses.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
              onChanged: (v) => set(() => status = v!),
            ),
            const SizedBox(height: 12),
            TextField(controller: reply, maxLength: 2000, minLines: 3, maxLines: 8,
                decoration: const InputDecoration(labelText: 'Reply to the user (optional)', alignLabelWithHint: true)),
            BusyButton(expand: true, icon: Icons.send_rounded, onPressed: () async {
              await FeedbackService.respond(f.id, status, reply.text.trim().isEmpty ? null : reply.text.trim());
              if (!c.mounted) return;
              Navigator.pop(c);
              showOk(context, 'Saved. The user has been notified.');
              await reload();
            }, child: const Text('Save & notify user')),
          ])),
        );
      }),
    );
  }
}
