import 'package:supabase_flutter/supabase_flutter.dart' show OAuthProvider;
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../core/constants/domain.dart';
import '../../core/services/auth_service.dart';
import '../../core/services/session.dart';
import '../../core/theme/app_theme.dart';
import '../../core/utils/format.dart';
import '../../shared/widgets/brand.dart';
import '../../shared/widgets/common.dart';

/// Shared layout: forest header with the brand, cream sheet with the form.
class _AuthScaffold extends StatelessWidget {
  final String title, subtitle;
  final Widget child;
  final bool back;
  const _AuthScaffold({required this.title, required this.subtitle, required this.child, this.back = false});
  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context);
    return Scaffold(
      backgroundColor: Brand.forest,
      body: SafeArea(
        bottom: false,
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 8, 20, 18),
            child: Row(children: [
              if (back) IconButton(onPressed: () => context.canPop() ? context.pop() : context.go('/signin'), icon: const Icon(Icons.arrow_back_rounded, color: Brand.cream), tooltip: 'Back')
              else const SizedBox(width: 8),
              const Logo(size: 30, onDark: true),
            ]),
          ),
          Expanded(
            child: Material( // a Material surface so list tiles and buttons show their ink ripples
              color: t.scaffoldBackgroundColor,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
              clipBehavior: Clip.antiAlias,
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(title, style: t.textTheme.displaySmall),
                  const SizedBox(height: 6),
                  Text(subtitle, style: t.textTheme.bodyLarge?.copyWith(color: t.colorScheme.onSurfaceVariant)),
                  const SizedBox(height: 26),
                  child,
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _GoogleButton extends StatelessWidget {
  final Role? role;
  final String label;
  const _GoogleButton({this.role, required this.label});
  @override
  Widget build(BuildContext context) => SizedBox(
        width: double.infinity,
        child: Column(children: [
          BusyButton(outlined: true, icon: Icons.g_mobiledata_rounded, onPressed: () => AuthService.google(role: role), child: Text(label)),
          const SizedBox(height: 8),
          BusyButton(outlined: true, icon: Icons.apple_rounded, onPressed: () => AuthService.oauth(OAuthProvider.apple, role: role), child: Text(label.replaceAll('Google', 'Apple'))),
          const SizedBox(height: 8),
          BusyButton(outlined: true, icon: Icons.window_rounded, onPressed: () => AuthService.oauth(OAuthProvider.azure, role: role), child: Text(label.replaceAll('Google', 'Microsoft'))),
        ]),
      );
}

class _Or extends StatelessWidget {
  const _Or();
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 18),
        child: Row(children: [
          const Expanded(child: Divider()),
          Padding(padding: const EdgeInsets.symmetric(horizontal: 12), child: Text('or', style: Theme.of(context).textTheme.bodySmall)),
          const Expanded(child: Divider()),
        ]),
      );
}

class PasswordField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final bool meter;
  final String? autofill;
  final void Function(String)? onSubmitted;
  const PasswordField({super.key, required this.controller, this.label = 'Password', this.meter = false, this.autofill, this.onSubmitted});
  @override
  State<PasswordField> createState() => _PasswordFieldState();
}

class _PasswordFieldState extends State<PasswordField> {
  bool show = false;
  @override
  Widget build(BuildContext context) {
    final s = V.strength(widget.controller.text);
    const colors = [Brand.terracotta, Brand.gold, Brand.sage, Brand.forest];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextFormField(
        controller: widget.controller,
        obscureText: !show,
        autofillHints: widget.autofill == null ? null : [widget.autofill!],
        onChanged: widget.meter ? (_) => setState(() {}) : null,
        onFieldSubmitted: widget.onSubmitted,
        validator: widget.meter ? V.password : (v) => (v ?? '').isEmpty ? 'Enter your password.' : null,
        decoration: InputDecoration(
          labelText: widget.label, prefixIcon: const Icon(Icons.lock_outline_rounded),
          suffixIcon: IconButton(onPressed: () => setState(() => show = !show),
              icon: Icon(show ? Icons.visibility_off_outlined : Icons.visibility_outlined), tooltip: show ? 'Hide password' : 'Show password'),
        ),
      ),
      if (widget.meter) ...[
        const SizedBox(height: 8),
        Row(children: [for (var i = 0; i < 4; i++) Expanded(child: Container(
          height: 4, margin: EdgeInsets.only(right: i < 3 ? 4 : 0),
          decoration: BoxDecoration(borderRadius: BorderRadius.circular(2), color: i < s ? colors[s - 1] : Theme.of(context).colorScheme.outline.withValues(alpha: .5)),
        ))]),
      ],
    ]);
  }
}

