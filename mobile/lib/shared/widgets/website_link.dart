import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/env.dart';
import '../../core/theme/app_theme.dart';
import 'brand.dart';

/// Opens the AnnSetu website (same account and data) in the phone's browser.
Future<void> openWebsite(BuildContext context, [String path = '']) async {
  final messenger = ScaffoldMessenger.maybeOf(context);
  var ok = false;
  try {
    ok = await launchUrl(Uri.parse('${Env.websiteUrl}/$path'), mode: LaunchMode.externalApplication);
  } catch (_) {}
  if (!ok) messenger?.showSnackBar(SnackBar(content: Text('Couldn’t open the browser. Visit ${Env.websiteUrl.replaceFirst('https://', '')}')));
}

/// Globe icon for app bars.
class WebsiteButton extends StatelessWidget {
  const WebsiteButton({super.key});
  @override
  Widget build(BuildContext context) =>
      IconButton(tooltip: 'AnnSetu website', onPressed: () => openWebsite(context), icon: const Icon(Icons.language_rounded));
}

/// A branded card that leads to the website, for Profile and the representative screen.
class WebsiteCard extends StatelessWidget {
  const WebsiteCard({super.key});
  @override
  Widget build(BuildContext context) => Card(
        color: Brand.dark,
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: () => openWebsite(context),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(children: [
              const BrandMark(size: 44, onDark: true),
              const SizedBox(width: 14),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Visit the AnnSetu website',
                      style: TextStyle(fontFamily: serif, fontSize: 18, color: Brand.cream, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 4),
                  Text('Same account and data. Impact, leaderboard and stories.',
                      style: TextStyle(color: Brand.cream.withValues(alpha: .75), fontSize: 13, height: 1.35)),
                  const SizedBox(height: 6),
                  Text(Env.websiteUrl.replaceFirst('https://', ''),
                      style: const TextStyle(fontFamily: grot, color: Brand.gold, fontWeight: FontWeight.w600, fontSize: 13)),
                ]),
              ),
              const Icon(Icons.open_in_new_rounded, color: Brand.gold),
            ]),
          ),
        ),
      );
}
