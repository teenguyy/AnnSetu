import '../donor/community_needs.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/services/admin_service.dart';
import '../../core/services/session.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';
import 'admin_home.dart';

/// Admin management sections (website: Admin.jsx tabs).
class AdminSectionScreen extends StatefulWidget {
  final String section;
  const AdminSectionScreen({super.key, required this.section});
  @override
  State<AdminSectionScreen> createState() => _AdminSectionScreenState();
}

class _AdminSectionScreenState extends State<AdminSectionScreen> {
  String _f = 'all';
  final _q = TextEditingController();

  static const titles = {
    'orgs': 'Organisations', 'listings': 'Food listings', 'requests': 'Food requests', 'reports': 'Reports',
    'inbox': 'Contact messages', 'content': 'FAQs & testimonials', 'announce': 'Announcements', 'audit': 'Audit log',
  };

  @override
  Widget build(BuildContext context) {
    final sec = widget.section;
    if (sec == 'announce') return const _AnnounceScreen();
    if (sec == 'needs') return const CommunityNeedsScreen();
    return Scaffold(
      appBar: AppBar(title: Text(titles[sec] ?? 'Admin')),
      body: Loader<AdminData>(
        load: AdminService.load,
        builder: (context, d, reload) => RefreshIndicator(onRefresh: reload, child: switch (sec) {
          'orgs' => _orgs(d, reload),
          'listings' => _listings(d, reload),
          'requests' => _requests(d),
          'reports' => _reports(d, reload),
          'inbox' => _inbox(d, reload),
          'content' => _ContentEditor(d: d, reload: reload),
          'audit' => _audit(d),
          _ => const EmptyState(icon: Icons.help_outline, title: 'Unknown section', text: ''),
        }),
      ),
    );
  }

