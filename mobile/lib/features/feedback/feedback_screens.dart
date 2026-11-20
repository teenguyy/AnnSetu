import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../../core/constants/domain.dart';
import '../../core/models/models.dart';
import '../../core/services/feedback_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/components/pickers.dart';
import '../../shared/widgets/common.dart';

const feedbackIcons = <String, IconData>{
  'general': Icons.chat_outlined, 'bug': Icons.bug_report_outlined, 'feature': Icons.lightbulb_outline_rounded,
  'account': Icons.manage_accounts_outlined, 'donation': Icons.restaurant_outlined, 'pickup': Icons.local_shipping_outlined, 'other': Icons.more_horiz_rounded,
};

/// Client-side checks that match the database constraints on `feedback`.
String? validateFeedback({required String category, required String subject, required String message, int? rating}) {
  if (!Domain.feedbackCategories.containsKey(category)) return 'Choose a category.';
  if (subject.trim().length < 3 || subject.trim().length > 120) return 'Subject must be 3 to 120 characters.';
  if (message.trim().length < 10 || message.trim().length > 2000) return 'Message must be 10 to 2,000 characters.';
  if (rating != null && (rating < 1 || rating > 5)) return 'Rating must be between 1 and 5.';
  return null;
}

class MyFeedbackScreen extends StatelessWidget {
  const MyFeedbackScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Feedback & support')),
        floatingActionButton: FloatingActionButton.extended(
          onPressed: () => context.push('/feedback/new'), icon: const Icon(Icons.add_comment_rounded), label: const Text('New feedback'),
          backgroundColor: Brand.gold, foregroundColor: Brand.dark,
        ),
        body: Loader<List<FeedbackItem>>(
          load: FeedbackService.mine,
          builder: (context, items, reload) => RefreshIndicator(
            onRefresh: reload,
            child: ListView(padding: const EdgeInsets.fromLTRB(16, 8, 16, 100), children: [
              Text('Tell us what works, what breaks and what you need. The AnnSetu team replies here and you get a notification.',
                  style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 14),
              Wrap(spacing: 8, runSpacing: 8, children: [
                for (final e in Domain.feedbackCategories.entries)
                  ActionChip(avatar: Icon(feedbackIcons[e.key], size: 18), label: Text(e.value),
                      onPressed: () => context.push('/feedback/new?category=${e.key}')),
              ]),
              const SectionTitle('Your feedback'),
              if (items.isEmpty)
                const EmptyState(icon: Icons.forum_outlined, title: 'Nothing submitted yet', text: 'Your feedback, bug reports and their status will appear here.')
              else
                for (final f in items) Padding(padding: const EdgeInsets.only(bottom: 12), child: FeedbackCard(f)),
            ]),
          ),
        ),
      );
}

class FeedbackCard extends StatelessWidget {
  final FeedbackItem f;
  final VoidCallback? onTap;
  final bool showSender;
  const FeedbackCard(this.f, {super.key, this.onTap, this.showSender = false});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return TapCard(
      onTap: onTap,
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Icon(feedbackIcons[f.category], size: 18, color: t.colorScheme.primary),
          const SizedBox(width: 6),
          Expanded(child: Text(f.categoryLabel.toUpperCase(), style: t.textTheme.labelSmall)),
          StatusChip(f.status, label: f.statusLabel),
        ]),
        const SizedBox(height: 8),
        Text(f.subject, style: t.textTheme.titleMedium),
        const SizedBox(height: 4),
        Text(f.message, maxLines: 3, overflow: TextOverflow.ellipsis, style: t.textTheme.bodyMedium),
        const SizedBox(height: 8),
        Row(children: [
          if (f.rating != null) ...[for (var i = 1; i <= 5; i++) Icon(i <= f.rating! ? Icons.star_rounded : Icons.star_outline_rounded, size: 16, color: Brand.gold), const SizedBox(width: 8)],
          if (f.screenshotPath != null) ...[Icon(Icons.image_outlined, size: 16, color: t.colorScheme.onSurfaceVariant), const SizedBox(width: 8)],
          Expanded(child: Text(
            showSender ? '${f.senderName ?? 'User'}${f.senderRole != null ? ' · ${roleLabel(roleFrom(f.senderRole) ?? Role.donor)}' : ''}${f.orgName != null ? ' · ${f.orgName}' : ''}' : fmtDT(f.createdAt),
            style: t.textTheme.bodySmall, overflow: TextOverflow.ellipsis,
          )),
          if (showSender) Text(f.createdAt != null ? ago(f.createdAt!) : '', style: t.textTheme.bodySmall),
        ]),
        if (f.adminResponse != null) ...[
          const SizedBox(height: 12),
          Container(
            width: double.infinity, padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: t.colorScheme.primaryContainer, borderRadius: BorderRadius.circular(12)),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('AnnSetu replied${f.respondedAt != null ? ' · ${fmtD(f.respondedAt)}' : ''}', style: TextStyle(fontWeight: FontWeight.w700, color: t.colorScheme.onPrimaryContainer, fontSize: 12.5)),
              const SizedBox(height: 4),
              Text(f.adminResponse!, style: TextStyle(color: t.colorScheme.onPrimaryContainer)),
            ]),
          ),
        ],
      ]),
    );
  }
}

