import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/domain.dart';
import '../../core/constants/env.dart';
import '../../core/models/models.dart';
import '../../core/services/location_service.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/organization_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/theme_controller.dart';
import '../../core/utils/format.dart';
import '../../shared/components/pickers.dart';
import '../../shared/widgets/common.dart';
import '../shell/role_shell.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppSession.instance;
    return Scaffold(
      appBar: const TabAppBar(title: 'Profile'),
      body: ListenableBuilder(
        listenable: s,
        builder: (context, _) => ListView(padding: const EdgeInsets.only(bottom: 40), children: [
          _Header(),
          if (s.role != Role.admin) ...[
            _OrgForm(key: ValueKey('${s.org?.id}-${s.org?.verification}')),
            if (s.org != null) _Documents(org: s.org!),
            if (s.org != null) _Representatives(org: s.org!),
          ],
          const SectionTitle('Settings & support'),
          const _ThemePicker(),
          ListTile(leading: const Icon(Icons.rate_review_outlined), title: const Text('Feedback & support'),
              subtitle: const Text('Report a bug, suggest a feature, track replies'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/feedback')),
          ListTile(leading: const Icon(Icons.notifications_outlined), title: const Text('Notifications'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/notifications')),
          if (s.role == Role.ngo)
            ListTile(leading: const Icon(Icons.campaign_outlined), title: const Text('Community needs'), trailing: const Icon(Icons.chevron_right_rounded), onTap: () => context.push('/needs')),
          ListTile(
            leading: const Icon(Icons.language_rounded), title: const Text('Open AnnSetu website'),
            subtitle: const Text('Same account and data in your browser'), trailing: const Icon(Icons.open_in_new_rounded),
            onTap: () => launchUrl(Uri.parse(Env.websiteUrl), mode: LaunchMode.externalApplication),
          ),
          const SizedBox(height: 8),
          Pad(BusyButton(outlined: true, danger: true, icon: Icons.logout_rounded, expand: true, onPressed: () async {
            if (!await confirm(context, title: 'Sign out of AnnSetu?', text: 'You’ll need to sign in again to manage listings, requests and pickups.', cta: 'Sign out', danger: true)) return;
            LocationService.stopAll();
            await NotificationService.instance.forgetDevice();
            await s.signOut();
          }, child: const Text('Sign out'))),
          const SizedBox(height: 16),
          FutureBuilder(
            future: PackageInfo.fromPlatform(),
            builder: (c, snap) => Center(child: Text('AnnSetu ${snap.data?.version ?? ''}', style: Theme.of(c).textTheme.bodySmall)),
          ),
        ]),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final s = AppSession.instance;
    final o = s.org;
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(colors: [Brand.forest, Brand.dark], begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: Row(children: [
        AppAvatar(name: o?.name ?? s.profile?.fullName ?? s.user?.email, url: o?.logoUrl, size: 64),
        const SizedBox(width: 16),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(o?.name ?? (s.isAdmin ? 'Administrator' : 'Your organisation'), style: const TextStyle(fontFamily: serif, fontSize: 22, color: Brand.cream, height: 1.1)),
          const SizedBox(height: 4),
          Text(s.user?.email ?? '', style: TextStyle(color: Brand.cream.withValues(alpha: .75), fontSize: 13)),
          const SizedBox(height: 8),
          Wrap(spacing: 6, runSpacing: 6, children: [
            _pill(roleLabel(s.role ?? Role.donor)),
            if (o != null) _pill(o.statusLabel),
            if (o != null) _pill(o.orgType),
          ]),
        ])),
      ]),
    );
  }

  Widget _pill(String t) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        decoration: BoxDecoration(color: Brand.gold.withValues(alpha: .2), borderRadius: BorderRadius.circular(20)),
        child: Text(t.toUpperCase(), style: const TextStyle(color: Brand.gold, fontSize: 10.5, fontWeight: FontWeight.w700, letterSpacing: .8)),
      );
}

class _OrgForm extends StatefulWidget {
  const _OrgForm({super.key});
  @override
  State<_OrgForm> createState() => _OrgFormState();
}

