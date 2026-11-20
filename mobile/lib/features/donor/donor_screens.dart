import '../tracking/live_track.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/models.dart';
import '../../core/services/donation_service.dart';
import '../../core/services/organization_service.dart';
import '../../core/services/request_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';
import '../donations/listing_widgets.dart';
import '../requests/request_widgets.dart';
import '../shell/role_shell.dart';

/// Everything a donor dashboard needs, loaded the same way as website/src/data.js loadDonor().
class DonorData {
  final Organization? org;
  final List<Listing> listings;
  final List<FoodRequest> requests;
  final List<VerificationDoc> docs;
  final Map<String, RepLocation> locs;
  final List<Requirement> needs;
  DonorData(this.org, this.listings, this.requests, this.docs, this.locs, this.needs);
  List<FoodRequest> get pending => requests.where((r) => r.status == 'pending').toList();
  List<FoodRequest> get accepted => requests.where((r) => r.inTransit).toList(); // waiting for handover, or on the way to the NGO
  List<FoodRequest> get done => requests.where((r) => r.status == 'completed').toList();

  static Future<DonorData> load() async {
    final org = AppSession.instance.org;
    if (org == null) return DonorData(null, [], [], [], {}, []);
    final listings = await DonationService.myListings(org.id);
    final reqs = await RequestService.forDonor(listings);
    final docs = await OrganizationService.docs(org.id);
    final locs = await RequestService.locations(reqs.where((r) => r.status == 'accepted').map((r) => r.id).toList());
    List<Requirement> needs = [];
    if (org.canAct) {
      try { needs = await DonationService.openNeeds(); } catch (_) {}
    }
    return DonorData(org, listings, reqs, docs, locs, needs);
  }
}

void _goTab(BuildContext c, int i) => RoleShell.of(c)?.go(i);

// ============================================================ HOME
class DonorHome extends StatelessWidget {
  const DonorHome({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TabAppBar(title: 'Donor'),
        body: Loader<DonorData>(
          load: DonorData.load,
          builder: (context, d, reload) {
            final org = d.org;
            final ok = org?.canAct ?? false;
            final h = DateTime.now().hour;
            final greet = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
            final active = d.listings.where((l) => l.effectiveStatus == 'active').length;
            final units = d.done.fold<int>(0, (a, r) => a + r.quantity);
            final steps = [
              ('Complete your organisation profile', org != null && (org.address ?? '').isNotEmpty),
              ('Upload verification documents', d.docs.isNotEmpty),
              ('Get verified by an admin', ok),
              ('Publish your first listing', d.listings.isNotEmpty),
              ('Complete your first donation', d.done.isNotEmpty),
            ];
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
                VerifyBanner(onOpenProfile: () => _goTab(context, 4)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: _Hero(
                    kicker: greet, title: org?.name ?? 'Welcome, donor',
                    text: 'Every listing you publish is a meal that doesn’t go to waste.',
                    action: FilledButton.icon(
                      style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.dark),
                      onPressed: ok ? () => context.push('/listing/new') : null,
                      icon: const Icon(Icons.add_rounded), label: const Text('List surplus food'),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: _Grid([
                    StatCard(value: active, label: 'Active listings', icon: Icons.inventory_2_rounded),
                    StatCard(value: d.pending.length, label: 'Pending requests', icon: Icons.inbox_rounded, highlight: d.pending.isNotEmpty),
                    StatCard(value: d.done.length, label: 'Completed donations', icon: Icons.volunteer_activism_rounded),
                    StatCard(value: units, label: 'Units donated', icon: Icons.trending_up_rounded),
                  ]),
                ),
                if (d.pending.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                    child: TapCard(
                      onTap: () => _goTab(context, 2),
                      child: Row(children: [
                        const Icon(Icons.notifications_active_rounded, color: Brand.gold),
                        const SizedBox(width: 12),
                        Expanded(child: Text('${d.pending.length} request${d.pending.length > 1 ? 's' : ''} waiting for your answer',
                            style: Theme.of(context).textTheme.titleMedium)),
                        const Icon(Icons.chevron_right_rounded),
                      ]),
                    ),
                  ),
                if (steps.any((s) => !s.$2)) _Checklist(steps),
                if (d.needs.isNotEmpty) ...[
                  Row(children: [
                    const Expanded(child: SectionTitle('Community needs', kicker: 'From verified NGOs')),
                    Padding(padding: const EdgeInsets.only(right: 8), child: TextButton(onPressed: () => context.push('/community-needs'), child: const Text('See all'))),
                  ]),
                  SizedBox(
                    height: 132,
                    child: ListView.separated(
                      scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: d.needs.length, separatorBuilder: (_, _) => const SizedBox(width: 12),
                      itemBuilder: (_, i) => _NeedCard(d.needs[i]),
                    ),
                  ),
                ],
                const SectionTitle('Recent activity'),
                ..._activity(context, d),
              ]),
            );
          },
        ),
      );

  List<Widget> _activity(BuildContext c, DonorData d) {
    final ev = <(String, DateTime)>[
      for (final l in d.listings) if (l.createdAt != null) ('You listed ${l.title} (${l.quantity} ${l.unit})', l.createdAt!),
      for (final r in d.requests) if (r.createdAt != null) ('${r.ngo?.name ?? 'Receiver'} · ${r.listing?.title ?? 'request'}: ${r.status}', r.createdAt!),
    ]..sort((a, b) => b.$2.compareTo(a.$2));
    if (ev.isEmpty) return [const Pad(Text('Your listings and requests will appear here.'))];
    return [
      for (final e in ev.take(6))
        ListTile(dense: true, leading: const Icon(Icons.circle, size: 8, color: Brand.gold), title: Text(e.$1), trailing: Text(ago(e.$2), style: Theme.of(c).textTheme.bodySmall)),
    ];
  }
}

