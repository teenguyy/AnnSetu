import 'dart:async';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../core/models/models.dart';
import '../../core/services/messaging_service.dart';
import '../../core/services/supabase_service.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/common.dart';

/// Private conversations per pickup (same `messages` table as the website).
/// Each thread is visible ONLY to its two parties: donor_ngo, donor_rep, ngo_rep (enforced by the database).
const chatThreads = {
  'donor': [('donor_ngo', 'ngo'), ('donor_rep', 'rep')],
  'ngo': [('donor_ngo', 'donor'), ('ngo_rep', 'rep')],
  'rep': [('donor_rep', 'donor'), ('ngo_rep', 'ngo')],
};

class ChatScreen extends StatefulWidget {
  final String requestId, title, side;
  final Map<String, String> names; // donor / ngo / rep display names
  const ChatScreen({super.key, required this.requestId, required this.title, this.side = 'donor', this.names = const {}});
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final _text = TextEditingController();
  final _scroll = ScrollController();
  List<ChatMessage>? _msgs;
  Object? _error;
  RealtimeChannel? _ch;
  Timer? _poll;
  bool _sending = false;
  late final List<(String, String)> _threads = chatThreads[widget.side] ?? chatThreads['donor']!;
  late String _thread = _threads.first.$1;
  String _label(String who) => widget.names[who] ?? (who == 'ngo' ? 'Receiver' : who == 'rep' ? 'Representative' : 'Donor');
  String get _other => _label(_threads.firstWhere((x) => x.$1 == _thread).$2);

  @override
  void initState() {
    super.initState();
    _load();
    _ch = MessagingService.watch(widget.requestId, _load);
    _poll = Timer.periodic(const Duration(seconds: 8), (_) => _load()); // website uses the same fallback
  }

  @override
  void dispose() {
    _poll?.cancel();
    if (_ch != null) db.removeChannel(_ch!);
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final m = await MessagingService.load(widget.requestId, _thread);
      if (!mounted) return;
      final grew = (_msgs?.length ?? 0) != m.length;
      setState(() { _msgs = m; _error = null; });
      if (grew) WidgetsBinding.instance.addPostFrameCallback((_) { if (_scroll.hasClients) _scroll.jumpTo(_scroll.position.maxScrollExtent); });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  Future<void> _send() async {
    final b = _text.text.trim();
    if (b.isEmpty || _sending) return;
    setState(() => _sending = true);
    _text.clear();
    try {
      await MessagingService.send(widget.requestId, b, _thread);
      await _load();
    } catch (e) {
      _text.text = b;
      if (mounted) showErr(context, e);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = db.auth.currentUser?.id;
    final t = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(widget.title, overflow: TextOverflow.ellipsis),
        Text('Private · only you and $_other', style: t.textTheme.bodySmall),
      ])),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
          child: SegmentedButton<String>(
            segments: [for (final th in _threads) ButtonSegment(value: th.$1, label: Text(_label(th.$2), overflow: TextOverflow.ellipsis))],
            selected: {_thread},
            showSelectedIcon: false,
            onSelectionChanged: (v) { setState(() { _thread = v.first; _msgs = null; }); _load(); },
          ),
        ),
        Expanded(
          child: _msgs == null
              ? (_error != null ? ErrorState(error: _error!, onRetry: _load) : const Center(child: BridgeLoader()))
              : _msgs!.isEmpty
                  ? EmptyState(icon: Icons.lock_outline_rounded, title: 'No messages yet', text: 'Say hello to $_other. Only the two of you can see this chat.')
                  : ListView.builder(
                      controller: _scroll, padding: const EdgeInsets.fromLTRB(14, 12, 14, 12), itemCount: _msgs!.length,
                      itemBuilder: (_, i) {
                        final m = _msgs![i];
                        final mine = m.senderId == me;
                        final prev = i > 0 ? _msgs![i - 1] : null;
                        final grouped = prev != null && prev.senderId == m.senderId && m.createdAt.difference(prev.createdAt).inMinutes < 2;
                        return Align(
                          alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
                          child: Container(
                            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * .78),
                            margin: EdgeInsets.only(top: grouped ? 2 : 8),
                            padding: const EdgeInsets.fromLTRB(12, 7, 10, 6),
                            decoration: BoxDecoration(
                              color: mine ? Brand.forest : t.colorScheme.surface,
                              border: mine ? null : Border.all(color: t.colorScheme.outline.withValues(alpha: .7)),
                              borderRadius: BorderRadius.only(topLeft: const Radius.circular(18), topRight: const Radius.circular(18),
                                  bottomLeft: Radius.circular(mine ? 18 : 4), bottomRight: Radius.circular(mine ? 4 : 18)),
                            ),
                            child: Wrap(crossAxisAlignment: WrapCrossAlignment.end, spacing: 8, children: [
                              Text(m.body, style: TextStyle(color: mine ? Brand.cream : t.colorScheme.onSurface, fontSize: 15, height: 1.3)),
                              Text(fmtT(m.createdAt), style: TextStyle(fontSize: 10.5, color: mine ? Brand.cream.withValues(alpha: .65) : t.colorScheme.onSurfaceVariant)),
                            ]),
                          ),
                        );
                      },
                    ),
        ),
        SafeArea(
          top: false,
          child: Container(
            padding: const EdgeInsets.fromLTRB(12, 8, 8, 8),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: t.colorScheme.outline.withValues(alpha: .6)))),
            child: Row(children: [
              Expanded(child: TextField(
                controller: _text, maxLength: 1000, minLines: 1, maxLines: 4, textInputAction: TextInputAction.send,
                onSubmitted: (_) => _send(), decoration: const InputDecoration(hintText: 'Write a message…', counterText: ''),
              )),
              const SizedBox(width: 6),
              IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send_rounded), tooltip: 'Send'),
            ]),
          ),
        ),
      ]),
    );
  }
}
