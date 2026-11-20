import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/constants/domain.dart';
import '../../core/models/models.dart';
import '../../core/services/impact_service.dart';
import '../../core/services/organization_service.dart';
import '../../core/services/request_service.dart';
import '../../core/services/donation_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../core/utils/impact.dart';
import '../../shared/widgets/common.dart';
import '../shell/role_shell.dart';

class _ImpactBundle {
  final ImpactStats stats;
  final ImpactData data;
  final PlatformImpact? platform;
  final List<FoodRequest> completed;
  _ImpactBundle(this.stats, this.data, this.platform, this.completed);
}

/// Donor and receiver impact, computed only from OTP-confirmed pickups.
class ImpactScreen extends StatelessWidget {
  const ImpactScreen({super.key});

  static Future<_ImpactBundle?> _load() async {
    final s = AppSession.instance;
    final org = s.org;
    if (org == null) return null;
    final donor = s.role == Role.donor;
    final reqs = donor ? await RequestService.forDonor(await DonationService.myListings(org.id)) : await RequestService.forReceiver(org.id);
    if (donor) {
      final ngos = await OrganizationService.byIds(reqs.map((r) => r.ngoOrgId));
      for (final r in reqs) { r.ngo = ngos[r.ngoOrgId]; }
    }
    final stats = computeImpact(reqs, (r) => donor ? r.ngoOrgId : (r.listing?.donorOrgId ?? ''));
    final data = await ImpactService.load(org.id, donor ? 'donor' : 'ngo');
    PlatformImpact? p;
    try { p = await ImpactService.platform(); } catch (_) {}
    return _ImpactBundle(stats, data, p, reqs.where((r) => r.status == 'completed').toList());
  }

