import '../tracking/live_track.dart';
import '../../core/services/tracking_service.dart' show orgPoint;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/domain.dart';
import '../../core/models/models.dart';
import '../../core/services/donation_service.dart';
import '../../core/services/location_service.dart';
import '../../core/services/organization_service.dart';
import '../../core/services/request_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';
import '../donations/listing_widgets.dart';
import '../donor/donor_screens.dart' show openChat;
import '../requests/request_widgets.dart';
import '../shell/role_shell.dart';

/// Receiver dashboard data (website/src/data.js loadReceiver()).
class ReceiverData {
  final Organization? org;
  final List<Representative> reps;
  final List<FoodRequest> requests;
  final List<VerificationDoc> docs;
  final Map<String, PickupOtp> otps;
  final List<Requirement> needs;
  ReceiverData(this.org, this.reps, this.requests, this.docs, this.otps, this.needs);
  List<FoodRequest> get pending => requests.where((r) => r.status == 'pending').toList();
  List<FoodRequest> get accepted => requests.where((r) => r.inTransit).toList(); // to collect, or coming to you
  List<FoodRequest> get done => requests.where((r) => r.status == 'completed').toList();

  static Future<ReceiverData> load() async {
    final org = AppSession.instance.org;
    if (org == null) return ReceiverData(null, [], [], [], {}, []);
    final r = await Future.wait<dynamic>([
      OrganizationService.reps(org.id), RequestService.forReceiver(org.id), OrganizationService.docs(org.id), DonationService.myNeeds(org.id),
    ]);
    final reqs = r[1] as List<FoodRequest>;
    final otps = await RequestService.otps(reqs.where((x) => x.status == 'accepted').map((x) => x.id).toList());
    return ReceiverData(org, r[0], reqs, r[2], otps, r[3]);
  }
}

void _goTab(BuildContext c, int i) => RoleShell.of(c)?.go(i);