class _Hero extends StatelessWidget {
  final String kicker, title, text;
  final Widget action;
  const _Hero({required this.kicker, required this.title, required this.text, required this.action});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: const LinearGradient(colors: [Brand.forest, Brand.dark], begin: Alignment.topLeft, end: Alignment.bottomRight),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(kicker.toUpperCase(), style: const TextStyle(color: Brand.gold, letterSpacing: 1.6, fontWeight: FontWeight.w700, fontSize: 11.5)),
          const SizedBox(height: 8),
          Text(title, style: const TextStyle(fontFamily: serif, color: Brand.cream, fontSize: 28, height: 1.1)),
          const SizedBox(height: 8),
          Text(text, style: TextStyle(color: Brand.cream.withValues(alpha: .8))),
          const SizedBox(height: 16),
          action,
        ]),
      );
}

class _Grid extends StatelessWidget {
  final List<Widget> children;
  const _Grid(this.children);
  @override
  Widget build(BuildContext context) => LayoutBuilder(builder: (c, box) {
        final cols = box.maxWidth > 560 ? 4 : 2;
        final w = (box.maxWidth - 12 * (cols - 1)) / cols;
        return Wrap(spacing: 12, runSpacing: 12, children: [for (final ch in children) SizedBox(width: w, child: ch)]);
      });
}

class _Checklist extends StatelessWidget {
  final List<(String, bool)> steps;
  const _Checklist(this.steps);
  @override
  Widget build(BuildContext context) {
    final n = steps.where((s) => s.$2).length;
    final t = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      child: Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [Expanded(child: Text('Getting started', style: t.textTheme.titleLarge)), Text('$n of ${steps.length}', style: t.textTheme.bodySmall)]),
          const SizedBox(height: 10),
          ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(value: n / steps.length, minHeight: 6, color: Brand.gold)),
          const SizedBox(height: 6),
          for (final s in steps)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(children: [
                Icon(s.$2 ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 20, color: s.$2 ? t.colorScheme.primary : t.colorScheme.outline),
                const SizedBox(width: 10),
                Expanded(child: Text(s.$1, style: TextStyle(decoration: s.$2 ? TextDecoration.lineThrough : null, color: s.$2 ? t.colorScheme.onSurfaceVariant : null))),
              ]),
            ),
        ]),
      )),
    );
  }
}

