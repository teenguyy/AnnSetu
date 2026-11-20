import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/env.dart';
import '../../core/models/models.dart';
import '../../core/services/location_service.dart';
import '../../core/services/supabase_service.dart';
import '../../core/services/tracking_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';
import '../requests/request_widgets.dart' show callNumber;

const _steps = [
  ('assigned', 'Pickup confirmed', 'Representative assigned', Icons.person_pin_rounded),
  ('on_the_way', 'On the way', 'Trip started to the donor', Icons.local_shipping_rounded),
  ('arrived', 'Reached donor', 'At the pickup point', Icons.place_rounded),
  ('collected', 'Food collected', 'OTP confirmed by the donor', Icons.inventory_2_rounded),
  ('delivered', 'Delivered', 'Handed over at the NGO', Icons.home_rounded),
];

DateTime? _stamp(FoodRequest r, String k) => switch (k) {
      'assigned' => r.createdAt,
      'on_the_way' => r.tripStartedAt,
      'arrived' => r.arrivedAt,
      'collected' => r.collectedAt,
      _ => r.deliveredAt,
    };

/// The five confirmed steps with their times (like food-delivery apps).
class TripSteps extends StatelessWidget {
  final FoodRequest r;
  const TripSteps(this.r, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final cur = _steps.indexWhere((s) => s.$1 == r.tripStatus).clamp(0, _steps.length - 1);
    return Column(children: [
      for (var i = 0; i < _steps.length; i++)
        IntrinsicHeight(
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Column(children: [
              Container(
                width: 30, height: 30,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: i < cur ? Brand.forest : i == cur ? Brand.gold : t.colorScheme.surface,
                  border: Border.all(color: i <= cur ? (i < cur ? Brand.forest : Brand.gold) : t.dividerColor, width: 2),
                ),
                child: Icon(i < cur ? Icons.check_rounded : _steps[i].$4, size: 16,
                    color: i < cur ? Colors.white : i == cur ? Brand.dark : t.hintColor),
              ),
              if (i < _steps.length - 1) Expanded(child: Container(width: 2, color: i < cur ? Brand.forest : t.dividerColor)),
            ]),
            const SizedBox(width: 12),
            Expanded(child: Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(_steps[i].$2, style: TextStyle(fontWeight: i <= cur ? FontWeight.w700 : FontWeight.w500, color: i <= cur ? null : t.hintColor)),
                Text(i <= cur && _stamp(r, _steps[i].$1) != null ? fmtT(_stamp(r, _steps[i].$1)) : _steps[i].$3, style: t.textTheme.bodySmall),
              ]),
            )),
          ]),
        ),
    ]);
  }
}

/// OpenStreetMap map: donor (D), NGO (N), representative (moving dot), road route.
class TrackMap extends StatelessWidget {
  final LatLng? donor, ngo, rep;
  final List<LatLng> route;
  const TrackMap({super.key, this.donor, this.ngo, this.rep, this.route = const []});
  @override
  Widget build(BuildContext context) {
    final pts = [donor, ngo, rep].whereType<LatLng>().toList();
    if (pts.isEmpty) {
      return Container(
        height: 120, alignment: Alignment.center,
        decoration: BoxDecoration(color: Theme.of(context).colorScheme.surface, borderRadius: BorderRadius.circular(16)),
        child: Text('No map location saved yet', style: Theme.of(context).textTheme.bodySmall),
      );
    }
    final fit = pts.length > 1
        ? MapOptions(initialCameraFit: CameraFit.bounds(bounds: LatLngBounds.fromPoints(pts), padding: const EdgeInsets.all(40), maxZoom: 16))
        : MapOptions(initialCenter: pts.first, initialZoom: 15);
    Widget pin(String l, Color c) => Container(
          decoration: BoxDecoration(color: c, shape: BoxShape.circle, border: Border.all(color: Brand.dark, width: 2)),
          alignment: Alignment.center,
          child: Text(l, style: const TextStyle(fontWeight: FontWeight.w800, color: Brand.dark)),
        );
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: 230,
        child: FlutterMap(
          key: ValueKey(pts.map((p) => '${p.latitude.toStringAsFixed(4)},${p.longitude.toStringAsFixed(4)}').join('|')),
          options: fit,
          children: [
            TileLayer(urlTemplate: Env.osmTiles, userAgentPackageName: 'app.annsetu'),
            if (route.length > 1) PolylineLayer(polylines: [Polyline(points: route, strokeWidth: 5, color: Brand.forest)]),
            MarkerLayer(markers: [
              if (donor != null) Marker(point: donor!, width: 32, height: 32, child: pin('D', Brand.gold)),
              if (ngo != null) Marker(point: ngo!, width: 32, height: 32, child: pin('N', Brand.sky)),
              if (rep != null) Marker(point: rep!, width: 24, height: 24, child: Container(
                decoration: BoxDecoration(color: Brand.sage, shape: BoxShape.circle, border: Border.all(color: Colors.white, width: 3),
                    boxShadow: [BoxShadow(color: Brand.sage.withValues(alpha: .35), blurRadius: 10, spreadRadius: 4)]))),
            ]),
            const RichAttributionWidget(attributions: [TextSourceAttribution('OpenStreetMap contributors')]),
          ],
        ),
      ),
    );
  }
}