// ------------------------------------------------------------------ sign in
class SignInScreen extends StatefulWidget {
  const SignInScreen({super.key});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _f = GlobalKey<FormState>();
  final _email = TextEditingController(), _pw = TextEditingController();

  Future<void> _submit() async {
    if (!_f.currentState!.validate()) return;
    await AuthService.signIn(_email.text, _pw.text); // the router moves on when the session is ready
  }

  @override
  Widget build(BuildContext context) => _AuthScaffold(
        title: 'Welcome back',
        subtitle: 'Sign in to continue making a difference.',
        child: AutofillGroup(
          child: Form(
            key: _f,
            child: Column(children: [
              TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email],
                  validator: V.emailAddr, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.alternate_email_rounded))),
              const SizedBox(height: 14),
              PasswordField(controller: _pw, autofill: AutofillHints.password, onSubmitted: (_) => _submit()),
              Align(alignment: Alignment.centerRight, child: TextButton(onPressed: () => context.push('/forgot'), child: const Text('Forgot password?'))),
              const SizedBox(height: 4),
              BusyButton(expand: true, onPressed: _submit, child: const Text('Sign in')),
              const _Or(),
              const _GoogleButton(label: 'Continue with Google'),
              const SizedBox(height: 22),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                const Text('New to AnnSetu?'),
                TextButton(onPressed: () => context.go('/register'), child: const Text('Create an account')),
              ]),
            ]),
          ),
        ),
      );
}

// ------------------------------------------------------------------ register (with role selection)
class RegisterScreen extends StatefulWidget {
  final Role? initialRole;
  const RegisterScreen({super.key, this.initialRole});
  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _f = GlobalKey<FormState>();
  final _name = TextEditingController(), _email = TextEditingController(), _pw = TextEditingController();
  late Role? _role = widget.initialRole == Role.admin ? null : widget.initialRole;
  bool _terms = false;
  String? _sentTo;

  Future<void> _submit() async {
    if (_role == null) throw Exception('Please choose how you are joining.');
    if (!_f.currentState!.validate()) return;
    if (!_terms) throw Exception('Please accept the terms to continue.');
    final started = await AuthService.register(name: _name.text, email: _email.text, password: _pw.text, role: _role!);
    if (!started && mounted) setState(() => _sentTo = _email.text.trim());
  }

