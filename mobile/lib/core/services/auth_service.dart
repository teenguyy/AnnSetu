import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/domain.dart';
import '../constants/env.dart';
import 'session.dart';
import 'supabase_service.dart';

/// Supabase Auth, exactly as the website uses it (website/src/SignIn.jsx).
class AuthService {
  static Future<void> signIn(String email, String password) async {
    await db.auth.signInWithPassword(email: email.trim(), password: password);
  }

  /// Returns true when a session started immediately (email confirmation off),
  /// false when the user must confirm their email first.
  static Future<bool> register({required String name, required String email, required String password, required Role role}) async {
    final r = await db.auth.signUp(
      email: email.trim(),
      password: password,
      data: {'role': role.name, 'full_name': name.trim()}, // read by the handle_new_user trigger
      emailRedirectTo: Env.authRedirect,
    );
    if (r.user != null && (r.user!.identities?.isEmpty ?? false)) {
      throw const AuthException('User already registered');
    }
    return r.session != null;
  }

  static Future<void> sendReset(String email) =>
      db.auth.resetPasswordForEmail(email.trim(), redirectTo: Env.authRedirect);

  static Future<void> updatePassword(String password) async {
    await db.auth.updateUser(UserAttributes(password: password));
    AppSession.instance.recoveringPassword = false;
  }

  /// Google sign-in. [role] is applied after the redirect if the account is new (no organisation yet).
  static Future<void> google({Role? role}) => oauth(OAuthProvider.google, role: role);

  /// Google, Apple or Microsoft (Supabase provider "azure"). Each must be enabled in Supabase first.
  static Future<void> oauth(OAuthProvider provider, {Role? role}) async {
    if (role != null && role != Role.admin) await AppSession.rememberRoleForOAuth(role);
    await db.auth.signInWithOAuth(provider, redirectTo: Env.authRedirect, authScreenLaunchMode: LaunchMode.externalApplication,
        scopes: provider == OAuthProvider.azure ? 'email' : null);
  }
}