  @override
  Widget build(BuildContext context) {
    final donor = AppSession.instance.role == Role.donor;
    return Scaffold(
      appBar: const TabAppBar(title: 'Impact'),
      body: Loader<_ImpactBundle?>(
        load: _load,
        builder: (context, b, reload) {
          if (b == null) {
            return const EmptyState(icon: Icons.insights_rounded, title: 'No impact yet', text: 'Create your organisation profile first. Impact is calculated from confirmed pickups only.');
          }
          final s = b.stats;
          final t = Theme.of(context);
          return RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.only(bottom: 40), children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Text('Calculated only from your OTP-confirmed pickups.', style: t.textTheme.bodySmall),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: LayoutBuilder(builder: (c, box) {
                  final w = (box.maxWidth - 12) / 2;
                  return Wrap(spacing: 12, runSpacing: 12, children: [
                    SizedBox(width: w, child: StatCard(value: s.completed, label: donor ? 'Donations completed' : 'Pickups completed', icon: Icons.verified_rounded, highlight: true)),
                    SizedBox(width: w, child: StatCard(value: s.units, label: donor ? 'Units donated' : 'Units received', icon: Icons.scale_rounded)),
                    SizedBox(width: w, child: StatCard(value: s.partners, label: donor ? 'NGOs supported' : 'Donors partnered', icon: Icons.handshake_rounded)),
                    SizedBox(width: w, child: StatCard(value: s.reportedKg, label: 'kg reported (kg listings)', icon: Icons.delete_outline_rounded)),
                  ]);
                }),
              ),
              if (s.hasData) _Estimate(s) else const Padding(padding: EdgeInsets.fromLTRB(16, 16, 16, 0),
                  child: Text('Estimates appear after your first confirmed pickup. We never show invented figures.')),
              const SectionTitle('Pickups per week', kicker: 'Last 8 weeks'),
              Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: SizedBox(height: 190, child: _WeeklyChart(s))),
              if (s.byCategory.isNotEmpty) ...[
                const SectionTitle('By food category', kicker: 'Units'),
                Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: _CategoryChart(s.byCategory)),
              ],
              const SectionTitle('Achievements'),
              SizedBox(
                height: 150,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: b.data.defs.length, separatorBuilder: (_, _) => const SizedBox(width: 12),
                  itemBuilder: (_, i) => _BadgeTile(b.data.defs[i], b.data.earned.contains(b.data.defs[i].code), s, donor),
                ),
              ),
              const SectionTitle('Certificates'),
              if (b.data.certificates.isEmpty) const Pad(Text('Certificates appear here when you earn a badge.'))
              else for (final c in b.data.certificates)
                ListTile(
                  leading: const CircleAvatar(backgroundColor: Brand.gold, child: Icon(Icons.workspace_premium_rounded, color: Brand.dark)),
                  title: Text(c.title), subtitle: Text('Issued ${fmtD(c.issuedAt)} · ${c.serial}'),
                  trailing: const Icon(Icons.chevron_right_rounded),
                  onTap: () => _showCertificate(context, c, AppSession.instance.org!.name),
                ),
              SectionTitle('Top ${donor ? 'donors' : 'receivers'}'),
              if (b.data.board.isEmpty) const Pad(Text('The leaderboard fills up as pickups are completed.'))
              else Pad(Card(child: Column(children: [
                for (var i = 0; i < b.data.board.length; i++)
                  ListTile(
                    tileColor: b.data.board[i].orgId == AppSession.instance.org!.id ? Brand.gold.withValues(alpha: .14) : null,
                    leading: Text('${i + 1}', style: const TextStyle(fontFamily: serif, fontSize: 22)),
                    title: Text(b.data.board[i].name), subtitle: Text('${b.data.board[i].donations} ${donor ? 'donations' : 'pickups'}'),
                    trailing: Text('${fmtNum(b.data.board[i].units)} units', style: t.textTheme.titleSmall),
                  ),
              ]))),
              SectionTitle(donor ? 'Donation history' : 'Pickup history'),
              if (b.completed.isEmpty) const Pad(Text('Completed pickups will be listed here.'))
              else for (final r in b.completed.take(20))
                ListTile(
                  dense: true, leading: const Icon(Icons.check_circle_rounded, color: Brand.sage),
                  title: Text(r.listing?.title ?? 'Listing'),
                  subtitle: Text('${donor ? (r.ngo?.name ?? 'Receiver') : (r.donor?.name ?? 'Donor')} · ${r.quantity} ${r.listing?.unit ?? ''}'),
                  trailing: Text(fmtD(r.completedAt), style: t.textTheme.bodySmall),
                ),
              if (b.platform != null) ...[
                const SectionTitle('Across AnnSetu', kicker: 'Live platform totals'),
                Pad(Card(child: Padding(padding: const EdgeInsets.all(16), child: Wrap(spacing: 24, runSpacing: 12, children: [
                  _mini(fmtNum(b.platform!.donations), 'pickups'), _mini(fmtNum(b.platform!.units), 'units shared'),
                  _mini('${b.platform!.donors}', 'verified donors'), _mini('${b.platform!.ngos}', 'verified NGOs'),
                ])))),
              ],
            ]),
          );
        },
      ),
    );
  }

  Widget _mini(String v, String l) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(v, style: const TextStyle(fontFamily: serif, fontSize: 24)), Text(l, style: const TextStyle(fontSize: 12)),
      ]);
}

class _Estimate extends StatelessWidget {
  final ImpactStats s;
  const _Estimate(this.s);
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(color: t.colorScheme.secondaryContainer, borderRadius: BorderRadius.circular(18)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Text('≈ ${fmtNum(s.estimatedMeals)}', style: TextStyle(fontFamily: serif, fontSize: 32, color: t.colorScheme.onSecondaryContainer)),
            const SizedBox(width: 10),
            Expanded(child: Text('meals (estimate)', style: TextStyle(color: t.colorScheme.onSecondaryContainer, fontWeight: FontWeight.w700))),
          ]),
          const SizedBox(height: 6),
          Text('How we estimate: each portion counts as one meal, and each kg is converted with the WRAP meal equivalent of '
              '${(Domain.kgPerMeal * 1000).round()} g per meal. Packs are not converted because their size varies. '
              'Based on ${s.portions} portions and ${s.kg} kg confirmed.',
              style: TextStyle(color: t.colorScheme.onSecondaryContainer, fontSize: 12.5)),
        ]),
      ),
    );
  }
}