class _NeedCard extends StatelessWidget {
  final Requirement n;
  const _NeedCard(this.n);
  @override
  Widget build(BuildContext context) => SizedBox(
        width: 240,
        child: Card(child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(n.ngoName ?? 'Verified NGO', style: Theme.of(context).textTheme.labelSmall, maxLines: 1),
            const SizedBox(height: 4),
            Text(n.title, style: Theme.of(context).textTheme.titleMedium, maxLines: 2, overflow: TextOverflow.ellipsis),
            const Spacer(),
            Text('${n.quantity} needed · by ${fmtD(n.neededBy)}', style: Theme.of(context).textTheme.bodySmall),
          ]),
        )),
      );
}

// ============================================================ LISTINGS
class DonorListings extends StatefulWidget {
  const DonorListings({super.key});
  @override
  State<DonorListings> createState() => _DonorListingsState();
}

class _DonorListingsState extends State<DonorListings> {
  String _f = 'all';
  @override
  Widget build(BuildContext context) {
    final ok = AppSession.instance.org?.canAct ?? false;
    return Scaffold(
      appBar: const TabAppBar(title: 'Listings'),
      floatingActionButton: ok ? FloatingActionButton.extended(
        onPressed: () => context.push('/listing/new'), icon: const Icon(Icons.add_rounded), label: const Text('New listing'),
        backgroundColor: Brand.gold, foregroundColor: Brand.dark,
      ) : null,
      body: Loader<DonorData>(
        load: DonorData.load,
        builder: (context, d, reload) {
          final list = d.listings.where((l) => _f == 'all' || l.effectiveStatus == _f).toList();
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.only(bottom: 96), children: [
              if (!ok) VerifyBanner(onOpenProfile: () => _goTab(context, 4)),
              SizedBox(
                height: 56,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.fromLTRB(16, 10, 16, 6), children: [
                  for (final k in ['all', 'active', 'reserved', 'expired', 'completed', 'withdrawn'])
                    Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                      label: Text(k[0].toUpperCase() + k.substring(1)), selected: _f == k, onSelected: (_) => setState(() => _f = k))),
                ]),
              ),
              if (list.isEmpty)
                EmptyState(
                  icon: Icons.inventory_2_outlined,
                  title: d.listings.isEmpty ? 'No listings yet' : 'Nothing here',
                  text: d.listings.isEmpty
                      ? (ok ? 'Publish your first surplus food listing. Verified NGOs nearby can request it straight away.' : 'Your organisation must be verified before you can publish food.')
                      : 'No listings match this filter.',
                  action: ok && d.listings.isEmpty ? FilledButton.icon(onPressed: () => context.push('/listing/new'), icon: const Icon(Icons.add_rounded), label: const Text('New listing')) : null,
                )
              else
                for (final l in list)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                    child: ListingCard(l, footer: _footer(context, l, d, reload)),
                  ),
            ]),
          );
        },
      ),
    );
  }

  Widget? _footer(BuildContext c, Listing l, DonorData d, Future<void> Function() reload) {
    final reqs = d.requests.where((r) => r.listingId == l.id).toList();
    final pending = reqs.where((r) => r.status == 'pending').length;
    final canWithdraw = l.effectiveStatus == 'active' && l.qtyReserved == 0;
    if (!canWithdraw && reqs.isEmpty) return null;
    return Row(children: [
      if (reqs.isNotEmpty) Expanded(child: Text('${reqs.length} request${reqs.length > 1 ? 's' : ''}${pending > 0 ? ' · $pending pending' : ''}', style: Theme.of(c).textTheme.bodySmall)),
      if (reqs.isEmpty) const Spacer(),
      if (canWithdraw)
        BusyButton(outlined: true, danger: true, onPressed: () async {
          final yes = await confirm(c, title: 'Withdraw listing?', text: pending > 0 ? 'Pending requests will no longer be acceptable.' : 'It will no longer be visible to NGOs.', cta: 'Withdraw', danger: true);
          if (!yes) return;
          await DonationService.withdraw(l.id);
          if (c.mounted) showOk(c, 'Listing withdrawn.');
          AppSession.instance.touch();
        }, child: const Text('Withdraw')),
    ]);
  }
}

