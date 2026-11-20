import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/domain.dart';
import '../../core/models/models.dart';
import '../../core/services/notification_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import '../admin/admin_home.dart';
import '../analytics/impact_screen.dart';
import '../donor/donor_screens.dart';
import '../profile/profile_screen.dart';
import '../receiver/receiver_screens.dart';
import '../rep/rep_screens.dart';

class _Tab {
  final String label;
  final IconData icon, selected;
  final Widget page;
  const _Tab(this.label, this.icon, this.selected, this.page);
}

/// One shell per role, with bottom navigation. Tabs keep their state (IndexedStack).
class RoleShell extends StatefulWidget {
  final int? initialTab;
  const RoleShell({super.key, this.initialTab});
  /// Lets any tab switch to another tab, e.g. RoleShell.of(context)?.go(2).
  static RoleShellState? of(BuildContext c) => c.findAncestorStateOfType<RoleShellState>();
  @override
  State<RoleShell> createState() => RoleShellState();
}

class RoleShellState extends State<RoleShell> {
  late int _i = widget.initialTab ?? 0;
  StreamSubscription<AppNotification>? _sub;

  void go(int i) => setState(() => _i = i);

  List<_Tab> _tabs(Role role) => switch (role) {
        Role.donor => const [
            _Tab('Home', Icons.home_outlined, Icons.home_rounded, DonorHome()),
            _Tab('Listings', Icons.inventory_2_outlined, Icons.inventory_2_rounded, DonorListings()),
            _Tab('Requests', Icons.inbox_outlined, Icons.inbox_rounded, DonorRequests()),
            _Tab('Impact', Icons.insights_outlined, Icons.insights_rounded, ImpactScreen()),
            _Tab('Profile', Icons.person_outline_rounded, Icons.person_rounded, ProfileScreen()),
          ],
        Role.ngo => const [
            _Tab('Home', Icons.home_outlined, Icons.home_rounded, ReceiverHome()),
            _Tab('Discover', Icons.travel_explore_outlined, Icons.travel_explore_rounded, DiscoverScreen()),
            _Tab('Pickups', Icons.local_shipping_outlined, Icons.local_shipping_rounded, ReceiverRequests()),
            _Tab('Impact', Icons.insights_outlined, Icons.insights_rounded, ImpactScreen()),
            _Tab('Profile', Icons.person_outline_rounded, Icons.person_rounded, ProfileScreen()),
          ],
        Role.rep => const [
            _Tab('Pickups', Icons.local_shipping_outlined, Icons.local_shipping_rounded, RepPickups()),
            _Tab('History', Icons.history_rounded, Icons.history_rounded, RepPickups(history: true)),
            _Tab('Account', Icons.person_outline_rounded, Icons.person_rounded, RepAccount()),
          ],
        Role.admin => const [
            _Tab('Overview', Icons.dashboard_outlined, Icons.dashboard_rounded, AdminHome()),
            _Tab('Verify', Icons.verified_user_outlined, Icons.verified_user_rounded, AdminVerifyTab()),
            _Tab('Manage', Icons.tune_outlined, Icons.tune_rounded, AdminManageTab()),
            _Tab('Profile', Icons.person_outline_rounded, Icons.person_rounded, ProfileScreen()),
          ],
      };

  @override
  void initState() {
    super.initState();
    _sub = NotificationService.instance.banners.listen((n) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)..hideCurrentSnackBar()..showSnackBar(SnackBar(
        duration: const Duration(seconds: 5),
        content: Row(children: [
          const Icon(Icons.notifications_active_rounded, color: Brand.gold, size: 20),
          const SizedBox(width: 10),
          Expanded(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(n.title, style: const TextStyle(fontWeight: FontWeight.w700)),
            if (n.body != null && n.body!.isNotEmpty) Text(n.body!, maxLines: 2, overflow: TextOverflow.ellipsis),
          ])),
        ]),
        action: SnackBarAction(label: 'VIEW', textColor: Brand.gold, onPressed: () => context.push('/notifications')),
      ));
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final role = AppSession.instance.role ?? Role.donor;
    final tabs = _tabs(role);
    if (_i >= tabs.length) _i = 0;
    return Scaffold(
      body: IndexedStack(index: _i, children: [for (final t in tabs) t.page]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _i,
        onDestinationSelected: go,
        destinations: [for (final t in tabs) NavigationDestination(icon: Icon(t.icon), selectedIcon: Icon(t.selected), label: t.label)],
      ),
    );
  }
}

/// App bar used by every top-level tab: brand, title, live notification bell.
class TabAppBar extends StatelessWidget implements PreferredSizeWidget {
  final String title;
  final List<Widget> actions;
  final PreferredSizeWidget? bottom;
  const TabAppBar({super.key, required this.title, this.actions = const [], this.bottom});
  @override
  Size get preferredSize => Size.fromHeight(64 + (bottom?.preferredSize.height ?? 0));
  @override
  Widget build(BuildContext context) => AppBar(
        toolbarHeight: 64,
        titleSpacing: 16,
        title: Row(children: [const BrandMark(size: 32), const SizedBox(width: 12), Flexible(child: Text(title, overflow: TextOverflow.ellipsis))]),
        actions: [...actions,
          IconButton(tooltip: 'Ask AnnSetu', onPressed: () => context.push('/assistant'), icon: const Icon(Icons.smart_toy_outlined)),
          const NotificationBell(), const SizedBox(width: 6)],
        bottom: bottom,
      );
}

class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});
  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int _n = 0;
  @override
  void initState() {
    super.initState();
    _refresh();
    AppSession.instance.dataTick.addListener(_refresh);
  }

  @override
  void dispose() {
    AppSession.instance.dataTick.removeListener(_refresh);
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final n = await NotificationService.unreadCount();
      if (mounted) setState(() => _n = n);
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: _n > 0 ? 'Notifications, $_n unread' : 'Notifications',
        onPressed: () async { await context.push('/notifications'); _refresh(); },
        icon: Badge(
          isLabelVisible: _n > 0,
          backgroundColor: Brand.terracotta,
          label: Text(_n > 9 ? '9+' : '$_n'),
          child: const Icon(Icons.notifications_none_rounded),
        ),
      );
}