// ============================================================ HOME
class ReceiverHome extends StatelessWidget {
  const ReceiverHome({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: const TabAppBar(title: 'Receiver'),
        body: Loader<ReceiverData>(
          load: ReceiverData.load,
          builder: (context, d, reload) {
            final ok = d.org?.canAct ?? false;
            final h = DateTime.now().hour;
            final units = d.done.fold<int>(0, (a, r) => a + r.quantity);
            final open = d.needs.where((n) => n.status == 'open').length;
            final steps = [
              ('Complete your organisation profile', d.org != null && (d.org!.address ?? '').isNotEmpty),
              ('Upload verification documents', d.docs.isNotEmpty),
              ('Get verified by an admin', ok),
              ('Add a pickup representative', d.reps.isNotEmpty),
              ('Send your first food request', d.requests.isNotEmpty),
              ('Collect your first donation', d.done.isNotEmpty),
            ];
            final n = steps.where((s) => s.$2).length;
            final t = Theme.of(context);
            return RefreshIndicator(
              onRefresh: reload,
              child: ListView(padding: const EdgeInsets.only(bottom: 32), children: [
                VerifyBanner(onOpenProfile: () => _goTab(context, 4)),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(borderRadius: BorderRadius.circular(22),
                        gradient: const LinearGradient(colors: [Brand.forest, Brand.dark], begin: Alignment.topLeft, end: Alignment.bottomRight)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text((h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening').toUpperCase(),
                          style: const TextStyle(color: Brand.gold, letterSpacing: 1.6, fontWeight: FontWeight.w700, fontSize: 11.5)),
                      const SizedBox(height: 8),
                      Text(d.org?.name ?? 'Welcome', style: const TextStyle(fontFamily: serif, color: Brand.cream, fontSize: 28, height: 1.1)),
                      const SizedBox(height: 8),
                      Text('Find fresh surplus food nearby and bring it to the people who need it.', style: TextStyle(color: Brand.cream.withValues(alpha: .8))),
                      const SizedBox(height: 16),
                      Wrap(spacing: 10, runSpacing: 10, children: [
                        FilledButton.icon(style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.dark),
                            onPressed: ok ? () => _goTab(context, 1) : null, icon: const Icon(Icons.travel_explore_rounded), label: const Text('Find food')),
                        OutlinedButton.icon(style: OutlinedButton.styleFrom(foregroundColor: Brand.cream, side: BorderSide(color: Brand.cream.withValues(alpha: .5))),
                            onPressed: d.org == null ? null : () => context.push('/needs'), icon: const Icon(Icons.campaign_outlined), label: const Text('Our needs')),
                      ]),
                    ]),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Wrap(spacing: 12, runSpacing: 12, children: [
                    for (final w in [
                      StatCard(value: d.pending.length, label: 'Pending requests', icon: Icons.hourglass_top_rounded),
                      StatCard(value: d.accepted.length, label: 'Pickups to collect', icon: Icons.local_shipping_rounded, highlight: d.accepted.isNotEmpty),
                      StatCard(value: units, label: 'Units received', icon: Icons.check_circle_rounded),
                      StatCard(value: open, label: 'Open needs', icon: Icons.campaign_rounded),
                    ]) SizedBox(width: (MediaQuery.of(context).size.width - 44) / 2, child: w),
                  ]),
                ),
                if (d.accepted.isNotEmpty)
                  Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 0), child: TapCard(
                    onTap: () => _goTab(context, 2),
                    child: Row(children: [
                      const Icon(Icons.pin_rounded, color: Brand.gold), const SizedBox(width: 12),
                      Expanded(child: Text('${d.accepted.length} pickup${d.accepted.length > 1 ? 's' : ''} ready. Your OTP is in Pickups.', style: t.textTheme.titleMedium)),
                      const Icon(Icons.chevron_right_rounded),
                    ]),
                  )),
                if (n < steps.length)
                  Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 0), child: Card(child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [Expanded(child: Text('Getting started', style: t.textTheme.titleLarge)), Text('$n of ${steps.length}', style: t.textTheme.bodySmall)]),
                      const SizedBox(height: 10),
                      ClipRRect(borderRadius: BorderRadius.circular(3), child: LinearProgressIndicator(value: n / steps.length, minHeight: 6, color: Brand.gold)),
                      for (final s in steps) Padding(padding: const EdgeInsets.only(top: 8), child: Row(children: [
                        Icon(s.$2 ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded, size: 20, color: s.$2 ? t.colorScheme.primary : t.colorScheme.outline),
                        const SizedBox(width: 10), Expanded(child: Text(s.$1)),
                      ])),
                    ]),
                  ))),
                const SectionTitle('Recent requests'),
                if (d.requests.isEmpty) const Pad(Text('Requests you send will appear here.'))
                else for (final r in d.requests.take(5))
                  ListTile(
                    leading: Icon(categoryIcon(r.listing?.category ?? ''), color: t.colorScheme.primary),
                    title: Text(r.listing?.title ?? 'Listing'), subtitle: Text('${r.donor?.name ?? 'Donor'} · ${r.quantity} ${r.listing?.unit ?? ''}'),
                    trailing: StatusChip(r.status),
                  ),
              ]),
            );
          },
        ),
      );
}

// ============================================================ DISCOVER
class DiscoverScreen extends StatefulWidget {
  const DiscoverScreen({super.key});
  @override
  State<DiscoverScreen> createState() => _DiscoverScreenState();
}

class _DiscoverScreenState extends State<DiscoverScreen> {
  final _q = TextEditingController();
  final _deb = Debouncer();
  String? _cat;
  String _sort = 'soonest';
  double _radius = 15;
  ({double lat, double lng})? _pos;
  final _key = GlobalKey<LoaderState<(List<Listing>, List<Representative>)>>();

  @override
  void initState() {
    super.initState();
    final o = AppSession.instance.org;
    if (o?.lat != null && o?.lng != null) _pos = (lat: o!.lat!, lng: o.lng!);
  }

  @override
  void dispose() {
    _deb.dispose();
    super.dispose();
  }