class _OrgFormState extends State<_OrgForm> {
  final _f = GlobalKey<FormState>();
  final s = AppSession.instance;
  late final o = s.org;
  late final _name = TextEditingController(text: o?.name), _phone = TextEditingController(text: o?.phone),
      _address = TextEditingController(text: o?.address), _about = TextEditingController(text: o?.about),
      _area = TextEditingController(text: o?.areaServed);
  late String _type = o?.orgType ?? (s.role == Role.ngo ? Domain.ngoTypes : Domain.donorTypes).first;
  late double? _lat = o?.lat, _lng = o?.lng;
  PickedFile? _logo;

  int get _pct {
    final x = o;
    if (x == null) return 0;
    final items = [x.name, x.orgType, x.phone, x.address, x.about, (x.lat != null && x.lng != null) ? 'y' : null, x.logoPath, s.role == Role.ngo ? x.areaServed : 'y'];
    return (items.where((v) => v != null && v.toString().isNotEmpty).length / 8 * 100).round();
  }

  Future<void> _save() async {
    if (!_f.currentState!.validate()) return;
    String? logoPath;
    if (_logo != null) logoPath = await OrganizationService.uploadLogo(_logo!.bytes, _logo!.name);
    await OrganizationService.save(role: s.role!, existing: o, name: _name.text, type: _type, phone: _phone.text, address: _address.text,
        about: _about.text, area: _area.text, lat: _lat, lng: _lng, logoPath: logoPath);
    final created = o == null;
    await s.refreshOrg();
    if (mounted) showOk(context, created ? 'Profile created. Now upload your documents for verification.' : 'Profile saved.');
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final types = s.role == Role.ngo ? Domain.ngoTypes : Domain.donorTypes;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionTitle('Organisation', kicker: o == null ? 'Step 1 of 2' : '$_pct% complete',
          trailing: o == null ? null : SizedBox(width: 44, height: 44, child: CircularProgressIndicator(value: _pct / 100, strokeWidth: 5, color: Brand.gold))),
      if (o?.verificationNote != null && o!.verificationNote!.isNotEmpty)
        Pad(Padding(padding: const EdgeInsets.only(bottom: 10), child: Text('Admin note: ${o!.verificationNote}', style: t.textTheme.bodySmall))),
      Pad(Form(key: _f, child: Column(children: [
        Row(children: [
          GestureDetector(
            onTap: () async { try { final p = await pickPhoto(context, maxBytes: Limits.logoBytes); if (p != null) setState(() => _logo = p); } catch (e) { if (context.mounted) showErr(context, e); } },
            child: Stack(children: [
              _logo != null
                  ? ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.memory(_logo!.bytes, width: 72, height: 72, fit: BoxFit.cover))
                  : AppAvatar(name: o?.name ?? 'AS', url: o?.logoUrl, size: 72),
              Positioned(right: 0, bottom: 0, child: CircleAvatar(radius: 12, backgroundColor: Brand.forest, child: const Icon(Icons.edit_rounded, size: 13, color: Brand.gold))),
            ]),
          ),
          const SizedBox(width: 14),
          Expanded(child: Text('Logo (optional): JPG, PNG or WebP up to 1 MB.', style: t.textTheme.bodySmall)),
        ]),
        const SizedBox(height: 16),
        TextFormField(controller: _name, maxLength: 80, validator: (v) => V.minLen(v, 2, 'Organisation name'), decoration: const InputDecoration(labelText: 'Organisation name')),
        DropdownButtonFormField(initialValue: types.contains(_type) ? _type : types.first, decoration: const InputDecoration(labelText: 'Type'),
            items: [for (final x in types) DropdownMenuItem(value: x, child: Text(x))], onChanged: (v) => setState(() => _type = v!)),
        const SizedBox(height: 14),
        TextFormField(controller: _phone, maxLength: 20, keyboardType: TextInputType.phone,
            validator: (v) => (v ?? '').trim().isEmpty ? null : V.phone(v), decoration: const InputDecoration(labelText: 'Phone')),
        TextFormField(controller: _address, maxLength: 160, decoration: InputDecoration(labelText: s.role == Role.ngo ? 'Address' : 'Pickup address')),
        if (s.role == Role.ngo) TextFormField(controller: _area, maxLength: 80, decoration: const InputDecoration(labelText: 'Area served', hintText: 'e.g. East Delhi')),
        TextFormField(controller: _about, maxLength: 300, maxLines: 3, decoration: const InputDecoration(labelText: 'About')),
        const SizedBox(height: 4),
        Container(
          width: double.infinity, padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: t.colorScheme.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: t.colorScheme.outline)),
          child: Row(children: [
            Icon(Icons.place_outlined, color: t.colorScheme.primary),
            const SizedBox(width: 10),
            Expanded(child: Text(_lat != null ? 'Location set (${_lat!.toStringAsFixed(4)}, ${_lng!.toStringAsFixed(4)}). Used to find food near you.' : 'No location yet. Used to sort food by distance.',
                style: t.textTheme.bodySmall)),
            TextButton(onPressed: () async {
              final p = await LocationService.current();
              final why = p == null ? (await LocationService.ensurePermission() ?? 'Couldn’t read your location.') : null;
              if (!context.mounted) return;
              if (p == null) { showErr(context, why!); return; }
              setState(() { _lat = double.parse(p.latitude.toStringAsFixed(6)); _lng = double.parse(p.longitude.toStringAsFixed(6)); });
              showOk(context, 'Location captured. Save to keep it.');
            }, child: const Text('Use current')),
          ]),
        ),
        const SizedBox(height: 16),
        BusyButton(expand: true, onPressed: _save, child: Text(o == null ? 'Create profile' : 'Save profile')),
      ]))),
    ]);
  }
}