  Widget _chips(List<String> keys) => SizedBox(height: 52, child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(16, 8, 16, 4), children: [
        for (final k in keys) Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
            label: Text(k == 'ngos' ? 'NGOs' : k[0].toUpperCase() + k.substring(1)), selected: _f == k, onSelected: (_) => setState(() => _f = k))),
      ]));

  Widget _orgs(AdminData d, Future<void> Function() reload) {
    final q = _q.text.trim().toLowerCase();
    final xs = d.orgs.where((o) => (_f == 'all' || (_f == 'donors' && o.kind == 'donor') || (_f == 'ngos' && o.kind == 'ngo') ||
        (_f == 'suspended' ? o.suspended : o.verification == _f)) && (q.isEmpty || '${o.name} ${o.orgType} ${o.address ?? ''}'.toLowerCase().contains(q))).toList();
    return ListView(padding: const EdgeInsets.only(bottom: 32), children: [
      _chips(['all', 'donors', 'ngos', 'pending', 'approved', 'rejected', 'suspended']),
      Padding(padding: const EdgeInsets.fromLTRB(16, 4, 16, 8), child: TextField(controller: _q, onChanged: (_) => setState(() {}),
          decoration: const InputDecoration(prefixIcon: Icon(Icons.search_rounded), hintText: 'Search name, type, address'))),
      if (xs.isEmpty) const EmptyState(icon: Icons.search_off_rounded, title: 'No organisations match', text: 'Try another filter.'),
      for (final o in xs) Padding(padding: const EdgeInsets.fromLTRB(16, 0, 16, 12), child: OrgReviewCard(org: o, d: d, reload: reload, full: true)),
    ]);
  }

  Widget _listings(AdminData d, Future<void> Function() reload) {
    final xs = d.listings.where((l) => _f == 'all' || l.status == _f).toList();
    return ListView(padding: const EdgeInsets.only(bottom: 32), children: [
      _chips(['all', 'active', 'reserved', 'completed', 'expired', 'withdrawn']),
      if (xs.isEmpty) const EmptyState(icon: Icons.inventory_2_outlined, title: 'No listings', text: 'Nothing matches this filter.'),
      for (final l in xs)
        Card(margin: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: ListTile(
          contentPadding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
          title: Text(l.title), isThreeLine: true,
          subtitle: Text('${d.orgName(l.donorOrgId)} · ${l.category}\nPickup by ${fmtDT(l.pickupBy)} · ${l.qtyReserved}/${l.quantity} ${l.unit} reserved'),
          trailing: Column(mainAxisAlignment: MainAxisAlignment.spaceBetween, crossAxisAlignment: CrossAxisAlignment.end, children: [
            StatusChip(l.status),
            if (const ['active', 'reserved'].contains(l.status))
              InkWell(onTap: () async {
                final r = await askText(context, title: 'Withdraw listing', label: 'Reason (sent to the donor and affected NGOs)', cta: 'Withdraw', danger: true);
                if (r != null && mounted) await guard(context, () async { await AdminService.withdrawListing(l.id, r); await reload(); AppSession.instance.touch(); }, ok: 'Listing withdrawn');
              }, child: Padding(padding: const EdgeInsets.all(4), child: Text('Withdraw', style: TextStyle(color: Theme.of(context).colorScheme.error, fontWeight: FontWeight.w700)))),
          ]),
        )),
    ]);
  }

  Widget _requests(AdminData d) {
    final xs = d.requests.where((r) => _f == 'all' || r.status == _f).toList();
    return ListView(padding: const EdgeInsets.only(bottom: 32), children: [
      _chips(['all', 'pending', 'accepted', 'completed', 'rejected', 'cancelled']),
      if (xs.isEmpty) const EmptyState(icon: Icons.swap_horiz_rounded, title: 'No requests', text: 'Nothing matches this filter.'),
      for (final r in xs)
        Card(margin: const EdgeInsets.fromLTRB(16, 0, 16, 10), child: ListTile(
          title: Text(r.listing?.title ?? '(removed)'), isThreeLine: true,
          subtitle: Text('${d.orgName(r.ngoOrgId)} requested ${r.quantity} ${r.listing?.unit ?? ''}\nfrom ${d.orgName(r.listing?.donorOrgId)} · ${fmtDT(r.createdAt)}'),
          trailing: StatusChip(r.status),
        )),
    ]);
  }

  Widget _reports(AdminData d, Future<void> Function() reload) => d.reports.isEmpty
      ? ListView(children: const [EmptyState(icon: Icons.flag_outlined, title: 'No reports', text: 'Great news.')])
      : ListView(padding: const EdgeInsets.all(16), children: [
          for (final r in d.reports)
            Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text(r.reasonLabel, style: Theme.of(context).textTheme.titleMedium)), StatusChip(r.status)]),
              const SizedBox(height: 4),
              Text('${d.orgName(r.reporterOrg)} reported ${d.orgName(r.reportedOrg)} · ${fmtDT(r.createdAt)}', style: Theme.of(context).textTheme.bodySmall),
              if (r.details != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text(r.details!)),
              if (r.adminNote != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text('Admin note: ${r.adminNote}', style: Theme.of(context).textTheme.bodySmall)),
              if (const ['open', 'reviewing'].contains(r.status)) Wrap(spacing: 4, children: [
                if (r.status == 'open') TextButton(onPressed: () => guard(context, () async { await AdminService.resolveReport(r.id, 'reviewing', null); await reload(); }, ok: 'Marked as reviewing'), child: const Text('Start review')),
                TextButton(onPressed: () async {
                  final n = await askText(context, title: 'Resolve report', label: 'What did you decide? (sent to the reporter)', cta: 'Resolve');
                  if (n != null && mounted) await guard(context, () async { await AdminService.resolveReport(r.id, 'resolved', n); await reload(); }, ok: 'Report resolved');
                }, child: const Text('Resolve')),
                TextButton(onPressed: () async {
                  final n = await askText(context, title: 'Resolve and suspend ${d.orgName(r.reportedOrg)}', label: 'Reason (shown to the suspended organisation)', cta: 'Resolve + suspend', danger: true);
                  if (n != null && mounted) await guard(context, () async { await AdminService.resolveReport(r.id, 'resolved', n, suspend: true); await reload(); }, ok: 'Resolved and suspended');
                }, child: Text('Resolve + suspend', style: TextStyle(color: Theme.of(context).colorScheme.error))),
                TextButton(onPressed: () async {
                  final n = await askText(context, title: 'Dismiss report', label: 'Why is it dismissed?', cta: 'Dismiss');
                  if (n != null && mounted) await guard(context, () async { await AdminService.resolveReport(r.id, 'dismissed', n); await reload(); }, ok: 'Report dismissed');
                }, child: const Text('Dismiss')),
              ]),
            ]))),
        ]);

  Widget _inbox(AdminData d, Future<void> Function() reload) => d.contacts.isEmpty
      ? ListView(children: const [EmptyState(icon: Icons.mail_outline_rounded, title: 'No messages yet', text: 'Website contact-form messages appear here.')])
      : ListView(padding: const EdgeInsets.all(16), children: [
          for (final c in d.contacts)
            Card(margin: const EdgeInsets.only(bottom: 12), child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [Expanded(child: Text(c.subject ?? 'No subject', style: Theme.of(context).textTheme.titleMedium)), StatusChip(c.status)]),
              Text('${c.name} · ${c.email} · ${fmtDT(c.createdAt)}', style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: 8),
              Text(c.message),
              Wrap(spacing: 4, children: [
                TextButton.icon(onPressed: () => launchUrl(Uri(scheme: 'mailto', path: c.email, queryParameters: {'subject': 'Re: ${c.subject ?? 'AnnSetu'}'})),
                    icon: const Icon(Icons.reply_rounded, size: 18), label: const Text('Reply by email')),
                if (c.status != 'read') TextButton(onPressed: () => guard(context, () async { await AdminService.setContactStatus(c.id, 'read'); await reload(); }), child: const Text('Mark read')),
                if (c.status != 'replied') TextButton(onPressed: () => guard(context, () async { await AdminService.setContactStatus(c.id, 'replied'); await reload(); }), child: const Text('Mark replied')),
              ]),
            ]))),
        ]);

  Widget _audit(AdminData d) => d.audit.isEmpty
      ? ListView(children: const [EmptyState(icon: Icons.receipt_long_outlined, title: 'No decisions yet', text: 'Every admin decision is recorded here.')])
      : ListView.separated(
          padding: const EdgeInsets.symmetric(vertical: 8), itemCount: d.audit.length, separatorBuilder: (_, _) => const Divider(indent: 16),
          itemBuilder: (_, i) {
            final a = d.audit[i];
            return ListTile(
              title: Text(a.action.replaceAll('_', ' ')),
              subtitle: Text([a.targetTable, if (a.note.isNotEmpty) a.note].whereType<String>().join(' · ')),
              trailing: Text(fmtDT(a.createdAt), style: Theme.of(context).textTheme.bodySmall, textAlign: TextAlign.right),
            );
          },
        );
}