  Future<(List<Listing>, List<Representative>)> _load() async {
    final org = AppSession.instance.org;
    if (org == null || !org.canAct) return (<Listing>[], <Representative>[]);
    final r = await Future.wait<dynamic>([
      DonationService.discover(lat: _pos?.lat, lng: _pos?.lng, radiusKm: _radius, category: _cat),
      OrganizationService.reps(org.id),
    ]);
    return (r[0] as List<Listing>, r[1] as List<Representative>);
  }

  List<Listing> _view(List<Listing> all) {
    final term = _q.text.trim().toLowerCase();
    final xs = all.where((l) => term.isEmpty || [l.title, l.donorName, l.category, l.safetyNotes].whereType<String>().join(' ').toLowerCase().contains(term)).toList();
    switch (_sort) {
      case 'most': xs.sort((a, b) => b.available.compareTo(a.available));
      case 'nearest': xs.sort((a, b) => (a.distanceKm ?? 1e9).compareTo(b.distanceKm ?? 1e9));
      default: xs.sort((a, b) => a.pickupBy.compareTo(b.pickupBy));
    }
    return xs;
  }

  Future<void> _locate() async {
    final p = await LocationService.current();
    final why = p == null ? (await LocationService.ensurePermission() ?? 'Couldn’t read your location.') : null;
    if (!mounted) return;
    if (p == null) { showErr(context, why!); return; }
    setState(() { _pos = (lat: p.latitude, lng: p.longitude); _sort = 'nearest'; });
    _key.currentState?.reload();
  }

  @override
  Widget build(BuildContext context) {
    final org = AppSession.instance.org;
    final ok = org?.canAct ?? false;
    return Scaffold(
      appBar: const TabAppBar(title: 'Discover food'),
      body: !ok
          ? ListView(children: [
              VerifyBanner(onOpenProfile: () => _goTab(context, 4)),
              const EmptyState(icon: Icons.lock_outline_rounded, title: 'Discovery opens after verification',
                  text: 'To protect donors, live listings are only shown to verified, active receivers.'),
            ])
          : Column(children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                child: TextField(
                  controller: _q, onChanged: (_) => _deb(() => setState(() {})),
                  decoration: InputDecoration(
                    hintText: 'Search food, donor or note', prefixIcon: const Icon(Icons.search_rounded),
                    suffixIcon: _q.text.isEmpty ? null : IconButton(onPressed: () { _q.clear(); setState(() {}); }, icon: const Icon(Icons.close_rounded), tooltip: 'Clear search'),
                  ),
                ),
              ),
              SizedBox(
                height: 48,
                child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                  Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: const Text('All'), selected: _cat == null,
                      onSelected: (_) { setState(() => _cat = null); _key.currentState?.reload(); })),
                  for (final c in Domain.categories)
                    Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(label: Text(c), selected: _cat == c,
                        onSelected: (_) { setState(() => _cat = c); _key.currentState?.reload(); })),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 4),
                child: Row(children: [
                  TextButton.icon(onPressed: _locate, icon: Icon(_pos == null ? Icons.my_location_rounded : Icons.gps_fixed_rounded, size: 18),
                      label: Text(_pos == null ? 'Use my location' : 'Within ${_radius.round()} km')),
                  if (_pos != null)
                    PopupMenuButton<double>(
                      tooltip: 'Search radius', icon: const Icon(Icons.tune_rounded, size: 20),
                      onSelected: (v) { setState(() => _radius = v); _key.currentState?.reload(); },
                      itemBuilder: (_) => [for (final r in [5.0, 15.0, 30.0, 50.0]) PopupMenuItem(value: r, child: Text('${r.round()} km'))],
                    ),
                  const Spacer(),
                  DropdownButton<String>(
                    value: _sort, underline: const SizedBox(), borderRadius: BorderRadius.circular(12),
                    items: [
                      const DropdownMenuItem(value: 'soonest', child: Text('Pickup soonest')),
                      const DropdownMenuItem(value: 'most', child: Text('Most available')),
                      if (_pos != null) const DropdownMenuItem(value: 'nearest', child: Text('Nearest')),
                    ],
                    onChanged: (v) => setState(() => _sort = v!),
                  ),
                ]),
              ),
              Expanded(
                child: Loader<(List<Listing>, List<Representative>)>(
                  key: _key, load: _load,
                  builder: (context, d, reload) {
                    final xs = _view(d.$1);
                    return RefreshIndicator(
                      onRefresh: reload,
                      child: xs.isEmpty
                          ? ListView(children: [EmptyState(icon: Icons.no_food_outlined,
                              title: d.$1.isEmpty ? 'No food available right now' : 'No matches',
                              text: d.$1.isEmpty ? 'New listings appear here the moment verified donors publish them.' : 'Try another search or category.')])
                          : ListView.separated(
                              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24), itemCount: xs.length + 1,
                              separatorBuilder: (_, _) => const SizedBox(height: 14),
                              itemBuilder: (_, i) => i == 0
                                  ? Text('${xs.length} listing${xs.length == 1 ? '' : 's'}', style: Theme.of(context).textTheme.labelSmall)
                                  : ListingCard(xs[i - 1], showDonor: true, onTap: () => showRequestSheet(context, xs[i - 1], d.$2),
                                      footer: SizedBox(width: double.infinity, child: FilledButton.tonalIcon(
                                        onPressed: () => showRequestSheet(context, xs[i - 1], d.$2), icon: const Icon(Icons.add_shopping_cart_rounded), label: const Text('Request food')))),
                            ),
                    );
                  },
                ),
              ),
            ]),
    );
  }
}

