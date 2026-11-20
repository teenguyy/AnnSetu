import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../../core/constants/env.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_theme.dart';

/// Instant answers for the most common questions (no waiting for the AI). Same answers as the website.
final _instant = <(RegExp, String)>[
  (RegExp(r'(how|where).*(donate|give|list)|donat(e|ion).*(food|surplus)|post.*listing', caseSensitive: false),
      'Donating takes a few minutes:\n- **Sign up as a Donor** and complete your profile\n- Upload your **FSSAI licence** so an admin can verify you\n- Tap **New listing**: food, quantity, pickup-by time and a photo\n- Accept a request, then check the representative’s **OTP** at handover'),
  (RegExp(r"(no|without|don.?t have).*(certificate|registration)|certificate.*(no|not)", caseSensitive: false),
      'Yes, you can still join.\n- Sign up as a **Receiver** and complete your profile\n- In Documents, choose **“We don’t have a registration certificate”**\n- Explain who you serve and since when\n- An admin reviews it within **3–5 business days**'),
  (RegExp(r'\botp\b|one.?time|handover code|pickup code', caseSensitive: false),
      'The OTP keeps every handover safe.\n- When the donor accepts, the receiver gets a **4-digit OTP**\n- The representative shows it at pickup\n- The donor enters it to **confirm the handover**'),
  (RegExp(r'track|where.*(representative|rep)|live location|eta|arriv', caseSensitive: false),
      'Open **Pickups**.\n- Steps: **assigned → on the way → reached → collected → delivered**\n- A live map shows the representative while they travel\n- The ETA updates automatically, and you can **call** or **message** them'),
  (RegExp(r'representative|\brep\b|who collects', caseSensitive: false),
      'Representatives collect food for an NGO.\n- The NGO adds them in **Profile → Representatives** with their email\n- They sign up as **Representative** with that same email\n- They then see directions, the OTP and the pickup steps'),
  (RegExp(r'verif|approv|document|fssai|pending', caseSensitive: false),
      'Verification keeps AnnSetu safe.\n- Upload documents in **Profile → Documents**\n- Our AI checks them instantly and an **admin makes the final decision**\n- You’re notified as soon as you’re approved'),
  (RegExp(r'deliver(y|ies)?\b.*(do you|provide)|do you deliver', caseSensitive: false),
      'AnnSetu does **not** run delivery.\n- Each receiver sends **its own representative** to collect the food\n- You can follow them live on the map'),
  (RegExp(r'safe|hygien|expired|quality', caseSensitive: false),
      'Food safety comes first.\n- Only list food that is **fresh, covered and within its safe time**\n- Listings disappear after the pickup-by time\n- Receivers check the food at collection and can **report** problems'),
  (RegExp(r'^(hi|hello|hey|namaste|hii+)\b', caseSensitive: false),
      'Hi! I can help with donating, receiving, verification, pickups and tracking. What would you like to know?'),
];

