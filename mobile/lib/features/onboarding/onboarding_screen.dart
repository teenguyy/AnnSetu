import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/app_router.dart';
import '../../core/theme/app_theme.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/hands_art.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});
  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _Page {
  final IconData icon;
  final String kicker, title, text;
  const _Page(this.icon, this.kicker, this.title, this.text);
}

const _pages = [
  _Page(
    Icons.restaurant_rounded,
    'For donors',
    'Turn surplus into someone’s next meal.',
    'Restaurants, hotels and canteens list what they can’t serve, with quantity, safety notes and a pickup deadline.',
  ),
  _Page(
    Icons.volunteer_activism_rounded,
    'For NGOs',
    'Find fresh food close to your community.',
    'Verified NGOs, shelters and community kitchens discover nearby food and send their own representatives to collect it.',
  ),
  _Page(
    Icons.verified_user_rounded,
    'Built on trust',
    'Verified partners. OTP-confirmed pickups.',
    'Every organisation is checked by an admin, every handover is confirmed with a one-time code, and impact is counted from real pickups only.',
  ),
];

class _OnboardingScreenState extends State<OnboardingScreen> {
  final _pc = PageController();
  int _i = 0;

  Future<void> _finish(String to) async {
    await Onboarding.done();
    if (mounted) context.go(to);
  }

  @override
  Widget build(BuildContext context) {
    final last = _i == _pages.length - 1;
    return Scaffold(
      backgroundColor: Brand.dark,
      body: Stack(
        children: [
          const Positioned.fill(
            child: CustomPaint(painter: OceanWavesPainter()),
          ),
          SafeArea(
            child: Column(
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 12, 8, 0),
                  child: Row(
                    children: [
                      const Logo(size: 32, onDark: true),
                      const Spacer(),
                      TextButton(
                        onPressed: () => _finish('/signin'),
                        style: TextButton.styleFrom(
                          foregroundColor: Brand.cream,
                        ),
                        child: const Text('Skip'),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pc,
                    itemCount: _pages.length,
                    onPageChanged: (i) => setState(() => _i = i),
                    itemBuilder: (_, i) => _PageView(p: _pages[i], index: i),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var k = 0; k < _pages.length; k++)
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        margin: const EdgeInsets.symmetric(horizontal: 4),
                        width: k == _i ? 28 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: k == _i
                              ? Brand.gold
                              : Brand.cream.withValues(alpha: .3),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
                  child: Column(
                    children: [
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          style: FilledButton.styleFrom(
                            backgroundColor: Brand.gold,
                            foregroundColor: Brand.dark,
                          ),
                          onPressed: () => last
                              ? _finish('/register')
                              : _pc.nextPage(
                                  duration: const Duration(milliseconds: 450),
                                  curve: Curves.easeOutCubic,
                                ),
                          child: Text(last ? 'Create an account' : 'Next'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => _finish('/signin'),
                        style: TextButton.styleFrom(
                          foregroundColor: Brand.cream,
                        ),
                        child: const Text('I already have an account'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PageView extends StatelessWidget {
  final _Page p;
  final int index;
  const _PageView({required this.p, required this.index});
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(horizontal: 28),
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (index == 0)
          const HandsArt(height: 250)
        else
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Brand.gold.withValues(alpha: .14),
                  border: Border.all(color: Brand.gold.withValues(alpha: .4)),
                ),
                child: Icon(p.icon, size: 52, color: Brand.gold),
              ),
              Positioned(
                right: -18,
                top: -6,
                child: Text(
                  '0${index + 1}',
                  style: TextStyle(
                    fontFamily: serif,
                    fontSize: 34,
                    color: Brand.cream.withValues(alpha: .25),
                  ),
                ),
              ),
            ],
          ),
        const SizedBox(height: 36),
        Text(
          p.kicker.toUpperCase(),
          style: const TextStyle(
            color: Brand.gold,
            fontWeight: FontWeight.w700,
            letterSpacing: 2,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          p.title,
          style: const TextStyle(
            fontFamily: serif,
            fontSize: 34,
            height: 1.1,
            color: Brand.cream,
          ),
        ),
        const SizedBox(height: 16),
        Text(
          p.text,
          style: TextStyle(
            color: Brand.cream.withValues(alpha: .78),
            fontSize: 16,
            height: 1.5,
          ),
        ),
      ],
    ),
  );
}