/// Opens turn-by-turn navigation in the phone's maps app (free).
Future<void> openDirections(BuildContext c, LatLng? to, String? address) async {
  final q = to != null ? '${to.latitude},${to.longitude}' : (address ?? '');
  if (q.isEmpty) return showErr(c, 'No location saved for this place.');
  final ok = await launchUrl(Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${Uri.encodeComponent(q)}'), mode: LaunchMode.externalApplication);
  if (!ok && c.mounted) showErr(c, 'Could not open maps.');
}

/// Donor / receiver view: live map + ETA + steps + call / message.
class LiveTrackCard extends StatefulWidget {
  final FoodRequest r;
  final Organization? donor, ngo;
  final String viewer; // donor | ngo
  final VoidCallback? onMessage;
  const LiveTrackCard({super.key, required this.r, this.donor, this.ngo, required this.viewer, this.onMessage});
  @override
  State<LiveTrackCard> createState() => _LiveTrackCardState();
}

class _LiveTrackCardState extends State<LiveTrackCard> {
  RepLocation? _loc;
  RouteInfo? _route;
  LatLng? _routedFrom;
  DateTime _routedAt = DateTime(2000);
  RealtimeChannel? _ch;
  Timer? _poll;

  @override
  void initState() {
    super.initState();
    if (widget.r.inTransit) {
      _load();
      _ch = TrackingService.watchLocation(widget.r.id, _load);
      _poll = Timer.periodic(const Duration(seconds: 8), (_) => _load());
    }
  }

  @override
  void dispose() {
    _poll?.cancel();
    if (_ch != null) db.removeChannel(_ch!);
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final l = await TrackingService.location(widget.r.id);
      if (!mounted) return;
      setState(() => _loc = l);
      final dest = widget.r.tripStatus == 'collected' ? orgPoint(widget.ngo) : orgPoint(widget.donor);
      if (l != null && dest != null) {
        final here = LatLng(l.lat, l.lng);
        final moved = _routedFrom == null ? 99.0 : kmBetween(_routedFrom!, here);
        if (moved > .25 || DateTime.now().difference(_routedAt).inSeconds > 45) {
          _routedFrom = here; _routedAt = DateTime.now();
          final rt = await TrackingService.route(here, dest);
          if (mounted) setState(() => _route = rt);
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.r, t = Theme.of(context);
    final who = r.repName ?? 'The representative';
    final head = switch (r.tripStatus) {
      'delivered' => 'Delivered to ${widget.ngo?.name ?? 'the NGO'}',
      'collected' => 'Food collected · heading to ${widget.ngo?.name ?? 'the NGO'}',
      'arrived' => '$who has reached the donor',
      'on_the_way' => '$who is on the way',
      _ => 'Waiting for the representative to start the trip',
    };
    final fresh = _loc?.updatedAt != null && DateTime.now().difference(_loc!.updatedAt!).inMinutes < 2;
    final eta = (_route != null && (r.tripStatus == 'on_the_way' || r.tripStatus == 'collected'))
        ? '${_route!.rough ? '~' : ''}${_route!.mins} min · ${_route!.km.toStringAsFixed(1)} km'
        : (r.eta != null && r.tripStatus == 'on_the_way' ? 'ETA ${fmtT(r.eta)}' : null);
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: t.colorScheme.surfaceContainerHighest.withValues(alpha: .5), borderRadius: BorderRadius.circular(20), border: Border.all(color: t.dividerColor)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(head, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        if (eta != null) Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(color: Brand.dark, borderRadius: BorderRadius.circular(99)),
            child: Text(r.tripStatus == 'collected' ? 'To NGO: $eta' : 'Arriving in $eta', style: const TextStyle(color: Brand.gold, fontWeight: FontWeight.w700, fontSize: 13)),
          ),
        ),
        if (r.inTransit) Padding(
          padding: const EdgeInsets.only(top: 6),
          child: Text(fresh ? '● Live · updated ${ago(_loc!.updatedAt!)}' : 'Live location appears when the representative shares it',
              style: t.textTheme.bodySmall?.copyWith(color: fresh ? Colors.green.shade700 : null, fontWeight: fresh ? FontWeight.w700 : null)),
        ),
        if (r.inTransit) ...[
          const SizedBox(height: 10),
          TrackMap(donor: orgPoint(widget.donor), ngo: orgPoint(widget.ngo), rep: _loc == null ? null : LatLng(_loc!.lat, _loc!.lng), route: _route?.path ?? const []),
        ],
        const SizedBox(height: 12),
        TripSteps(r),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (r.repPhone != null)
            FilledButton.icon(onPressed: () => callNumber(context, r.repPhone), icon: const Icon(Icons.call_rounded, size: 18), label: Text('Call ${r.repName ?? 'representative'}')),
          if (widget.viewer != 'donor' && widget.donor?.phone != null)
            OutlinedButton.icon(onPressed: () => callNumber(context, widget.donor!.phone), icon: const Icon(Icons.call_rounded, size: 18), label: const Text('Call donor')),
          if (widget.viewer != 'ngo' && widget.ngo?.phone != null)
            OutlinedButton.icon(onPressed: () => callNumber(context, widget.ngo!.phone), icon: const Icon(Icons.call_rounded, size: 18), label: const Text('Call NGO')),
          if (widget.onMessage != null)
            OutlinedButton.icon(onPressed: widget.onMessage, icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18), label: const Text('Message')),
        ]),
      ]),
    );
  }
}

