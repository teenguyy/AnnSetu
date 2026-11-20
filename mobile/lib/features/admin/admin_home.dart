import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/models/models.dart';
import '../../core/services/admin_service.dart';
import '../../core/services/feedback_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';
import '../shell/role_shell.dart';

class _Overview {
  final AdminData d;
  final int unresolvedFeedback;
  _Overview(this.d, this.unresolvedFeedback);
}

class AdminHome extends StatelessWidget {
  const AdminHome({super.key});
  static Future<_Overview> _load() async {
    final d = await AdminService.load();
    var fb = 0;
    try { fb = (await FeedbackService.all()).where((f) => f.unresolved).length; } catch (_) {}
    return _Overview(d, fb);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TabAppBar(title: 'Admin console'),
        body: Loader<_Overview>(
          load: _load,
          builder: (context, o, reload) {
            final d = o.d;
            final pend = d.orgs.where((x) => x.verification == 'pending').length;
            final openRep = d.reports.where((r) => const ['open', 'reviewing'].contains(r.status)).length;
            final newMsgs = d.contacts.where((c) => c.status == 'new').length;
            final done = d.requests.where((r) => r.status == 'completed').toList();
            final activeL = d.listings.where((l) => l.status == 'active' && l.pickupBy.isAfter(DateTime.now())).length;
            final t = Theme.of(context);
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(22),
                        gradient: const LinearGradient(colors: [Brand.forest, Brand.dark], begin: Alignment.topLeft, end: Alignment.bottomRight)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('ADMIN CONSOLE', style: TextStyle(color: Brand.gold, letterSpacing: 1.6, fontWeight: FontWeight.w700, fontSize: 11.5)),
                      const SizedBox(height: 8),
                      const Text('Keeping AnnSetu trusted', style: TextStyle(fontFamily: serif, color: Brand.cream, fontSize: 28, height: 1.1)),
                      const SizedBox(height: 8),
                      Text('Verify organisations, watch the platform and keep food moving safely.', style: TextStyle(color: Brand.cream.withValues(alpha: .8))),
                    ]),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: LayoutBuilder(builder: (c, box) {
                    final w = (box.maxWidth - 12) / 2;
                    return Wrap(spacing: 12, runSpacing: 12, children: [
                      for (final s in [
                        StatCard(value: pend, label: 'Awaiting verification', icon: Icons.verified_user_rounded, highlight: pend > 0),
                        StatCard(value: d.orgs.where((x) => x.isApproved).length, label: 'Verified organisations', icon: Icons.groups_rounded),
                        StatCard(value: activeL, label: 'Active listings', icon: Icons.inventory_2_rounded),
                        StatCard(value: done.length, label: 'Completed pickups', icon: Icons.volunteer_activism_rounded),
                        StatCard(value: done.fold<int>(0, (a, r) => a + r.quantity), label: 'Units redistributed', icon: Icons.trending_up_rounded),
                        StatCard(value: d.orgs.length, label: 'Participating organisations', icon: Icons.apartment_rounded),
                      ]) SizedBox(width: w, child: s),
                    ]);
                  }),
                ),
                const SectionTitle('Needs attention'),
                _todo(context, Icons.verified_user_outlined, '$pend organisation${pend == 1 ? '' : 's'} waiting', 'They can’t list or request food until verified.', pend > 0, () => RoleShell.of(context)?.go(1)),
                _todo(context, Icons.flag_outlined, '$openRep open report${openRep == 1 ? '' : 's'}', 'Complaints raised by donors and NGOs.', openRep > 0, () => context.push('/admin/reports')),
                _todo(context, Icons.support_agent_rounded, '${o.unresolvedFeedback} unresolved feedback', 'Bugs, requests and complaints from users.', o.unresolvedFeedback > 0, () => context.push('/admin/feedback')),
                _todo(context, Icons.mail_outline_rounded, '$newMsgs new website message${newMsgs == 1 ? '' : 's'}', 'From the contact form.', newMsgs > 0, () => context.push('/admin/inbox')),
                const SectionTitle('Recent decisions'),
                if (d.audit.isEmpty) const Pad(Text('No decisions yet.'))
                else for (final a in d.audit.take(6))
                  ListTile(dense: true, leading: const Icon(Icons.history_rounded),
                      title: Text(a.action.replaceAll('_', ' ')), subtitle: a.note.isEmpty ? null : Text(a.note, maxLines: 1, overflow: TextOverflow.ellipsis),
                      trailing: Text(a.createdAt != null ? ago(a.createdAt!) : '', style: t.textTheme.bodySmall)),
              ]),
            );
          },
        ),
      );

  Widget _todo(BuildContext c, IconData i, String title, String sub, bool hot, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: TapCard(onTap: onTap, child: Row(children: [
          Icon(i, color: hot ? Brand.terracotta : Theme.of(c).colorScheme.onSurfaceVariant),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: Theme.of(c).textTheme.titleMedium), Text(sub, style: Theme.of(c).textTheme.bodySmall),
          ])),
          const Icon(Icons.chevron_right_rounded),
        ])),
      );
}

