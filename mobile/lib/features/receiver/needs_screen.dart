import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/services/donation_service.dart';
import '../../core/services/session.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';

/// Receiver "needs" (table `requirements`): tell donors what your community needs.
class NeedsScreen extends StatefulWidget {
  const NeedsScreen({super.key});
  @override
  State<NeedsScreen> createState() => _NeedsScreenState();
}

class _NeedsScreenState extends State<NeedsScreen> {
  final _f = GlobalKey<FormState>();
  final _title = TextEditingController(), _qty = TextEditingController();
  DateTime _by = DateTime.now().add(const Duration(days: 1));

  @override
  Widget build(BuildContext context) {
    final org = AppSession.instance.org!;
    final ok = org.canAct;
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Community needs')),
      body: Loader<List<Requirement>>(
        load: () => DonationService.myNeeds(org.id),
        builder: (context, needs, reload) => RefreshIndicator(
          onRefresh: reload,
          child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 32), children: [
            Card(child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(key: _f, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('Publish a requirement', style: t.textTheme.titleLarge),
                Text('Verified donors see open needs on their home screen.', style: t.textTheme.bodySmall),
                const SizedBox(height: 14),
                TextFormField(controller: _title, maxLength: 80, validator: (v) => V.minLen(v, 2, 'Description'),
                    decoration: const InputDecoration(labelText: 'What do you need?', hintText: 'e.g. Cooked meals for 80 people')),
                Row(children: [
                  Expanded(child: TextFormField(controller: _qty, keyboardType: TextInputType.number, validator: (v) => V.intRange(v, 1, 100000, 'Quantity'),
                      decoration: const InputDecoration(labelText: 'Quantity'))),
                  const SizedBox(width: 12),
                  Expanded(child: InkWell(
                    onTap: () async {
                      final d = await showDatePicker(context: context, initialDate: _by, firstDate: DateTime.now(), lastDate: DateTime.now().add(const Duration(days: 60)));
                      if (d != null) setState(() => _by = DateTime(d.year, d.month, d.day, 18));
                    },
                    child: InputDecorator(decoration: const InputDecoration(labelText: 'Needed by'), child: Text(fmtD(_by))),
                  )),
                ]),
                const SizedBox(height: 14),
                BusyButton(expand: true, onPressed: ok ? () async {
                  if (!_f.currentState!.validate()) return;
                  final q = int.tryParse(_qty.text.trim());
                  if (_title.text.trim().length < 2) throw Exception('Describe what you need.');
                  if (q == null || q < 1) throw Exception('Quantity must be at least 1.');
                  if (!_by.isAfter(DateTime.now())) throw Exception('Needed-by time must be in the future.');
                  await DonationService.addNeed(org.id, _title.text, q, _by);
                  _title.clear(); _qty.clear();
                  if (context.mounted) showOk(context, 'Requirement published. Donors can now see it.');
                  await reload();
                } : null, child: Text(ok ? 'Publish need' : 'Verification is required')),
              ])),
            )),
            const SizedBox(height: 8),
            if (needs.isEmpty)
              const EmptyState(icon: Icons.campaign_outlined, title: 'No requirements yet', text: 'Publish what your community needs and donors will see it.')
            else
              for (final n in needs)
                Padding(padding: const EdgeInsets.only(top: 10), child: Card(child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [Expanded(child: Text(n.title, style: t.textTheme.titleMedium)), StatusChip(n.status)]),
                    const SizedBox(height: 4),
                    Text('${n.quantity} needed by ${fmtDT(n.neededBy)}', style: t.textTheme.bodySmall),
                    Row(children: [
                      if (n.status == 'open') TextButton(onPressed: () => guard(context, () async { await DonationService.fulfilNeed(n.id); await reload(); }, ok: 'Marked as fulfilled.'),
                          child: const Text('Mark fulfilled')),
                      TextButton(onPressed: () async {
                        if (await confirm(context, title: 'Delete this need?', text: 'Donors will no longer see it.', cta: 'Delete', danger: true) && context.mounted) {
                          await guard(context, () async { await DonationService.deleteNeed(n.id); await reload(); }, ok: 'Deleted.');
                        }
                      }, child: Text('Delete', style: TextStyle(color: t.colorScheme.error))),
                    ]),
                  ]),
                ))),
          ]),
        ),
      ),
    );
  }
}
