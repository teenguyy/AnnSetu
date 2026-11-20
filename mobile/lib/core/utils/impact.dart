import '../constants/domain.dart';
import '../models/models.dart';

/// Impact numbers calculated ONLY from completed (OTP-confirmed) requests.
class ImpactStats {
  final int completed; // successful pickups
  final int units; // all units, any unit type (what the website shows)
  final int partners; // distinct counterpart organisations
  final Map<String, int> byUnit; // portions / kg / packs
  final Map<String, int> byCategory; // units per food category
  final List<MapEntry<DateTime, int>> weekly; // completed pickups per week, oldest first

  const ImpactStats({
    required this.completed, required this.units, required this.partners,
    required this.byUnit, required this.byCategory, required this.weekly,
  });

  int get portions => byUnit['portions'] ?? 0;
  int get kg => byUnit['kg'] ?? 0;
  int get packs => byUnit['packs'] ?? 0;

  /// ESTIMATE. Portions count as one meal each; kilograms are converted with WRAP's
  /// 420 g meal equivalent. Packs are not converted (their size is unknown).
  int get estimatedMeals => portions + (kg / Domain.kgPerMeal).floor();

  /// Food weight kept out of waste: only what was reported in kg (no guessing for portions/packs).
  int get reportedKg => kg;

  bool get hasData => completed > 0;
}

/// [counterpart] returns the partner organisation id for a request (NGO for donors, donor for NGOs).
ImpactStats computeImpact(List<FoodRequest> requests, String Function(FoodRequest r) counterpart, {DateTime? now, int weeks = 8}) {
  final done = requests.where((r) => r.status == 'completed').toList();
  final byUnit = <String, int>{};
  final byCat = <String, int>{};
  for (final r in done) {
    final unit = r.listing?.unit ?? 'portions';
    byUnit[unit] = (byUnit[unit] ?? 0) + r.quantity;
    final cat = r.listing?.category ?? 'Other';
    byCat[cat] = (byCat[cat] ?? 0) + r.quantity;
  }
  final today = now ?? DateTime.now();
  final start = DateTime(today.year, today.month, today.day).subtract(Duration(days: today.weekday - 1 + 7 * (weeks - 1)));
  final weekly = List.generate(weeks, (i) => MapEntry(start.add(Duration(days: 7 * i)), 0));
  for (final r in done) {
    final at = (r.completedAt ?? r.createdAt)?.toLocal();
    if (at == null || at.isBefore(start)) continue;
    final idx = at.difference(start).inDays ~/ 7;
    if (idx >= 0 && idx < weeks) weekly[idx] = MapEntry(weekly[idx].key, weekly[idx].value + 1);
  }
  return ImpactStats(
    completed: done.length,
    units: done.fold(0, (a, r) => a + r.quantity),
    partners: done.map(counterpart).where((x) => x.isNotEmpty).toSet().length,
    byUnit: byUnit,
    byCategory: byCat,
    weekly: weekly,
  );
}

/// Progress towards a badge (0..1) from the same metrics award_badges() uses.
double badgeProgress(BadgeDef b, ImpactStats s) {
  final v = switch (b.metric) { 'donations' => s.completed, 'units' => s.units, _ => s.partners };
  return (v / b.threshold).clamp(0, 1).toDouble();
}
