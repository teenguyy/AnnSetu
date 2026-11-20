/// Build-time configuration. Values come from `--dart-define` (see docs/03_SETUP_AND_DEPLOYMENT.md).
/// Defaults point at the SAME Supabase project the AnnSetu website uses (website/supabase-config.js),
/// so both clients share accounts, listings, requests, messages and notifications.
/// Only the publishable key is ever shipped. Never put a service_role / secret key here.
class Env {
  static const supabaseUrl = String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://wwnkyukqiibbzqqbfsxp.supabase.co');
  static const supabaseKey = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY', defaultValue: 'sb_publishable_WUzn-_25u3USE5u30VyxpA_AZ8-wfkt');

  /// The AnnSetu website (opened from Profile → "Open AnnSetu website").
  static const websiteUrl = String.fromEnvironment('WEBSITE_URL', defaultValue: 'https://annsetu-inky.vercel.app');

  /// AnnSetu FastAPI backend (AI document review + assistant), served by the website under /api.
  static const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://annsetu-inky.vercel.app/api');

  /// Free map services (no key, no card): OpenStreetMap tiles, OSRM routing, Nominatim geocoding.
  static const osmTiles = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  static const osrm = 'https://router.project-osrm.org/route/v1/driving/';
  static const nominatim = 'https://nominatim.openstreetmap.org/reverse';

  /// Deep link Supabase redirects to after Google sign-in, email confirmation and password reset.
  /// Must be listed in Supabase → Authentication → URL Configuration → Redirect URLs.
  static const authRedirect = 'annsetu://login-callback';

  /// Optional Firebase Cloud Messaging (push). Push is enabled only when all four are provided.
  static const fbApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const fbAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const fbSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');
  static const fbProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static bool get pushConfigured => fbApiKey.isNotEmpty && fbAppId.isNotEmpty && fbSenderId.isNotEmpty && fbProjectId.isNotEmpty;

  static const supportEmail = String.fromEnvironment('SUPPORT_EMAIL', defaultValue: '');
}