class _ContentEditor extends StatefulWidget {
  final AdminData d;
  final Future<void> Function() reload;
  const _ContentEditor({required this.d, required this.reload});
  @override
  State<_ContentEditor> createState() => _ContentEditorState();
}

class _ContentEditorState extends State<_ContentEditor> {
  final _q = TextEditingController(), _a = TextEditingController(), _quote = TextEditingController(), _author = TextEditingController(), _role = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final d = widget.d;
    final t = Theme.of(context);
    return ListView(padding: const EdgeInsets.only(bottom: 40), children: [
      const SectionTitle('FAQs', kicker: 'Shown on the website'),
      for (final f in d.faqs)
        ListTile(
          title: Text(f.question), subtitle: Text(f.answer, maxLines: 3, overflow: TextOverflow.ellipsis),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Switch(value: f.published, onChanged: (v) => guard(context, () async { await AdminService.setFaqPublished(f.id, v); await widget.reload(); })),
            IconButton(tooltip: 'Delete FAQ', icon: const Icon(Icons.delete_outline_rounded), onPressed: () async {
              if (await confirm(context, title: 'Delete FAQ?', text: f.question, cta: 'Delete', danger: true) && context.mounted) {
                await guard(context, () async { await AdminService.deleteFaq(f.id); await widget.reload(); });
              }
            }),
          ]),
        ),
      Pad(Column(children: [
        TextField(controller: _q, maxLength: 200, decoration: const InputDecoration(labelText: 'Question')),
        TextField(controller: _a, maxLength: 600, maxLines: 3, decoration: const InputDecoration(labelText: 'Answer')),
        BusyButton(expand: true, tonal: true, icon: Icons.add_rounded, onPressed: () async {
          if (_q.text.trim().isEmpty || _a.text.trim().isEmpty) throw Exception('Add both a question and an answer.');
          await AdminService.addFaq(_q.text, _a.text, d.faqs.length + 1);
          _q.clear(); _a.clear();
          if (context.mounted) showOk(context, 'FAQ added');
          await widget.reload();
        }, child: const Text('Add FAQ')),
      ])),
      const SectionTitle('Testimonials', kicker: 'Only real quotes, with permission'),
      for (final x in d.testimonials)
        ListTile(
          title: Text('“${x.quote}”'), subtitle: Text('${x.authorName}${x.authorRole != null ? ', ${x.authorRole}' : ''} · ${x.published ? 'published' : 'draft'}'),
          trailing: Row(mainAxisSize: MainAxisSize.min, children: [
            Switch(value: x.published, onChanged: (v) => guard(context, () async { await AdminService.setTestimonialPublished(x.id, v); await widget.reload(); })),
            IconButton(tooltip: 'Delete testimonial', icon: const Icon(Icons.delete_outline_rounded), onPressed: () async {
              if (await confirm(context, title: 'Delete testimonial?', text: x.quote, cta: 'Delete', danger: true) && context.mounted) {
                await guard(context, () async { await AdminService.deleteTestimonial(x.id); await widget.reload(); });
              }
            }),
          ]),
        ),
      Pad(Column(children: [
        TextField(controller: _quote, maxLength: 400, maxLines: 3, decoration: const InputDecoration(labelText: 'Quote')),
        Row(children: [
          Expanded(child: TextField(controller: _author, maxLength: 80, decoration: const InputDecoration(labelText: 'Author'))),
          const SizedBox(width: 10),
          Expanded(child: TextField(controller: _role, maxLength: 80, decoration: const InputDecoration(labelText: 'Role / organisation'))),
        ]),
        BusyButton(expand: true, tonal: true, icon: Icons.add_rounded, onPressed: () async {
          if (_quote.text.trim().isEmpty || _author.text.trim().isEmpty) throw Exception('Add the quote and who said it.');
          await AdminService.addTestimonial(_quote.text, _author.text, _role.text);
          _quote.clear(); _author.clear(); _role.clear();
          if (context.mounted) showOk(context, 'Saved as a draft');
          await widget.reload();
        }, child: const Text('Add testimonial')),
        const SizedBox(height: 6),
        Text('New testimonials start as drafts. Publish them with the switch.', style: t.textTheme.bodySmall),
      ])),
    ]);
  }
}

