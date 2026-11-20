import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/domain.dart';
import '../../core/models/models.dart';
import '../../core/services/request_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';

/// Report another organisation to the admins (table `reports`, same reasons as the website).
Future<void> showReportSheet(BuildContext context, {required String reporterOrg, required String reportedOrg, String? requestId, String? name}) {
  String reason = 'unsafe_food';
  final details = TextEditingController();
  return showModalBottomSheet(
    context: context, isScrollControlled: true,
    builder: (c) => StatefulBuilder(builder: (c, set) => Padding(
      padding: EdgeInsets.fromLTRB(20, 0, 20, MediaQuery.of(c).viewInsets.bottom + 24),
      child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text('Report ${name ?? 'organisation'}', style: Theme.of(c).textTheme.headlineSmall),
        const SizedBox(height: 6),
        Text('Reports go to AnnSetu admins. Please share only what you directly experienced.', style: Theme.of(c).textTheme.bodySmall),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          initialValue: reason, decoration: const InputDecoration(labelText: 'Reason'),
          items: [for (final e in Domain.reportReasons.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
          onChanged: (v) => set(() => reason = v!),
        ),
        const SizedBox(height: 12),
        TextField(controller: details, maxLines: 4, maxLength: 1000, decoration: const InputDecoration(labelText: 'What happened?')),
        const SizedBox(height: 8),
        BusyButton(expand: true, icon: Icons.flag_rounded, onPressed: () async {
          try {
            await RequestService.report(reporterOrg: reporterOrg, reportedOrg: reportedOrg, requestId: requestId, reason: reason, details: details.text);
          } catch (e) {
            if (RegExp('duplicate|one_open_report').hasMatch('$e')) throw Exception('You already have an open report for this reason.');
            rethrow;
          }
          if (c.mounted) { Navigator.pop(c); showOk(context, 'Report sent to the admins. Thank you.'); }
        }, child: const Text('Send report')),
      ]),
    )),
  );
}

/// Live representative position on OpenStreetMap (visible only to the two organisations and admins via RLS).
class RepLocationCard extends StatelessWidget {
  final RepLocation loc;
  const RepLocationCard(this.loc, {super.key});
  @override
  Widget build(BuildContext context) {
    final p = LatLng(loc.lat, loc.lng);
    final t = Theme.of(context);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: SizedBox(
          height: 170,
          child: FlutterMap(
            options: MapOptions(initialCenter: p, initialZoom: 15, interactionOptions: const InteractionOptions(flags: InteractiveFlag.pinchZoom | InteractiveFlag.drag)),
            children: [
              TileLayer(urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', userAgentPackageName: 'app.annsetu'),
              MarkerLayer(markers: [Marker(point: p, width: 44, height: 44, child: Container(
                decoration: BoxDecoration(color: Brand.gold, shape: BoxShape.circle, border: Border.all(color: Brand.forest, width: 3)),
                child: const Icon(Icons.directions_walk_rounded, color: Brand.dark, size: 22),
              ))]),
              const SimpleAttributionWidget(source: Text('OpenStreetMap contributors')),
            ],
          ),
        ),
      ),
      const SizedBox(height: 8),
      Row(children: [
        Icon(Icons.my_location_rounded, size: 16, color: t.colorScheme.primary),
        const SizedBox(width: 6),
        Expanded(child: Text('Representative location${loc.updatedAt != null ? ' · updated ${ago(loc.updatedAt!)}' : ''}', style: t.textTheme.bodySmall)),
        TextButton.icon(
          onPressed: () => launchUrl(Uri.parse('https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}'), mode: LaunchMode.externalApplication),
          icon: const Icon(Icons.open_in_new_rounded, size: 16), label: const Text('Open map'),
        ),
      ]),
    ]);
  }
}

Future<void> callNumber(BuildContext c, String? phone) async {
  if (phone == null || phone.isEmpty) return;
  final ok = await launchUrl(Uri(scheme: 'tel', path: phone));
  if (!ok && c.mounted) showErr(c, 'Could not open the dialer.');
}

/// Compact request summary line used in many cards.
class RequestHeader extends StatelessWidget {
  final String title, subtitle, status;
  final Widget? leading;
  const RequestHeader({super.key, required this.title, required this.subtitle, required this.status, this.leading});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (leading != null) ...[leading!, const SizedBox(width: 12)],
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: t.textTheme.titleLarge?.copyWith(fontSize: 18)),
        const SizedBox(height: 4),
        Text(subtitle, style: t.textTheme.bodySmall),
      ])),
      const SizedBox(width: 8),
      StatusChip(status),
    ]);
  }
}