class FeedbackFormScreen extends StatefulWidget {
  final String? initialCategory;
  const FeedbackFormScreen({super.key, this.initialCategory});
  @override
  State<FeedbackFormScreen> createState() => _FeedbackFormScreenState();
}

class _FeedbackFormScreenState extends State<FeedbackFormScreen> {
  final _f = GlobalKey<FormState>();
  late String _cat = Domain.feedbackCategories.containsKey(widget.initialCategory) ? widget.initialCategory! : 'general';
  final _subject = TextEditingController(), _message = TextEditingController();
  int? _rating;
  PickedFile? _shot;

  Future<void> _submit() async {
    if (!_f.currentState!.validate()) return;
    final err = validateFeedback(category: _cat, subject: _subject.text, message: _message.text, rating: _rating);
    if (err != null) throw Exception(err);
    String? version;
    try { version = (await PackageInfo.fromPlatform()).version; } catch (_) {}
    await FeedbackService.submit(category: _cat, subject: _subject.text, message: _message.text, rating: _rating,
        orgId: AppSession.instance.org?.id, screenshot: _shot?.bytes, screenshotName: _shot?.name, appVersion: version);
    if (!mounted) return;
    showOk(context, 'Thank you! Your feedback reached the AnnSetu team.');
    AppSession.instance.touch();
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final wantsShot = const ['bug', 'account', 'donation', 'pickup', 'other'].contains(_cat);
    return Scaffold(
      appBar: AppBar(title: const Text('New feedback')),
      body: Form(
        key: _f,
        child: SingleChildScrollView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 40), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text('CATEGORY', style: t.textTheme.labelSmall),
          const SizedBox(height: 8),
          Wrap(spacing: 8, runSpacing: 8, children: [
            for (final e in Domain.feedbackCategories.entries)
              ChoiceChip(avatar: Icon(feedbackIcons[e.key], size: 18), label: Text(e.value), selected: _cat == e.key, onSelected: (_) => setState(() => _cat = e.key)),
          ]),
          const SizedBox(height: 20),
          Text('RATING (OPTIONAL)', style: t.textTheme.labelSmall),
          Row(children: [
            for (var i = 1; i <= 5; i++)
              IconButton(
                tooltip: '$i star${i > 1 ? 's' : ''}',
                onPressed: () => setState(() => _rating = _rating == i ? null : i),
                icon: Icon(_rating != null && i <= _rating! ? Icons.star_rounded : Icons.star_outline_rounded, color: Brand.gold, size: 34),
              ),
            if (_rating != null) Text('$_rating / 5', style: t.textTheme.bodySmall),
          ]),
          const SizedBox(height: 10),
          TextFormField(controller: _subject, maxLength: 120, textCapitalization: TextCapitalization.sentences,
              validator: (v) => V.minLen(v, 3, 'Subject'), decoration: InputDecoration(labelText: 'Subject', hintText: _cat == 'bug' ? 'e.g. Photo upload fails' : 'A short summary')),
          TextFormField(controller: _message, maxLength: 2000, minLines: 5, maxLines: 10, textCapitalization: TextCapitalization.sentences,
              validator: (v) => V.minLen(v, 10, 'Message'),
              decoration: InputDecoration(labelText: 'Details', alignLabelWithHint: true,
                  hintText: _cat == 'bug' ? 'What did you do, what did you expect, and what happened instead?' : 'Tell us more…')),
          const SizedBox(height: 6),
          if (wantsShot || _shot != null)
            OutlinedButton.icon(
              onPressed: () async { try { final p = await pickPhoto(context, maxBytes: Limits.shotBytes, allowCamera: false); if (p != null) setState(() => _shot = p); } catch (e) { if (context.mounted) showErr(context, e); } },
              icon: const Icon(Icons.add_photo_alternate_outlined), label: Text(_shot == null ? 'Attach a screenshot (optional)' : 'Replace screenshot'),
            ),
          if (_shot != null) Padding(
            padding: const EdgeInsets.only(top: 10),
            child: Stack(children: [
              ClipRRect(borderRadius: BorderRadius.circular(12), child: Image.memory(_shot!.bytes, height: 180, width: double.infinity, fit: BoxFit.cover)),
              Positioned(right: 6, top: 6, child: IconButton.filledTonal(onPressed: () => setState(() => _shot = null), icon: const Icon(Icons.close_rounded), tooltip: 'Remove screenshot')),
            ]),
          ),
          const SizedBox(height: 18),
          BusyButton(expand: true, icon: Icons.send_rounded, onPressed: _submit, child: const Text('Send feedback')),
          const SizedBox(height: 10),
          Text('Screenshots are private: only you and AnnSetu admins can see them.', style: t.textTheme.bodySmall, textAlign: TextAlign.center),
        ])),
      ),
    );
  }
}