  Widget _roleCard(Role r, IconData icon, String title, String sub) {
    final on = _role == r;
    final t = Theme.of(context);
    return Expanded(
      child: Semantics(
        button: true, selected: on, label: 'Join as $title. $sub', excludeSemantics: true,
        onTap: () => setState(() => _role = r),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          decoration: BoxDecoration(
            color: on ? Brand.forest : t.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: on ? Brand.gold : t.colorScheme.outline, width: on ? 1.6 : 1),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: () => setState(() => _role = r),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(icon, color: on ? Brand.gold : t.colorScheme.primary),
                const SizedBox(height: 10),
                Text(title, style: TextStyle(fontFamily: serif, fontSize: 20, color: on ? Brand.cream : t.colorScheme.onSurface)),
                const SizedBox(height: 2),
                Text(sub, style: TextStyle(fontSize: 12.5, color: on ? Brand.cream.withValues(alpha: .8) : t.colorScheme.onSurfaceVariant)),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_sentTo != null) {
      return _AuthScaffold(
        title: 'Check your email',
        subtitle: 'We sent a confirmation link to $_sentTo.',
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('After confirming, sign in and complete your organisation profile. An admin will then verify it.'),
          const SizedBox(height: 22),
          FilledButton(onPressed: () => context.go('/signin'), child: const Text('Back to sign in')),
        ]),
      );
    }
    return _AuthScaffold(
      title: 'Join AnnSetu',
      subtitle: 'Create an account and help move food to people who need it.',
      child: Form(
        key: _f,
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('I AM JOINING AS', style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(height: 10),
          Row(children: [
            _roleCard(Role.donor, Icons.restaurant_rounded, 'Donor', 'Restaurant, hotel, canteen, event'),
            const SizedBox(width: 12),
            _roleCard(Role.ngo, Icons.volunteer_activism_rounded, 'Receiver', 'NGO, shelter, community kitchen'),
          ]),
          const SizedBox(height: 12),
          Row(children: [_roleCard(Role.rep, Icons.delivery_dining_rounded, 'Representative', 'Collect food for an NGO')]),
          if (_role == Role.rep) Padding(padding: const EdgeInsets.only(top: 8),
              child: Text('Use the same email your NGO saved for you. Your account links to them automatically.', style: Theme.of(context).textTheme.bodySmall)),
          const SizedBox(height: 20),
          TextFormField(controller: _name, textCapitalization: TextCapitalization.words, autofillHints: const [AutofillHints.name],
              validator: (v) => V.minLen(v, 2, 'Your name'), decoration: const InputDecoration(labelText: 'Full name', prefixIcon: Icon(Icons.person_outline_rounded))),
          const SizedBox(height: 14),
          TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email],
              validator: V.emailAddr, decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.alternate_email_rounded))),
          const SizedBox(height: 14),
          PasswordField(controller: _pw, meter: true, autofill: AutofillHints.newPassword),
          const SizedBox(height: 8),
          CheckboxListTile(
            value: _terms, onChanged: (v) => setState(() => _terms = v ?? false), contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading, title: const Text('I agree to the Terms and Privacy Policy'),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Theme.of(context).colorScheme.secondaryContainer, borderRadius: BorderRadius.circular(12)),
            child: Text('Organisations are reviewed by an admin before they can list or request food.',
                style: TextStyle(color: Theme.of(context).colorScheme.onSecondaryContainer, fontSize: 13)),
          ),
          const SizedBox(height: 18),
          BusyButton(expand: true, onPressed: _submit, child: const Text('Create account')),
          const _Or(),
          _GoogleButton(role: _role, label: 'Sign up with Google'),
          if (_role == null) Padding(padding: const EdgeInsets.only(top: 6),
              child: Text('Choose Donor or Receiver first so your Google account gets the right role.', style: Theme.of(context).textTheme.bodySmall)),
          const SizedBox(height: 16),
          Center(child: TextButton(onPressed: () => context.go('/signin'), child: const Text('I already have an account'))),
        ]),
      ),
    );
  }
}

// ------------------------------------------------------------------ forgot / reset
class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});
  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _f = GlobalKey<FormState>();
  final _email = TextEditingController();
  bool _sent = false;
  @override
  Widget build(BuildContext context) => _AuthScaffold(
        back: true,
        title: _sent ? 'Check your email' : 'Reset password',
        subtitle: _sent ? 'If that address has an account, a reset link is on its way.' : 'We’ll email you a link to choose a new one.',
        child: _sent
            ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Open the link on this phone to set a new password in the app. Links expire after a short time for your safety.'),
                const SizedBox(height: 20),
                FilledButton(onPressed: () => context.go('/signin'), child: const Text('Back to sign in')),
              ])
            : Form(
                key: _f,
                child: Column(children: [
                  TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, validator: V.emailAddr,
                      decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.alternate_email_rounded))),
                  const SizedBox(height: 18),
                  BusyButton(expand: true, onPressed: () async {
                    if (!_f.currentState!.validate()) return;
                    await AuthService.sendReset(_email.text);
                    setState(() => _sent = true);
                  }, child: const Text('Send reset link')),
                ]),
              ),
      );
}

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});
  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _f = GlobalKey<FormState>();
  final _pw = TextEditingController();
  @override
  Widget build(BuildContext context) => _AuthScaffold(
        title: 'Choose a new password',
        subtitle: 'Pick something strong you haven’t used before.',
        child: Form(
          key: _f,
          child: Column(children: [
            PasswordField(controller: _pw, label: 'New password', meter: true, autofill: AutofillHints.newPassword),
            const SizedBox(height: 18),
            BusyButton(expand: true, icon: Icons.check_rounded, onPressed: () async {
              if (!_f.currentState!.validate()) return;
              await AuthService.updatePassword(_pw.text);
              if (!context.mounted) return;
              showOk(context, 'Password updated.');
              await AppSession.instance.load(); // router continues to the dashboard
            }, child: const Text('Update password')),
          ]),
        ),
      );
}