/// Representative view: own live position, route, step buttons, automatic location sharing.
class RepTripPanel extends StatefulWidget {
  final RepPickup p;
  final Future<void> Function() onChanged;
  final VoidCallback onMessage;
  const RepTripPanel({super.key, required this.p, required this.onChanged, required this.onMessage});
  @override
  State<RepTripPanel> createState() => _RepTripPanelState();
}

class _RepTripPanelState extends State<RepTripPanel> {
  LatLng? _me;
  RouteInfo? _route;
  LatLng? _routedFrom;
  StreamSubscription<Position>? _pos;
  bool get _moving => widget.p.inTransit && widget.p.tripStatus != 'assigned';
  bool get _sharing => LocationService.isSharing(widget.p.id);

  @override
  void initState() {
    super.initState();
    if (_moving) _startSharing(quiet: true);
    _watchMe();
  }

  @override
  void didUpdateWidget(covariant RepTripPanel old) {
    super.didUpdateWidget(old);
    if (!widget.p.inTransit) { LocationService.stop(widget.p.id); }
  }

  @override
  void dispose() {
    _pos?.cancel();
    super.dispose();
  }

  Future<void> _watchMe() async {
    if (await LocationService.ensurePermission() != null) return;
    _pos = Geolocator.getPositionStream(locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 25)).listen((p) async {
      final here = LatLng(p.latitude, p.longitude);
      if (!mounted) return;
      setState(() => _me = here);
      final dest = widget.p.tripStatus == 'collected' ? widget.p.ngo : widget.p.donor;
      if (dest != null && (_routedFrom == null || kmBetween(_routedFrom!, here) > .25)) {
        _routedFrom = here;
        final rt = await TrackingService.route(here, dest);
        if (mounted) setState(() => _route = rt);
      }
    });
  }

  Future<void> _startSharing({bool quiet = false}) async {
    if (_sharing) return;
    final err = await LocationService.start(widget.p.id, onError: (e) { if (mounted && !quiet) showErr(context, e); });
    if (err != null && mounted && !quiet) showErr(context, err);
    if (mounted) setState(() {});
  }

  Future<void> _go(String status) async {
    try {
      DateTime? eta;
      if (status == 'on_the_way') eta = DateTime.now().add(Duration(minutes: _route?.mins ?? 20));
      await TrackingService.setTrip(widget.p.id, status, eta: eta);
      if (status == 'on_the_way') await _startSharing();
      if (status == 'delivered') LocationService.stop(widget.p.id);
      if (mounted) {
        showOk(context, switch (status) {
          'on_the_way' => 'Trip started. The donor and NGO can track you live.',
          'arrived' => 'Donor and NGO notified: you have reached.',
          _ => 'Delivered! Thank you.',
        });
      }
      await widget.onChanged();
    } catch (e) {
      if (mounted) showErr(context, e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final p = widget.p, t = Theme.of(context);
    final st = p.tripStatus;
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: t.colorScheme.surfaceContainerHighest.withValues(alpha: .5), borderRadius: BorderRadius.circular(20), border: Border.all(color: t.dividerColor)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(switch (st) {
          'assigned' => 'Ready when you are',
          'on_the_way' => 'Heading to ${p.donorName}',
          'arrived' => 'Show the OTP to the donor',
          'collected' => 'Take the food to ${p.ngoName}',
          _ => 'Delivered',
        }, style: t.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
        if (_route != null && (st == 'on_the_way' || st == 'collected'))
          Padding(padding: const EdgeInsets.only(top: 6), child: Text('${_route!.rough ? '~' : ''}${_route!.mins} min · ${_route!.km.toStringAsFixed(1)} km',
              style: const TextStyle(fontWeight: FontWeight.w700))),
        if (_moving) Padding(padding: const EdgeInsets.only(top: 4), child: Text(_sharing ? '● Sharing your live location' : 'Location sharing is off',
            style: t.textTheme.bodySmall?.copyWith(color: _sharing ? Colors.green.shade700 : null, fontWeight: FontWeight.w700))),
        const SizedBox(height: 10),
        if (p.inTransit) TrackMap(donor: p.donor, ngo: p.ngo, rep: _me, route: _route?.path ?? const []),
        const SizedBox(height: 12),
        TripSteps(p.asRequest()),
        Wrap(spacing: 8, runSpacing: 8, children: [
          if (st == 'assigned' && p.status == 'accepted') FilledButton.icon(onPressed: () => _go('on_the_way'), icon: const Icon(Icons.navigation_rounded), label: const Text('Start trip')),
          if (st == 'on_the_way') FilledButton.icon(onPressed: () => _go('arrived'), icon: const Icon(Icons.place_rounded), label: const Text('I’ve reached the donor')),
          if (st == 'collected') FilledButton.icon(onPressed: () => _go('delivered'), icon: const Icon(Icons.home_rounded), label: const Text('Delivered to NGO')),
          if (_moving && !_sharing) OutlinedButton.icon(onPressed: _startSharing, icon: const Icon(Icons.my_location_rounded), label: const Text('Share live location')),
          if (p.inTransit) OutlinedButton.icon(
              onPressed: () => openDirections(context, st == 'collected' ? p.ngo : p.donor, st == 'collected' ? p.ngoAddress : p.donorAddress),
              icon: const Icon(Icons.directions_rounded), label: Text(st == 'collected' ? 'Directions to NGO' : 'Directions to donor')),
          if (p.donorPhone != null) OutlinedButton.icon(onPressed: () => callNumber(context, p.donorPhone), icon: const Icon(Icons.call_rounded, size: 18), label: const Text('Call donor')),
          if (p.ngoPhone != null) OutlinedButton.icon(onPressed: () => callNumber(context, p.ngoPhone), icon: const Icon(Icons.call_rounded, size: 18), label: const Text('Call NGO')),
          OutlinedButton.icon(onPressed: widget.onMessage, icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18), label: const Text('Message')),
        ]),
      ]),
    );
  }
}
