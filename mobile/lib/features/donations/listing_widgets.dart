import 'package:flutter/material.dart';
import '../../core/models/models.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/common.dart';

const _catIcons = {
  'Cooked meals': Icons.rice_bowl_rounded,
  'Bakery': Icons.bakery_dining_rounded,
  'Packaged food': Icons.inventory_rounded,
  'Fruits & vegetables': Icons.eco_rounded,
  'Dairy': Icons.local_drink_rounded,
};
IconData categoryIcon(String c) => _catIcons[c] ?? Icons.restaurant_rounded;

/// Listing photo, or a branded category placeholder when there is no photo.
class ListingPhoto extends StatelessWidget {
  final Listing l;
  final double height;
  const ListingPhoto(this.l, {super.key, this.height = 150});
  @override
  Widget build(BuildContext context) {
    final ph = Container(
      height: height, width: double.infinity,
      decoration: const BoxDecoration(gradient: LinearGradient(colors: [Brand.forest, Brand.dark], begin: Alignment.topLeft, end: Alignment.bottomRight)),
      child: Stack(children: [
        Positioned(right: -20, bottom: -20, child: Icon(categoryIcon(l.category), size: height * .9, color: Brand.gold.withValues(alpha: .12))),
        Padding(padding: const EdgeInsets.all(14), child: Align(alignment: Alignment.bottomLeft,
            child: Icon(categoryIcon(l.category), color: Brand.gold, size: 30))),
      ]),
    );
    if (l.photoUrl == null || l.photoUrl!.isEmpty) return ph;
    return Image.network(l.photoUrl!, height: height, width: double.infinity, fit: BoxFit.cover,
        semanticLabel: 'Photo of ${l.title}', errorBuilder: (_, _, _) => ph,
        loadingBuilder: (c, w, p) => p == null ? w : Container(height: height, color: Theme.of(c).colorScheme.surfaceContainerHigh));
  }
}

class AvailabilityBar extends StatelessWidget {
  final Listing l;
  const AvailabilityBar(this.l, {super.key});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final frac = l.quantity == 0 ? 0.0 : l.qtyReserved / l.quantity;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(children: [
        Text('${l.available}', style: TextStyle(fontFamily: serif, fontSize: 24, color: t.colorScheme.primary, height: 1)),
        const SizedBox(width: 6),
        Expanded(child: Text('of ${l.quantity} ${l.unit} available', style: t.textTheme.bodySmall)),
      ]),
      const SizedBox(height: 8),
      ClipRRect(
        borderRadius: BorderRadius.circular(3),
        child: LinearProgressIndicator(value: frac, minHeight: 6, color: Brand.gold, backgroundColor: t.colorScheme.outline.withValues(alpha: .35)),
      ),
    ]);
  }
}

/// Listing card used by donors (own listings), receivers (discovery) and admins.
class ListingCard extends StatelessWidget {
  final Listing l;
  final VoidCallback? onTap;
  final Widget? footer;
  final bool showDonor;
  const ListingCard(this.l, {super.key, this.onTap, this.footer, this.showDonor = false});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final s = l.effectiveStatus;
    final soon = s == 'active' && l.pickupBy.difference(DateTime.now()).inHours < 2;
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Stack(children: [
            ListingPhoto(l),
            Positioned(left: 12, top: 12, child: StatusChip(s, label: soon ? 'ending soon' : null)),
            if (l.distanceKm != null)
              Positioned(right: 12, top: 12, child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(color: Brand.dark.withValues(alpha: .75), borderRadius: BorderRadius.circular(20)),
                child: Text('${l.distanceKm!.toStringAsFixed(1)} km', style: const TextStyle(color: Brand.cream, fontWeight: FontWeight.w700, fontSize: 12)),
              )),
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(l.category.toUpperCase(), style: t.textTheme.labelSmall),
              const SizedBox(height: 4),
              Text(l.title, style: t.textTheme.titleLarge),
              const SizedBox(height: 10),
              AvailabilityBar(l),
              const SizedBox(height: 6),
              InfoRow(Icons.schedule_rounded, s == 'active' ? '${timeLeft(l.pickupBy)} · pickup by ${fmtDT(l.pickupBy)}' : 'Pickup by ${fmtDT(l.pickupBy)}'),
              if (showDonor && l.donorName != null) InfoRow(Icons.storefront_rounded, l.donorName!),
              if (showDonor && l.donorAddress != null) InfoRow(Icons.place_outlined, l.donorAddress!),
              if (l.safetyNotes != null) InfoRow(Icons.health_and_safety_outlined, l.safetyNotes!),
              if (footer != null) ...[const SizedBox(height: 12), footer!],
            ]),
          ),
        ]),
      ),
    );
  }
}