// ============================================================ REQUESTS / PICKUPS / HISTORY
class DonorRequests extends StatelessWidget {
  const DonorRequests({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 3,
        child: Scaffold(
          appBar: const TabAppBar(title: 'Requests', bottom: TabBar(tabs: [Tab(text: 'Incoming'), Tab(text: 'Pickups'), Tab(text: 'History')])),
          body: Loader<DonorData>(
            load: DonorData.load,
            builder: (context, d, reload) => TabBarView(children: [
              _list(context, d.pending, reload, empty: ('No requests waiting', 'Requests appear here when verified NGOs ask for your food.', Icons.inbox_outlined),
                  item: (r) => _IncomingCard(r: r, org: d.org!)),
              _list(context, d.accepted, reload, empty: ('No pickups waiting', 'Accepted requests show here until you confirm the handover with the receiver’s OTP.', Icons.local_shipping_outlined),
                  item: (r) => _PickupCard(r: r, loc: d.locs[r.id])),
              _list(context, d.requests.where((r) => const ['completed', 'rejected', 'cancelled'].contains(r.status)).toList(), reload,
                  empty: ('No history yet', 'Completed, rejected and cancelled requests are kept here.', Icons.history_rounded),
                  item: (r) => _HistoryCard(r: r, org: d.org)),
            ]),
          ),
        ),
      );

  Widget _list(BuildContext c, List<FoodRequest> xs, Future<void> Function() reload,
      {required (String, String, IconData) empty, required Widget Function(FoodRequest) item}) => RefreshIndicator(
        onRefresh: reload,
        child: xs.isEmpty
            ? ListView(children: [EmptyState(icon: empty.$3, title: empty.$1, text: empty.$2)])
            : ListView.separated(
                padding: const EdgeInsets.all(16), itemCount: xs.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12), itemBuilder: (_, i) => item(xs[i]),
              ),
      );
}

void openChat(BuildContext c, FoodRequest r, String title, {String side = 'donor'}) {
  final q = {'title': title, 'side': side, if (r.donor?.name != null) 'd': r.donor!.name, if (r.ngo?.name != null) 'n': r.ngo!.name,
      if (r.repName != null) 'r': '${r.repName} (representative)'};
  c.push(Uri(path: '/chat/${r.id}', queryParameters: q).toString());
}

class _IncomingCard extends StatelessWidget {
  final FoodRequest r;
  final Organization org;
  const _IncomingCard({required this.r, required this.org});
  @override
  Widget build(BuildContext context) {
    final l = r.listing;
    return Card(child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        RequestHeader(title: r.ngo?.name ?? 'Receiver', status: r.status,
            subtitle: 'wants ${r.quantity} ${l?.unit ?? ''} of “${l?.title ?? 'listing'}” · ${r.createdAt != null ? ago(r.createdAt!) : ''}'),
        if (l != null) Padding(padding: const EdgeInsets.only(top: 8), child: Text('${l.available} of ${l.quantity} ${l.unit} still unreserved', style: Theme.of(context).textTheme.bodySmall)),
        InfoRow(Icons.badge_outlined, 'Representative: ${r.repName ?? '—'}${r.repPhone != null ? ' · ${r.repPhone}' : ''}'),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: BusyButton(icon: Icons.check_rounded, onPressed: () async {
            await RequestService.respond(r.id, true);
            if (context.mounted) showOk(context, 'Request accepted. Quantity is reserved for pickup.');
            AppSession.instance.touch();
          }, child: const Text('Accept'))),
          const SizedBox(width: 10),
          Expanded(child: BusyButton(outlined: true, danger: true, icon: Icons.close_rounded, onPressed: () async {
            if (!await confirm(context, title: 'Reject this request?', text: 'The NGO will be notified.', cta: 'Reject', danger: true)) return;
            await RequestService.respond(r.id, false);
            if (context.mounted) showOk(context, 'Request rejected.');
            AppSession.instance.touch();
          }, child: const Text('Reject'))),
        ]),
        const SizedBox(height: 4),
        Row(children: [
          TextButton.icon(onPressed: () => openChat(context, r, r.ngo?.name ?? 'Receiver'), icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18), label: const Text('Message')),
          TextButton.icon(onPressed: () => showReportSheet(context, reporterOrg: org.id, reportedOrg: r.ngoOrgId, requestId: r.id, name: r.ngo?.name),
              icon: const Icon(Icons.flag_outlined, size: 18), label: const Text('Report')),
        ]),
      ]),
    ));
  }
}