/// Listing details + request form. Validates locally, then calls create_request (server re-checks everything).
Future<void> showRequestSheet(BuildContext context, Listing l, List<Representative> reps) {
  final qty = TextEditingController(text: '${l.available < 10 ? l.available : 10}');
  String? rep = reps.isEmpty ? null : reps.first.id;
  return showModalBottomSheet(
    context: context, isScrollControlled: true,
    builder: (c) => StatefulBuilder(builder: (c, set) {
      final t = Theme.of(c);
      return Padding(
        padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 24),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          ClipRRect(borderRadius: BorderRadius.circular(16), child: ListingPhoto(l, height: 160)),
          const SizedBox(height: 14),
          Text(l.category.toUpperCase(), style: t.textTheme.labelSmall),
          Text(l.title, style: t.textTheme.headlineSmall),
          const SizedBox(height: 8),
          AvailabilityBar(l),
          InfoRow(Icons.storefront_rounded, l.donorName ?? 'Verified donor'),
          if (l.donorAddress != null) InfoRow(Icons.place_outlined, l.donorAddress!),
          if (l.distanceKm != null) InfoRow(Icons.near_me_outlined, '${l.distanceKm!.toStringAsFixed(1)} km away'),
          InfoRow(Icons.schedule_rounded, 'Collect by ${fmtDT(l.pickupBy)} (${timeLeft(l.pickupBy)})'),
          InfoRow(Icons.soup_kitchen_outlined, 'Prepared ${fmtDT(l.preparedAt)}'),
          if (l.safetyNotes != null) InfoRow(Icons.health_and_safety_outlined, l.safetyNotes!),
          const SizedBox(height: 18),
          if (reps.isEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: t.colorScheme.secondaryContainer, borderRadius: BorderRadius.circular(12)),
              child: const Text('Add a pickup representative in Profile first. You choose who collects each pickup.'),
            )
          else ...[
            Row(children: [
              SizedBox(width: 120, child: TextField(controller: qty, keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: 'Quantity', helperText: 'max ${l.available}'))),
              const SizedBox(width: 12),
              Expanded(child: DropdownButtonFormField<String>(
                initialValue: rep, decoration: const InputDecoration(labelText: 'Representative'),
                items: [for (final r in reps) DropdownMenuItem(value: r.id, child: Text(r.name, overflow: TextOverflow.ellipsis))],
                onChanged: (v) => set(() => rep = v),
              )),
            ]),
            const SizedBox(height: 16),
            BusyButton(expand: true, icon: Icons.send_rounded, onPressed: () async {
              final q = int.tryParse(qty.text.trim());
              if (q == null || q < 1 || q > l.available) throw Exception('Choose a quantity between 1 and ${l.available}.');
              if (rep == null) throw Exception('Choose a pickup representative.');
              await RequestService.create(l.id, q, rep!);
              if (!c.mounted) return;
              Navigator.pop(c);
              showOk(context, 'Request sent to the donor.');
              AppSession.instance.touch();
            }, child: const Text('Send request')),
          ],
        ])),
      );
    }),
  );
}