class _WeeklyChart extends StatelessWidget {
  final ImpactStats s;
  const _WeeklyChart(this.s);
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final maxY = s.weekly.fold<int>(0, (a, e) => e.value > a ? e.value : a);
    final f = DateFormat('d MMM');
    return BarChart(BarChartData(
      maxY: (maxY < 3 ? 3 : maxY + 1).toDouble(),
      gridData: FlGridData(drawVerticalLine: false, horizontalInterval: 1, getDrawingHorizontalLine: (_) => FlLine(color: t.colorScheme.outline.withValues(alpha: .4), strokeWidth: 1)),
      borderData: FlBorderData(show: false),
      titlesData: FlTitlesData(
        topTitles: const AxisTitles(), rightTitles: const AxisTitles(),
        leftTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 24, interval: 1,
            getTitlesWidget: (v, _) => Text(v.toInt().toString(), style: t.textTheme.bodySmall))),
        bottomTitles: AxisTitles(sideTitles: SideTitles(showTitles: true, reservedSize: 24,
            getTitlesWidget: (v, _) => v.toInt() % 2 == 1 ? const SizedBox() : Text(f.format(s.weekly[v.toInt()].key), style: t.textTheme.bodySmall?.copyWith(fontSize: 10)))),
      ),
      barTouchData: BarTouchData(touchTooltipData: BarTouchTooltipData(
        getTooltipColor: (_) => Brand.dark,
        getTooltipItem: (g, _, r, _) => BarTooltipItem('${r.toY.toInt()} pickup${r.toY == 1 ? '' : 's'}\nweek of ${f.format(s.weekly[g.x].key)}', const TextStyle(color: Brand.cream, fontSize: 12)),
      )),
      barGroups: [
        for (var i = 0; i < s.weekly.length; i++)
          BarChartGroupData(x: i, barRods: [BarChartRodData(toY: s.weekly[i].value.toDouble(), width: 18,
              color: i == s.weekly.length - 1 ? Brand.gold : (t.brightness == Brightness.dark ? Brand.sage : Brand.forest),
              borderRadius: const BorderRadius.vertical(top: Radius.circular(6)))]),
      ],
    ), duration: MediaQuery.of(context).disableAnimations ? Duration.zero : const Duration(milliseconds: 600));
  }
}

class _CategoryChart extends StatefulWidget {
  final Map<String, int> data;
  const _CategoryChart(this.data);
  @override
  State<_CategoryChart> createState() => _CategoryChartState();
}

class _CategoryChartState extends State<_CategoryChart> {
  int? _touched;
  static const _colors = [Brand.forest, Brand.gold, Brand.terracotta, Brand.sage, Color(0xFF4B5F55), Color(0xFFD4B26A)];
  @override
  Widget build(BuildContext context) {
    final e = widget.data.entries.toList()..sort((a, b) => b.value.compareTo(a.value));
    final total = e.fold<int>(0, (a, x) => a + x.value);
    return Row(children: [
      SizedBox(width: 150, height: 150, child: PieChart(PieChartData(
        sectionsSpace: 2, centerSpaceRadius: 34,
        pieTouchData: PieTouchData(touchCallback: (ev, r) => setState(() => _touched = ev.isInterestedForInteractions ? r?.touchedSection?.touchedSectionIndex : null)),
        sections: [
          for (var i = 0; i < e.length; i++)
            PieChartSectionData(value: e[i].value.toDouble(), color: _colors[i % _colors.length], radius: _touched == i ? 40 : 32, showTitle: false),
        ],
      ))),
      const SizedBox(width: 16),
      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        for (var i = 0; i < e.length; i++)
          Padding(padding: const EdgeInsets.symmetric(vertical: 3), child: Row(children: [
            Container(width: 12, height: 12, decoration: BoxDecoration(color: _colors[i % _colors.length], borderRadius: BorderRadius.circular(3))),
            const SizedBox(width: 8),
            Expanded(child: Text(e[i].key, style: TextStyle(fontWeight: _touched == i ? FontWeight.w700 : FontWeight.w500))),
            Text('${(e[i].value / total * 100).round()}%'),
          ])),
      ])),
    ]);
  }
}

