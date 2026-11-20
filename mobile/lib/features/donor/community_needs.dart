import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/models/models.dart';
import '../../core/services/donation_service.dart';
import '../../core/services/organization_service.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/common.dart';
import '../requests/request_widgets.dart' show callNumber;

/// Every open need published by verified receivers. Donors can list matching food in one tap.
class CommunityNeedsScreen extends StatefulWidget {
  const CommunityNeedsScreen({super.key});
  @override
  State<CommunityNeedsScreen> createState() => _CommunityNeedsScreenState();
}

class _CommunityNeedsScreenState extends State<CommunityNeedsScreen> {
  List<Requirement>? _needs;
  Map<String, Organization> _orgs = {};
  Object? _err;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final n = await DonationService.openNeeds();
      final o = await OrganizationService.byIds(n.map((x) => x.ngoOrgId));
      if (mounted) setState(() { _needs = n; _orgs = o; _err = null; });
    } catch (e) {
      if (mounted) setState(() => _err = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Community needs')),
      body: _needs == null
          ? (_err != null ? ErrorState(error: _err!, onRetry: _load) : const Center(child: BridgeLoader()))
          : _needs!.isEmpty
              ? const EmptyState(icon: Icons.volunteer_activism_outlined, title: 'No open needs', text: 'When receivers ask for food, it shows up here.')
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _needs!.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final n = _needs![i];
                      final o = _orgs[n.ngoOrgId];
                      return Card(child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(n.title, style: t.textTheme.titleMedium),
                          const SizedBox(height: 4),
                          Text('${n.quantity} needed by ${fmtDT(n.neededBy)}', style: t.textTheme.bodyMedium),
                          Text([o?.name ?? n.ngoName ?? 'Verified receiver', if (o?.areaServed != null) 'serves ${o!.areaServed}'].join(' · '), style: t.textTheme.bodySmall),
                          const SizedBox(height: 10),
                          Wrap(spacing: 8, children: [
                            FilledButton.icon(
                              onPressed: () => context.push(Uri(path: '/listing/new', queryParameters: {'title': n.title, 'qty': '${n.quantity}'}).toString()),
                              icon: const Icon(Icons.add_rounded), label: const Text('List food for this need')),
                            if (o != null && o.phone != null) OutlinedButton.icon(onPressed: () => callNumber(context, o.phone), icon: const Icon(Icons.call_rounded, size: 18), label: Text('Call ${o.name}')),
                          ]),
                        ]),
                      ));
                    },
                  ),
                ),
    );
  }
}