class _AnnounceScreen extends StatefulWidget {
  const _AnnounceScreen();
  @override
  State<_AnnounceScreen> createState() => _AnnounceScreenState();
}

class _AnnounceScreenState extends State<_AnnounceScreen> {
  final _f = GlobalKey<FormState>();
  final _title = TextEditingController(), _body = TextEditingController();
  String _aud = 'all';
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Announcements')),
        body: Form(key: _f, child: ListView(padding: const EdgeInsets.all(20), children: [
          Text('Sends an in-app notification (and a push, when configured) to every account in the audience. The announcement is recorded in the audit log.',
              style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 18),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'all', label: Text('Everyone')), ButtonSegment(value: 'donor', label: Text('Donors')), ButtonSegment(value: 'ngo', label: Text('NGOs'))],
            selected: {_aud}, onSelectionChanged: (v) => setState(() => _aud = v.first),
          ),
          const SizedBox(height: 16),
          TextFormField(controller: _title, maxLength: 80, validator: (v) => V.minLen(v, 3, 'Title'), decoration: const InputDecoration(labelText: 'Title')),
          TextFormField(controller: _body, maxLength: 500, maxLines: 5, decoration: const InputDecoration(labelText: 'Message', alignLabelWithHint: true)),
          const SizedBox(height: 10),
          BusyButton(expand: true, icon: Icons.campaign_rounded, onPressed: () async {
            if (!_f.currentState!.validate()) return;
            if (!await confirm(context, title: 'Send announcement?', text: 'This notifies ${_aud == 'all' ? 'every user' : _aud == 'donor' ? 'all donors' : 'all NGOs'} immediately.', cta: 'Send')) return;
            final n = await AdminService.announce(_title.text, _body.text, _aud);
            _title.clear(); _body.clear();
            if (context.mounted) showOk(context, 'Announcement sent to $n account${n == 1 ? '' : 's'}.');
          }, child: const Text('Send announcement')),
        ])),
      );
}