// ============================================================ REQUESTS / PICKUPS
class ReceiverRequests extends StatelessWidget {
  const ReceiverRequests({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(
        length: 3,
        child: Scaffold(
          appBar: const TabAppBar(title: 'Requests & pickups', bottom: TabBar(tabs: [Tab(text: 'Pending'), Tab(text: 'Pickups'), Tab(text: 'History')])),
          body: Loader<ReceiverData>(
            load: ReceiverData.load,
            builder: (context, d, reload) => TabBarView(children: [
              _list(d.pending, reload, ('No pending requests', 'Browse Discover to request food from verified donors.', Icons.hourglass_empty_rounded),
                  (r) => _PendingCard(r: r, org: d.org!)),
              _list(d.accepted, reload, ('No pickups yet', 'When a donor accepts, your pickup OTP appears here.', Icons.local_shipping_outlined),
                  (r) => _ReceiverPickupCard(r: r, otp: d.otps[r.id])),
              _list(d.requests.where((r) => const ['completed', 'rejected', 'cancelled'].contains(r.status)).toList(), reload,
                  ('No history yet', 'Completed, rejected and cancelled requests are kept here.', Icons.history_rounded),
                  (r) => _ReceiverHistoryCard(r: r, org: d.org!)),
            ]),
          ),
        ),
      );

  Widget _list(List<FoodRequest> xs, Future<void> Function() reload, (String, String, IconData) e, Widget Function(FoodRequest) item) =>
      RefreshIndicator(
        onRefresh: reload,
        child: xs.isEmpty
            ? ListView(children: [EmptyState(icon: e.$3, title: e.$1, text: e.$2)])
            : ListView.separated(padding: const EdgeInsets.all(16), itemCount: xs.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12), itemBuilder: (_, i) => item(xs[i])),
      );
}

Future<void> _cancel(BuildContext c, FoodRequest r) async {
  if (!await confirm(c, title: 'Cancel this request?', text: r.status == 'accepted' ? 'The reserved food will be released and the donor notified.' : 'The donor will be notified.', cta: 'Cancel request', danger: true)) return;
  await RequestService.cancel(r.id);
  LocationService.stop(r.id);
  if (c.mounted) showOk(c, 'Request cancelled.');
  AppSession.instance.touch();
}

class _PendingCard extends StatelessWidget {
  final FoodRequest r;
  final Organization org;
  const _PendingCard({required this.r, required this.org});
  @override
  Widget build(BuildContext context) => Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          RequestHeader(title: r.listing?.title ?? 'Listing', status: r.status,
              subtitle: '${r.donor?.name ?? 'Donor'} · ${r.quantity} ${r.listing?.unit ?? ''} requested · rep: ${r.repName ?? '—'}'),
          if (r.listing != null) InfoRow(Icons.schedule_rounded, 'Pickup by ${fmtDT(r.listing!.pickupBy)}'),
          const SizedBox(height: 8),
          Wrap(spacing: 4, children: [
            BusyButton(outlined: true, danger: true, onPressed: () => _cancel(context, r), child: const Text('Cancel')),
            TextButton.icon(onPressed: () => openChat(context, r, r.donor?.name ?? 'Donor', side: 'ngo'), icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18), label: const Text('Message')),
            if (r.listing != null) TextButton.icon(onPressed: () => showReportSheet(context, reporterOrg: org.id, reportedOrg: r.listing!.donorOrgId, requestId: r.id, name: r.donor?.name),
                icon: const Icon(Icons.flag_outlined, size: 18), label: const Text('Report')),
          ]),
        ]),
      ));
}

