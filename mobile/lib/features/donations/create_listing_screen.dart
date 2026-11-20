import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/domain.dart';
import '../../core/services/donation_service.dart';
import '../../core/services/session.dart';
import '../../core/utils/format.dart';
import '../../shared/components/pickers.dart';
import '../../shared/widgets/common.dart';

class CreateListingScreen extends StatefulWidget {
  final String? initialTitle;
  final int? initialQty;
  const CreateListingScreen({super.key, this.initialTitle, this.initialQty});
  @override
  State<CreateListingScreen> createState() => _CreateListingScreenState();
}

/// Pure validation, shared with tests. Mirrors website/src/Donor.jsx newListing() and the DB checks.
String? validateListing({required String title, required int? qty, required DateTime prepared, required DateTime pickupBy, DateTime? now}) {
  final n = now ?? DateTime.now();
  if (title.trim().length < 2) return 'Please name the food item.';
  if (title.trim().length > 80) return 'Keep the name under 80 characters.';
  if (qty == null || qty < 1 || qty > 10000) return 'Quantity must be between 1 and 10,000.';
  if (prepared.isAfter(n)) return 'Preparation time can’t be in the future.';
  if (!pickupBy.isAfter(n)) return 'Pickup time must be in the future.';
  if (!pickupBy.isAfter(prepared)) return 'Pickup time must be after preparation.';
  return null;
}

class _CreateListingScreenState extends State<CreateListingScreen> {
  final _f = GlobalKey<FormState>();
  late final _title = TextEditingController(text: widget.initialTitle ?? ''), _qty = TextEditingController(text: widget.initialQty?.toString() ?? ''), _notes = TextEditingController();
  String _cat = Domain.categories.first, _unit = Domain.units.first;
  DateTime _prep = DateTime.now().subtract(const Duration(minutes: 30));
  DateTime _by = DateTime.now().add(const Duration(hours: 3));
  PickedFile? _photo;

  Future<DateTime?> _pick(DateTime initial, {required bool past}) async {
    final now = DateTime.now();
    final d = await showDatePicker(context: context, initialDate: initial,
        firstDate: past ? now.subtract(const Duration(days: 3)) : now, lastDate: past ? now : now.add(const Duration(days: 14)));
    if (d == null || !mounted) return null;
    final t = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(initial));
    if (t == null) return null;
    return DateTime(d.year, d.month, d.day, t.hour, t.minute);
  }

  Future<void> _publish() async {
    if (!_f.currentState!.validate()) return;
    final err = validateListing(title: _title.text, qty: int.tryParse(_qty.text.trim()), prepared: _prep, pickupBy: _by);
    if (err != null) throw Exception(err);
    final org = AppSession.instance.org!;
    await DonationService.create(
      orgId: org.id, title: _title.text, category: _cat, quantity: int.parse(_qty.text.trim()), unit: _unit,
      preparedAt: _prep, pickupBy: _by, safetyNotes: _notes.text, photo: _photo?.bytes, photoName: _photo?.name,
    );
    if (!mounted) return;
    showOk(context, 'Listing published. Verified NGOs nearby can now request it.');
    AppSession.instance.touch();
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('List surplus food')),
      body: Form(
        key: _f,
        child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          // photo
          InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () async { try { final p = await pickPhoto(context); if (p != null) setState(() => _photo = p); } catch (e) { if (context.mounted) showErr(context, e); } },
            child: Container(
              height: 180,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(18), border: Border.all(color: t.colorScheme.outline), color: t.colorScheme.surface),
              clipBehavior: Clip.antiAlias,
              child: _photo != null
                  ? Stack(fit: StackFit.expand, children: [
                      Image.memory(_photo!.bytes, fit: BoxFit.cover),
                      Positioned(right: 8, top: 8, child: IconButton.filledTonal(onPressed: () => setState(() => _photo = null), icon: const Icon(Icons.close_rounded), tooltip: 'Remove photo')),
                    ])
                  : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Icon(Icons.add_a_photo_outlined, size: 36, color: t.colorScheme.primary),
                      const SizedBox(height: 8),
                      Text('Add a photo (optional)', style: t.textTheme.titleMedium),
                      Text('JPG, PNG or WebP · up to 2 MB', style: t.textTheme.bodySmall),
                    ]),
            ),
          ),
          const SizedBox(height: 18),
          TextFormField(controller: _title, maxLength: 80, textCapitalization: TextCapitalization.sentences,
              validator: (v) => V.minLen(v, 2, 'Food item'), decoration: const InputDecoration(labelText: 'Food item', hintText: 'e.g. Vegetable biryani')),
          const SizedBox(height: 6),
          DropdownButtonFormField(initialValue: _cat, decoration: const InputDecoration(labelText: 'Category'),
              items: [for (final c in Domain.categories) DropdownMenuItem(value: c, child: Text(c))], onChanged: (v) => setState(() => _cat = v!)),
          const SizedBox(height: 14),
          Row(children: [
            Expanded(child: TextFormField(controller: _qty, keyboardType: TextInputType.number,
                validator: (v) => V.intRange(v, 1, 10000, 'Quantity'), decoration: const InputDecoration(labelText: 'Quantity'))),
            const SizedBox(width: 12),
            Expanded(child: DropdownButtonFormField(initialValue: _unit, decoration: const InputDecoration(labelText: 'Unit'),
                items: [for (final u in Domain.units) DropdownMenuItem(value: u, child: Text(u))], onChanged: (v) => setState(() => _unit = v!))),
          ]),
          const SizedBox(height: 14),
          _TimeTile(label: 'Prepared at', value: _prep, icon: Icons.soup_kitchen_outlined,
              onTap: () async { final d = await _pick(_prep, past: true); if (d != null) setState(() => _prep = d); }),
          const SizedBox(height: 10),
          _TimeTile(label: 'Pickup by', value: _by, icon: Icons.alarm_rounded,
              onTap: () async { final d = await _pick(_by, past: false); if (d != null) setState(() => _by = d); }),
          const SizedBox(height: 14),
          TextFormField(controller: _notes, maxLines: 3, maxLength: 300,
              decoration: const InputDecoration(labelText: 'Safety & storage notes', hintText: 'Allergens, veg/non-veg, storage temperature…')),
          const SizedBox(height: 10),
          BusyButton(expand: true, icon: Icons.publish_rounded, onPressed: _publish, child: const Text('Publish listing')),
          const SizedBox(height: 10),
          Text('Only active, unexpired food is shown to verified NGOs. You can withdraw it until a request is accepted.', style: t.textTheme.bodySmall, textAlign: TextAlign.center),
        ])),
      ),
    );
  }
}

class _TimeTile extends StatelessWidget {
  final String label;
  final DateTime value;
  final IconData icon;
  final VoidCallback onTap;
  const _TimeTile({required this.label, required this.value, required this.icon, required this.onTap});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return InkWell(
      onTap: onTap, borderRadius: BorderRadius.circular(12),
      child: InputDecorator(
        decoration: InputDecoration(labelText: label, prefixIcon: Icon(icon), suffixIcon: const Icon(Icons.edit_calendar_rounded)),
        child: Text(fmtDT(value), style: t.textTheme.bodyLarge),
      ),
    );
  }
}