// ============================================================ VERIFY
class AdminVerifyTab extends StatelessWidget {
  const AdminVerifyTab({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TabAppBar(title: 'Verification queue'),
        body: Loader<AdminData>(
          load: AdminService.load,
          builder: (context, d, reload) {
            final pend = d.orgs.where((o) => o.verification == 'pending').toList();
            return RefreshIndicator(
              onRefresh: reload,
              child: pend.isEmpty
                  ? ListView(children: const [EmptyState(icon: Icons.task_alt_rounded, title: 'You’re all caught up', text: 'No organisations are waiting for verification.')])
                  : ListView.separated(padding: const EdgeInsets.all(16), itemCount: pend.length + 1, separatorBuilder: (_, _) => const SizedBox(height: 12),
                      itemBuilder: (_, i) => i == 0
                          ? Text('Approve only organisations whose documents you have checked. Approve at least one document first.', style: Theme.of(context).textTheme.bodySmall)
                          : OrgReviewCard(org: pend[i - 1], d: d, reload: reload)),
            );
          },
        ),
      );
}

class OrgReviewCard extends StatefulWidget {
  final Organization org;
  final AdminData d;
  final Future<void> Function() reload;
  final bool full;
  const OrgReviewCard({super.key, required this.org, required this.d, required this.reload, this.full = false});
  @override
  State<OrgReviewCard> createState() => _OrgReviewCardState();
}

class _OrgReviewCardState extends State<OrgReviewCard> {
  final _note = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final o = widget.org;
    final t = Theme.of(context);
    final docs = widget.d.docs.where((x) => x.orgId == o.id).toList();
    final owner = widget.d.profiles[o.ownerId];
    Future<void> done(String msg) async { if (mounted) showOk(context, msg); AppSession.instance.touch(); await widget.reload(); }
    return Card(child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          AppAvatar(name: o.name, url: o.logoUrl, size: 44),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(o.name, style: t.textTheme.titleLarge?.copyWith(fontSize: 18)),
            Text('${o.kind == 'ngo' ? 'Receiver' : 'Donor'} · ${o.orgType}', style: t.textTheme.bodySmall),
          ])),
          StatusChip(o.statusLabel),
        ]),
        if (o.address != null) InfoRow(Icons.place_outlined, o.address!),
        if (owner?['full_name'] != null || o.phone != null) InfoRow(Icons.person_outline_rounded, [owner?['full_name'], o.phone].whereType<String>().join(' · ')),
        if (o.about != null) InfoRow(Icons.notes_rounded, o.about!),
        if (o.verificationNote != null && o.verificationNote!.isNotEmpty) InfoRow(Icons.sticky_note_2_outlined, 'Note: ${o.verificationNote}'),
        const SizedBox(height: 10),
        Text('DOCUMENTS', style: t.textTheme.labelSmall),
        if (docs.isEmpty) const Padding(padding: EdgeInsets.only(top: 6), child: Text('No documents uploaded.')),
        for (final doc in docs)
          Container(
            margin: const EdgeInsets.only(top: 8), padding: const EdgeInsets.fromLTRB(12, 6, 4, 6),
            decoration: BoxDecoration(borderRadius: BorderRadius.circular(12), border: Border.all(color: t.colorScheme.outline)),
            child: Row(children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(doc.label, style: t.textTheme.titleSmall),
                Text('${fmtD(doc.createdAt)}${doc.reviewerNote != null ? ' · ${doc.reviewerNote}' : ''}', style: t.textTheme.bodySmall),
              ])),
              StatusChip(doc.status),
              IconButton(tooltip: 'Open document', icon: const Icon(Icons.open_in_new_rounded), onPressed: () => guard(context, () async {
                final url = await AdminService.docUrl(doc.path);
                await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
              })),
              if (doc.status != 'approved') IconButton(tooltip: 'Approve document', icon: const Icon(Icons.check_circle_outline_rounded, color: Brand.sage),
                  onPressed: () => guard(context, () async { await AdminService.reviewDocument(doc.id, true); await done('Document approved'); })),
              if (doc.status != 'rejected') IconButton(tooltip: 'Reject document', icon: Icon(Icons.cancel_outlined, color: t.colorScheme.error), onPressed: () async {
                final r = await askText(context, title: 'Reject document', label: 'Why is this document rejected?', cta: 'Reject', danger: true);
                if (r != null && context.mounted) await guard(context, () async { await AdminService.reviewDocument(doc.id, false, r); await done('Document rejected'); });
              }),
            ]),
          ),
        if (o.verification != 'approved') ...[
          const SizedBox(height: 12),
          TextField(controller: _note, decoration: const InputDecoration(labelText: 'Note to the organisation (required to reject)')),
          const SizedBox(height: 10),
          Row(children: [
            Expanded(child: BusyButton(icon: Icons.verified_rounded, onPressed: () async {
              await AdminService.reviewOrg(o.id, true, _note.text.trim().isEmpty ? null : _note.text.trim());
              await done('Organisation approved');
            }, child: const Text('Approve'))),
            const SizedBox(width: 10),
            Expanded(child: BusyButton(outlined: true, danger: true, onPressed: () async {
              if (_note.text.trim().isEmpty) throw Exception('Write a note explaining the rejection first.');
              await AdminService.reviewOrg(o.id, false, _note.text.trim());
              await done('Organisation rejected');
            }, child: const Text('Reject'))),
          ]),
        ],
        if (widget.full && o.isApproved) ...[
          const SizedBox(height: 10),
          o.suspended
              ? BusyButton(tonal: true, onPressed: () async { await AdminService.suspend(o.id, false); await done('Account reinstated'); }, child: const Text('Reinstate'))
              : BusyButton(outlined: true, danger: true, icon: Icons.block_rounded, onPressed: () async {
                  final r = await askText(context, title: 'Suspend ${o.name}', label: 'Reason (shown to the organisation)', cta: 'Suspend', danger: true);
                  if (r == null) return;
                  await AdminService.suspend(o.id, true, r);
                  await done('Account suspended. Open listings were withdrawn.');
                }, child: const Text('Suspend')),
        ],
      ]),
    ));
  }
}