class _Msg {
  final String role, text;
  final bool instant;
  _Msg(this.role, this.text, {this.instant = false});
}

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});
  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _msgs = <_Msg>[];
  final _text = TextEditingController();
  final _scroll = ScrollController();
  bool _busy = false;
  String? _err;

  static const _starters = [
    'How do I donate surplus food?',
    'We have no registration certificate. Can we receive food?',
    'How does the pickup OTP work?',
    'How do I track my representative?',
  ];

  Future<void> _send(String q) async {
    final content = q.trim();
    if (content.isEmpty || _busy) return;
    _text.clear();
    setState(() { _msgs.add(_Msg('user', content)); _err = null; });
    final hit = _instant.where((e) => e.$1.hasMatch(content)).firstOrNull;
    if (hit != null) {
      setState(() => _msgs.add(_Msg('assistant', hit.$2, instant: true)));
      _down();
      return;
    }
    setState(() => _busy = true);
    _down();
    try {
      final token = db.auth.currentSession?.accessToken;
      final hist = _msgs.length > 12 ? _msgs.sublist(_msgs.length - 12) : _msgs;
      final res = await http.post(Uri.parse('${Env.apiBase}/chat'),
          headers: {'Content-Type': 'application/json', if (token != null) 'Authorization': 'Bearer $token'},
          body: jsonEncode({'messages': [for (final m in hist) {'role': m.role, 'content': m.text}]})).timeout(const Duration(seconds: 40));
      final j = jsonDecode(res.body);
      if (res.statusCode != 200) throw Exception(j is Map && j['detail'] is String ? j['detail'] : 'The assistant had a problem. Try again.');
      setState(() => _msgs.add(_Msg('assistant', (j['reply'] ?? '').toString())));
    } catch (e) {
      setState(() => _err = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
      _down();
    }
  }

  void _down() => WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent, duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
      });

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('AnnSetu assistant')),
      body: Column(children: [
        Expanded(child: ListView(controller: _scroll, padding: const EdgeInsets.all(14), children: [
          if (_msgs.isEmpty) ...[
            Text('Hi! Ask me anything about AnnSetu.', style: t.textTheme.titleMedium),
            const SizedBox(height: 10),
            for (final s in _starters) Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: OutlinedButton(style: OutlinedButton.styleFrom(alignment: Alignment.centerLeft), onPressed: () => _send(s), child: Text(s)),
            ),
          ],
          for (final m in _msgs) _Bubble(m),
          if (_busy) const Padding(padding: EdgeInsets.all(8), child: Align(alignment: Alignment.centerLeft, child: SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2)))),
          if (_err != null) Padding(padding: const EdgeInsets.only(top: 6), child: Text(_err!, style: TextStyle(color: t.colorScheme.error))),
        ])),
        SafeArea(top: false, child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 6, 8, 8),
          child: Row(children: [
            Expanded(child: TextField(controller: _text, maxLength: 1500, minLines: 1, maxLines: 4, textInputAction: TextInputAction.send,
                onSubmitted: _send, decoration: const InputDecoration(hintText: 'Type your question…', counterText: ''))),
            const SizedBox(width: 6),
            IconButton.filled(onPressed: _busy ? null : () => _send(_text.text), icon: const Icon(Icons.send_rounded), tooltip: 'Send'),
          ]),
        )),
        Padding(padding: const EdgeInsets.only(bottom: 6), child: Text('AI answers can be wrong. For account issues, use Feedback.', style: t.textTheme.bodySmall)),
      ]),
    );
  }
}

/// Clean formatting: short paragraphs, "- " bullet lines, **bold**.
class _Bubble extends StatelessWidget {
  final _Msg m;
  const _Bubble(this.m);
  List<InlineSpan> _inline(String s, Color c) => [
        for (final part in _splitBold(s))
          part.startsWith('**') && part.endsWith('**') && part.length > 4
              ? TextSpan(text: part.substring(2, part.length - 2), style: TextStyle(fontWeight: FontWeight.w700, color: c))
              : TextSpan(text: part.replaceAll('*', ''), style: TextStyle(color: c)),
      ];
  static List<String> _splitBold(String s) {
    final out = <String>[];
    var i = 0;
    for (final mt in RegExp(r'\*\*[^*]+\*\*').allMatches(s)) {
      if (mt.start > i) out.add(s.substring(i, mt.start));
      out.add(mt.group(0)!);
      i = mt.end;
    }
    if (i < s.length) out.add(s.substring(i));
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    final mine = m.role == 'user';
    final c = mine ? Brand.cream : t.colorScheme.onSurface;
    final lines = m.text.replaceAll(RegExp(r'^#+\s*', multiLine: true), '').split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty);
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .84),
        margin: const EdgeInsets.only(top: 8),
        padding: const EdgeInsets.fromLTRB(12, 9, 12, 9),
        decoration: BoxDecoration(
          color: mine ? Brand.forest : t.colorScheme.surface,
          border: mine ? null : Border.all(color: t.dividerColor),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          for (final l in lines)
            RegExp(r'^([-•*]|\d+[.)])\s+').hasMatch(l)
                ? Padding(padding: const EdgeInsets.only(top: 4), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Padding(padding: const EdgeInsets.only(top: 7, right: 8), child: Container(width: 6, height: 6, decoration: BoxDecoration(color: mine ? Brand.gold : Brand.sage, shape: BoxShape.circle))),
                    Expanded(child: Text.rich(TextSpan(children: _inline(l.replaceFirst(RegExp(r'^([-•*]|\d+[.)])\s+'), ''), c)), style: const TextStyle(height: 1.35))),
                  ]))
                : Padding(padding: const EdgeInsets.only(top: 2), child: Text.rich(TextSpan(children: _inline(l, c)), style: const TextStyle(height: 1.35))),
          if (m.instant) Padding(padding: const EdgeInsets.only(top: 6), child: Text('⚡ instant answer', style: t.textTheme.labelSmall)),
        ]),
      ),
    );
  }
}
