import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/services/session.dart';
import '../../core/services/supabase_service.dart';
import '../../core/services/tracking_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/common.dart';
import '../shell/role_shell.dart';
import '../tracking/live_track.dart';

/// Representative: pickups assigned by their NGO, with directions, OTP, steps and live location.
class RepPickups extends StatefulWidget {
  final bool history;
  const RepPickups({super.key, this.history = false});
  @override
  State<RepPickups> createState() => _RepPickupsState();
}

class _RepPickupsState extends State<RepPickups> {
  List<RepPickup>? _items;
  Map<String, dynamic> _link = const {};
  Object? _err;

  @override
  void initState() {
    super.initState();
    _load();
    AppSession.instance.dataTick.addListener(_load);
  }

  @override
  void dispose() {
    AppSession.instance.dataTick.removeListener(_load);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final link = await TrackingService.linkRep();
      final items = link['linked'] == true ? await TrackingService.repPickups() : <RepPickup>[];
      if (mounted) setState(() { _link = link; _items = items; _err = null; });
    } catch (e) {
      if (mounted) setState(() => _err = e);
    }
  }

  void _chat(RepPickup p) => context.push(Uri(path: '/chat/${p.id}', queryParameters: {
        'title': p.title, 'side': 'rep', 'd': p.donorName, 'n': p.ngoName}).toString());

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final linked = _link['linked'] == true;
    final list = (_items ?? []).where((p) => widget.history ? !p.inTransit : p.inTransit).toList();
    return Scaffold(
      appBar: TabAppBar(title: widget.history ? 'History' : 'My pickups'),
      body: _items == null
          ? (_err != null ? ErrorState(error: _err!, onRetry: _load) : const Center(child: BridgeLoader()))
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                if (!widget.history)
                  Container(
                    padding: const EdgeInsets.all(18),
                    decoration: BoxDecoration(color: Brand.dark, borderRadius: BorderRadius.circular(22)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('REPRESENTATIVE', style: TextStyle(color: Brand.sky, fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text(linked ? 'Hi ${_link['name']}' : 'Welcome', style: const TextStyle(fontFamily: serif, fontSize: 30, color: Brand.gold)),
                      const SizedBox(height: 4),
                      Text(linked ? 'You collect food for ${_link['org_name']}. Your pickups, directions and OTP are below.'
                          : 'Link your account to your NGO to see pickups.', style: TextStyle(color: Brand.cream.withValues(alpha: .85))),
                    ]),
                  ),
                if (!linked) ...[
                  const SizedBox(height: 14),
                  Card(child: Padding(padding: const EdgeInsets.all(16), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Your account isn’t linked to an NGO yet', style: t.textTheme.titleMedium),
                    const SizedBox(height: 6),
                    Text('Ask your NGO to add you in Profile → Representatives with this email: ${AppSession.instance.user?.email ?? ''}. Then tap “Check again”.'),
                    const SizedBox(height: 10),
                    FilledButton.icon(onPressed: _load, icon: const Icon(Icons.refresh_rounded), label: const Text('Check again')),
                  ]))),
                ] else if (list.isEmpty)
                  Padding(padding: const EdgeInsets.only(top: 40), child: EmptyState(
                    icon: widget.history ? Icons.history_rounded : Icons.local_shipping_outlined,
                    title: widget.history ? 'No past pickups' : 'No pickups assigned right now',
                    text: widget.history ? 'Completed pickups from the last 30 days appear here.' : 'When your NGO assigns you a pickup and the donor accepts it, it appears here with directions and the OTP.'))
                else
                  for (final p in list) _card(p, t),
              ]),
            ),
    );
  }

  Widget _card(RepPickup p, ThemeData t) => Card(
        margin: const EdgeInsets.only(top: 14),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p.title, style: t.textTheme.titleMedium),
            Text('${p.quantity} ${p.unit} · for ${p.ngoName}', style: t.textTheme.bodySmall),
            const SizedBox(height: 8),
            InfoRow(Icons.place_outlined, 'Pickup: ${p.donorName}${p.donorAddress != null ? ' · ${p.donorAddress}' : ''}'),
            if (p.pickupBy != null && p.status == 'accepted') InfoRow(Icons.schedule_rounded, 'Collect before ${fmtDT(p.pickupBy)}'),
            if (p.safetyNotes != null && p.safetyNotes!.isNotEmpty) InfoRow(Icons.info_outline_rounded, p.safetyNotes!),
            if (p.status == 'accepted') ...[
              const SizedBox(height: 10),
              Container(
                width: double.infinity, padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: Brand.dark, borderRadius: BorderRadius.circular(18)),
                child: Column(children: [
                  Text('SHOW THIS OTP TO THE DONOR', style: TextStyle(color: Brand.cream.withValues(alpha: .75), fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 6),
                  Text(p.otp ?? '····', style: const TextStyle(fontFamily: serif, fontSize: 48, letterSpacing: 14, color: Brand.gold, height: 1)),
                ]),
              ),
            ],
            if (p.inTransit) RepTripPanel(p: p, onChanged: _load, onMessage: () => _chat(p)),
            if (p.tripStatus == 'delivered') Padding(padding: const EdgeInsets.only(top: 8), child: Text('Delivered. Thank you!', style: t.textTheme.bodyMedium)),
          ]),
        ),
      );
}

/// Representative account tab: who they are, which NGO, theme, sign out.
class RepAccount extends StatelessWidget {
  const RepAccount({super.key});
  @override
  Widget build(BuildContext context) {
    final s = AppSession.instance;
    return Scaffold(
      appBar: const TabAppBar(title: 'Account'),
      body: ListView(padding: const EdgeInsets.all(16), children: [
        Card(child: ListTile(
          leading: const CircleAvatar(child: Icon(Icons.person_rounded)),
          title: Text(s.profile?.fullName ?? 'Representative'),
          subtitle: Text(s.user?.email ?? ''),
        )),
        const SizedBox(height: 8),
        Card(child: Column(children: [
          ListTile(leading: const Icon(Icons.smart_toy_outlined), title: const Text('AnnSetu assistant'), onTap: () => context.push('/assistant')),
          ListTile(leading: const Icon(Icons.support_agent_rounded), title: const Text('Send feedback'), onTap: () => context.push('/feedback/new')),
          ListTile(
            leading: Icon(Icons.logout_rounded, color: Theme.of(context).colorScheme.error),
            title: const Text('Sign out'),
            onTap: () async {
              if (await confirm(context, title: 'Sign out of AnnSetu?', text: 'Location sharing stops and you’ll need to sign in again.', cta: 'Sign out', danger: true)) {
                await db.auth.signOut();
              }
            },
          ),
        ])),
      ]),
    );
  }
}