// ============================================================ MANAGE HUB
class AdminManageTab extends StatelessWidget {
  const AdminManageTab({super.key});
  static const items = [
    ('orgs', Icons.apartment_rounded, 'Organisations', 'Donors and NGOs, suspension'),
    ('listings', Icons.inventory_2_outlined, 'Food listings', 'Oversight and withdrawal'),
    ('needs', Icons.volunteer_activism_outlined, 'Community needs', 'What receivers have asked for'),
    ('requests', Icons.swap_horiz_rounded, 'Food requests', 'Every request and its status'),
    ('reports', Icons.flag_outlined, 'Reports', 'Complaints between organisations'),
    ('feedback', Icons.support_agent_rounded, 'Feedback', 'Bugs, requests, complaints, replies'),
    ('inbox', Icons.mail_outline_rounded, 'Contact messages', 'From the website contact form'),
    ('content', Icons.edit_note_rounded, 'FAQs & testimonials', 'Public website content'),
    ('announce', Icons.campaign_outlined, 'Announcements', 'Notify donors, NGOs or everyone'),
    ('audit', Icons.receipt_long_outlined, 'Audit log', 'Every admin decision'),
  ];
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TabAppBar(title: 'Manage'),
        body: ListView.separated(
          padding: const EdgeInsets.all(16), itemCount: items.length, separatorBuilder: (_, _) => const SizedBox(height: 10),
          itemBuilder: (_, i) {
            final it = items[i];
            return TapCard(
              onTap: () => context.push(it.$1 == 'feedback' ? '/admin/feedback' : '/admin/${it.$1}'),
              child: Row(children: [
                CircleAvatar(backgroundColor: Brand.forest, child: Icon(it.$2, color: Brand.gold, size: 20)),
                const SizedBox(width: 14),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(it.$3, style: Theme.of(context).textTheme.titleMedium), Text(it.$4, style: Theme.of(context).textTheme.bodySmall),
                ])),
                const Icon(Icons.chevron_right_rounded),
              ]),
            );
          },
        ),
      );
}