class _BadgeTile extends StatelessWidget {
  final BadgeDef b;
  final bool earned, donor;
  final ImpactStats s;
  const _BadgeTile(this.b, this.earned, this.s, this.donor);
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final need = switch (b.metric) {
      'donations' => '${b.threshold} ${donor ? 'donation' : 'pickup'}${b.threshold > 1 ? 's' : ''}',
      'units' => '${b.threshold} units',
      _ => '${b.threshold} ${donor ? 'NGOs' : 'donors'}',
    };
    return Container(
      width: 150, padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: earned ? Brand.forest : t.colorScheme.surface, borderRadius: BorderRadius.circular(18),
        border: Border.all(color: earned ? Brand.gold : t.colorScheme.outline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Icon(Icons.workspace_premium_rounded, color: earned ? Brand.gold : t.colorScheme.outline, size: 30),
        const Spacer(),
        Text(b.name, style: TextStyle(fontWeight: FontWeight.w700, color: earned ? Brand.cream : null), maxLines: 2),
        const SizedBox(height: 4),
        Text(earned ? 'Earned' : need, style: TextStyle(fontSize: 12, color: earned ? Brand.gold : t.colorScheme.onSurfaceVariant)),
        if (!earned) ...[const SizedBox(height: 6), LinearProgressIndicator(value: badgeProgress(b, s), color: Brand.gold, minHeight: 4)],
      ]),
    );
  }
}

void _showCertificate(BuildContext context, Certificate c, String orgName) {
  showDialog(context: context, builder: (ctx) => Dialog(
    backgroundColor: Brand.forest,
    child: Padding(
      padding: const EdgeInsets.all(8),
      child: Container(
        padding: const EdgeInsets.fromLTRB(22, 28, 22, 18),
        decoration: BoxDecoration(border: Border.all(color: Brand.gold, width: 1.4), borderRadius: BorderRadius.circular(16)),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Text('ANNSETU', style: TextStyle(color: Brand.gold, letterSpacing: 4, fontWeight: FontWeight.w700, fontSize: 12)),
          const SizedBox(height: 10),
          const Text('Certificate of Appreciation', textAlign: TextAlign.center, style: TextStyle(fontFamily: serif, color: Brand.cream, fontSize: 26)),
          const SizedBox(height: 14),
          Text('is proudly presented to', style: TextStyle(color: Brand.cream.withValues(alpha: .75))),
          const SizedBox(height: 6),
          Text(orgName, textAlign: TextAlign.center, style: const TextStyle(fontFamily: serif, fontStyle: FontStyle.italic, color: Brand.gold, fontSize: 24)),
          const SizedBox(height: 10),
          Text('for earning the badge', style: TextStyle(color: Brand.cream.withValues(alpha: .75))),
          Text(c.title, style: const TextStyle(color: Brand.cream, fontWeight: FontWeight.w700, fontSize: 17)),
          const SizedBox(height: 14),
          Text('Issued ${fmtD(c.issuedAt)} · Serial ${c.serial}', style: TextStyle(color: Brand.cream.withValues(alpha: .7), fontSize: 12)),
          const SizedBox(height: 18),
          Row(children: [
            Expanded(child: TextButton(onPressed: () => Navigator.pop(ctx), style: TextButton.styleFrom(foregroundColor: Brand.cream), child: const Text('Close'))),
            Expanded(child: FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: Brand.gold, foregroundColor: Brand.dark),
              onPressed: () => SharePlus.instance.share(ShareParams(text: '$orgName earned the AnnSetu “${c.title}” certificate on ${fmtD(c.issuedAt)}. Serial ${c.serial}. AnnSetu can verify this serial.')),
              icon: const Icon(Icons.share_rounded, size: 18), label: const Text('Share'),
            )),
          ]),
        ]),
      ),
    ),
  ));
}