class _Documents extends StatefulWidget {
  final Organization org;
  const _Documents({required this.org});
  @override
  State<_Documents> createState() => _DocumentsState();
}

class _DocumentsState extends State<_Documents> {
  String _type = Domain.docTypes.keys.first;
  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SectionTitle('Verification documents', kicker: widget.org.isApproved ? 'Verified' : 'Step 2 of 2'),
        Pad(Text('Registration, FSSAI, 12A/80G or similar proof. PDF, JPG or PNG up to 5 MB. An admin reviews each document.', style: Theme.of(context).textTheme.bodySmall)),
        Loader<List<VerificationDoc>>(
          load: () => OrganizationService.docs(widget.org.id),
          builder: (context, docs, reload) => Pad(Column(children: [
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: DropdownButtonFormField(initialValue: _type, isExpanded: true, decoration: const InputDecoration(labelText: 'Document type'),
                  items: [for (final e in Domain.docTypes.entries) DropdownMenuItem(value: e.key, child: Text(e.value, overflow: TextOverflow.ellipsis))],
                  onChanged: (v) => setState(() => _type = v!))),
              const SizedBox(width: 10),
              BusyButton(icon: Icons.upload_file_rounded, onPressed: () async {
                final f = await pickDocument();
                if (f == null) return;
                await OrganizationService.uploadDoc(widget.org.id, _type, f.bytes, f.name);
                if (context.mounted) showOk(context, 'Document uploaded. Our AI is checking it now; an admin makes the final decision.');
                await reload();
              }, child: const Text('Upload')),
            ]),
            const SizedBox(height: 8),
            if (docs.isEmpty) const Padding(padding: EdgeInsets.all(12), child: Text('No documents uploaded yet.')),
            if (noCertTypes.contains(widget.org.orgType)) _NoCertificate(org: widget.org),
            for (final d in docs)
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.description_outlined),
                title: Text(d.label),
                subtitle: Text('${fmtDT(d.createdAt)}${d.reviewerNote != null ? ' · ${d.reviewerNote}' : ''}'),
                trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                  StatusChip(d.status),
                  if (d.status != 'approved') IconButton(tooltip: 'Remove document', icon: const Icon(Icons.delete_outline_rounded),
                      onPressed: () => guard(context, () async { await OrganizationService.deleteDoc(d.id); await reload(); }, ok: 'Document removed.')),
                ]),
              ),
          ])),
        ),
      ]);
}

class _Representatives extends StatefulWidget {
  final Organization org;
  const _Representatives({required this.org});
  @override
  State<_Representatives> createState() => _RepresentativesState();
}