class _PickupCard extends StatefulWidget {
  final FoodRequest r;
  final RepLocation? loc;
  const _PickupCard({required this.r, this.loc});
  @override
  State<_PickupCard> createState() => _PickupCardState();
}

class _PickupCardState extends State<_PickupCard> {
  final _otp = TextEditingController();
  @override
  Widget build(BuildContext context) {
    final r = widget.r;
    final t = Theme.of(context);
    return Card(child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        RequestHeader(title: r.ngo?.name ?? 'Receiver', status: r.status == 'accepted' ? 'accepted' : 'collected', subtitle: '${r.quantity} ${r.listing?.unit ?? ''} × ${r.listing?.title ?? ''}'),
        InfoRow(Icons.badge_outlined, 'Representative: ${r.repName ?? '—'}'),
        LiveTrackCard(r: r, donor: AppSession.instance.org, ngo: r.ngo, viewer: 'donor', onMessage: () => openChat(context, r, r.ngo?.name ?? 'Receiver')),
        const SizedBox(height: 14),
        if (r.status == 'accepted') Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: t.colorScheme.secondaryContainer, borderRadius: BorderRadius.circular(14)),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Confirm the handover', style: t.textTheme.titleMedium),
            const SizedBox(height: 4),
            Text('Ask the representative for the 4-digit OTP shown in their app or on the website. After 5 wrong tries the OTP locks.', style: t.textTheme.bodySmall),
            const SizedBox(height: 12),
            Row(children: [
              SizedBox(
                width: 130,
                child: TextField(
                  controller: _otp, keyboardType: TextInputType.number, maxLength: 4, textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 22, letterSpacing: 10, fontWeight: FontWeight.w700),
                  decoration: const InputDecoration(counterText: '', hintText: '····'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(child: BusyButton(icon: Icons.verified_rounded, onPressed: () async {
                final err = V.otp(_otp.text);
                if (err != null) throw Exception(err);
                final good = await RequestService.confirmPickup(r.id, _otp.text);
                if (!context.mounted) return;
                if (!good) { showErr(context, 'Incorrect OTP. Ask the representative to check their Pickups tab.'); return; }
                showOk(context, 'Pickup confirmed. Thank you for feeding someone today!');
                AppSession.instance.touch();
              }, child: const Text('Confirm'))),
            ]),
          ]),
        ),
      ]),
    ));
  }
}

class _HistoryCard extends StatelessWidget {
  final FoodRequest r;
  final Organization? org;
  const _HistoryCard({required this.r, this.org});
  @override
  Widget build(BuildContext context) => Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          RequestHeader(title: r.listing?.title ?? 'Listing', status: r.status,
              subtitle: '${r.ngo?.name ?? 'Receiver'} · ${r.quantity} ${r.listing?.unit ?? ''} · ${fmtD(r.completedAt ?? r.createdAt)}'),
          Row(children: [
            if (r.canMessage) TextButton.icon(onPressed: () => openChat(context, r, r.ngo?.name ?? 'Receiver'), icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18), label: const Text('Message')),
            if (org != null) TextButton.icon(onPressed: () => showReportSheet(context, reporterOrg: org!.id, reportedOrg: r.ngoOrgId, requestId: r.id, name: r.ngo?.name),
                icon: const Icon(Icons.flag_outlined, size: 18), label: const Text('Report')),
          ]),
        ]),
      ));
}