class _ReceiverPickupCard extends StatefulWidget {
  final FoodRequest r;
  final PickupOtp? otp;
  const _ReceiverPickupCard({required this.r, this.otp});
  @override
  State<_ReceiverPickupCard> createState() => _ReceiverPickupCardState();
}

class _ReceiverPickupCardState extends State<_ReceiverPickupCard> {
  @override
  Widget build(BuildContext context) {
    final r = widget.r;
    return Card(child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        RequestHeader(title: r.listing?.title ?? 'Pickup', status: r.status == 'accepted' ? 'accepted' : 'collected', subtitle: '${r.donor?.name ?? 'Donor'} · collect ${r.quantity} ${r.listing?.unit ?? ''}'),
        if (r.donor?.address != null) InfoRow(Icons.place_outlined, r.donor!.address!),
        InfoRow(Icons.badge_outlined, 'Representative: ${r.repName ?? '—'}'),
        if (r.listing != null && r.status == 'accepted') InfoRow(Icons.schedule_rounded, 'Collect by ${fmtDT(r.listing!.pickupBy)}'),
        if (r.status == 'accepted') ...[
          const SizedBox(height: 10),
          Container(
            width: double.infinity, padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(color: Brand.forest, borderRadius: BorderRadius.circular(18)),
            child: Column(children: [
              Text('PICKUP OTP · SHOW IT TO THE DONOR', style: TextStyle(color: Brand.cream.withValues(alpha: .75), fontSize: 11, letterSpacing: 1.4, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              Semantics(label: 'Pickup code ${widget.otp?.otp.split('').join(' ') ?? 'not available'}',
                  child: Text(widget.otp?.otp ?? '····', style: const TextStyle(fontFamily: serif, fontSize: 52, letterSpacing: 16, color: Brand.gold, height: 1))),
              if (widget.otp?.expiresAt != null) ...[
                const SizedBox(height: 8),
                Text('Valid until ${fmtDT(widget.otp!.expiresAt)}', style: TextStyle(color: Brand.cream.withValues(alpha: .7), fontSize: 12)),
              ],
            ]),
          ),
        ],
        LiveTrackCard(r: r, donor: r.donor, ngo: AppSession.instance.org, viewer: 'ngo',
            onMessage: () => openChat(context, r, r.donor?.name ?? 'Donor', side: 'ngo')),
        const SizedBox(height: 8),
        Wrap(spacing: 4, children: [
          if (r.donor != null) TextButton.icon(onPressed: () => openDirections(context, orgPoint(r.donor), r.donor?.address),
              icon: const Icon(Icons.directions_rounded, size: 18), label: const Text('Donor on map')),
          if (r.status == 'accepted') BusyButton(outlined: true, danger: true, onPressed: () => _cancel(context, r), child: const Text('Cancel pickup')),
        ]),
      ]),
    ));
  }
}

class _ReceiverHistoryCard extends StatelessWidget {
  final FoodRequest r;
  final Organization org;
  const _ReceiverHistoryCard({required this.r, required this.org});
  @override
  Widget build(BuildContext context) => Card(child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          RequestHeader(title: r.listing?.title ?? 'Listing', status: r.status,
              subtitle: '${r.donor?.name ?? 'Donor'} · ${r.quantity} ${r.listing?.unit ?? ''} · ${fmtD(r.completedAt ?? r.createdAt)}'),
          Row(children: [
            if (r.canMessage) TextButton.icon(onPressed: () => openChat(context, r, r.donor?.name ?? 'Donor', side: 'ngo'), icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18), label: const Text('Message')),
            if (r.listing != null) TextButton.icon(onPressed: () => showReportSheet(context, reporterOrg: org.id, reportedOrg: r.listing!.donorOrgId, requestId: r.id, name: r.donor?.name),
                icon: const Icon(Icons.flag_outlined, size: 18), label: const Text('Report')),
          ]),
        ]),
      ));
}