class _RepresentativesState extends State<_Representatives> {
  final _name = TextEditingController(), _phone = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final ngo = AppSession.instance.role == Role.ngo;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionTitle(ngo ? 'Pickup representatives' : 'Handover representatives', kicker: 'Your people'),
      Pad(Text(ngo
          ? 'Your own people collect food; AnnSetu does not provide delivery. You choose one for every request.'
          : 'Staff who hand food over at your premises. Stored for your organisation only; receivers still bring their own representative.',
          style: Theme.of(context).textTheme.bodySmall)),
      Loader<List<Representative>>(
        load: () => OrganizationService.reps(widget.org.id),
        builder: (context, reps, reload) => Pad(Column(children: [
          for (final r in reps)
            ListTile(contentPadding: EdgeInsets.zero, leading: AppAvatar(name: r.name, size: 36), title: Text(r.name), subtitle: Text(r.phone),
                trailing: IconButton(tooltip: 'Remove ${r.name}', icon: const Icon(Icons.person_remove_outlined),
                    onPressed: () => guard(context, () async { await OrganizationService.deleteRep(r.id); await reload(); }, ok: 'Representative removed.'))),
          if (reps.isEmpty) const Padding(padding: EdgeInsets.symmetric(vertical: 10), child: Text('No representatives yet.')),
          Row(children: [
            Expanded(child: TextField(controller: _name, maxLength: 60, decoration: const InputDecoration(labelText: 'Name', counterText: ''))),
            const SizedBox(width: 8),
            Expanded(child: TextField(controller: _phone, maxLength: 20, keyboardType: TextInputType.phone, decoration: const InputDecoration(labelText: 'Phone', counterText: ''))),
          ]),
          const SizedBox(height: 10),
          BusyButton(expand: true, tonal: true, icon: Icons.person_add_alt_1_rounded, onPressed: () async {
            if (_name.text.trim().length < 2 || V.phone(_phone.text) != null) throw Exception('Enter the representative’s name and phone.');
            await OrganizationService.addRep(widget.org.id, _name.text, _phone.text);
            _name.clear(); _phone.clear();
            if (context.mounted) showOk(context, 'Representative added.');
            await reload();
            AppSession.instance.touch();
          }, child: const Text('Add representative')),
        ])),
      ),
    ]);
  }
}

class _ThemePicker extends StatelessWidget {
  const _ThemePicker();
  @override
  Widget build(BuildContext context) => ValueListenableBuilder<ThemeMode>(
        valueListenable: ThemeController.instance,
        builder: (_, m, _) => Padding(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
          child: SegmentedButton<ThemeMode>(
            segments: const [
              ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
              ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('System')),
              ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Dark')),
            ],
            selected: {m},
            onSelectionChanged: (v) => ThemeController.instance.set(v.first),
          ),
        ),
      );
}


/// NGOs, community groups and community kitchens without a certificate can ask for manual review.
class _NoCertificate extends StatefulWidget {
  final Organization org;
  const _NoCertificate({required this.org});
  @override
  State<_NoCertificate> createState() => _NoCertificateState();
}

class _NoCertificateState extends State<_NoCertificate> {
  late bool _on = widget.org.noCertificate;
  late final _note = TextEditingController(text: widget.org.noCertificateNote ?? '');
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    if (widget.org.noCertificate) {
      return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [const Icon(Icons.schedule_rounded), const SizedBox(width: 8), Expanded(child: Text('Manual review requested', style: t.textTheme.titleSmall))]),
        const SizedBox(height: 6),
        const Text('Your request will be reviewed within 3–5 business days.'),
        TextButton(onPressed: () => guard(context, () async { await OrganizationService.withdrawNoCertificate(widget.org.id); await AppSession.instance.refreshOrg(); }, ok: 'Request withdrawn.'),
            child: const Text('Withdraw request')),
      ])));
    }
    return Card(child: Padding(padding: const EdgeInsets.all(14), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      CheckboxListTile(contentPadding: EdgeInsets.zero, value: _on, onChanged: (v) => setState(() => _on = v ?? false),
          title: const Text('We don’t have a registration certificate'),
          subtitle: const Text('Local NGOs and community groups can ask an admin to verify them manually.')),
      if (_on) ...[
        TextField(controller: _note, minLines: 3, maxLines: 6, maxLength: 1000,
            decoration: const InputDecoration(labelText: 'Who do you serve, and since when? Add references (ward office, school…)')),
        BusyButton(icon: Icons.send_rounded, onPressed: () async {
          if (_note.text.trim().length < 30) throw Exception('Please write at least 30 characters.');
          await OrganizationService.requestNoCertificate(widget.org.id, _note.text);
          await AppSession.instance.refreshOrg();
          if (context.mounted) showOk(context, 'Sent. Your request will be reviewed within 3–5 business days.');
        }, child: const Text('Request admin review')),
      ],
    ])));
  }
}
