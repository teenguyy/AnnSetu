import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../constants/env.dart';
import '../utils/format.dart';

/// Keeps the Supabase session in the Android Keystore-backed secure storage instead of plain preferences.
class SecureSessionStorage extends LocalStorage {
  const SecureSessionStorage();
  static const _key = 'annsetu.supabase.session';
  static const _store = FlutterSecureStorage();
  @override
  Future<void> initialize() async {}
  @override
  Future<bool> hasAccessToken() async => (await _store.read(key: _key)) != null;
  @override
  Future<String?> accessToken() => _store.read(key: _key);
  @override
  Future<void> removePersistedSession() => _store.delete(key: _key);
  @override
  Future<void> persistSession(String persistSessionString) => _store.write(key: _key, value: persistSessionString);
}

SupabaseClient get db => Supabase.instance.client;

/// Connects to the SAME Supabase project as the website, with PKCE deep-link auth and secure session storage.
Future<void> initSupabase() async {
  await Supabase.initialize(
    url: Env.supabaseUrl,
    publishableKey: Env.supabaseKey,
    authOptions: FlutterAuthClientOptions(
      authFlowType: AuthFlowType.pkce,
      localStorage: kIsWeb ? null : const SecureSessionStorage(),
    ),
    debug: false,
  );
}

class Store {
  static const listingPhotos = 'listing-photos';
  static const orgLogos = 'org-logos';
  static const verificationDocs = 'verification-docs';
  static const feedbackShots = 'feedback-screenshots';

  /// Uploads into the caller's own folder (`<uid>/...`), which the storage policies require.
  static Future<String> upload(String bucket, Uint8List bytes, String fileName, String contentType, {String sub = ''}) async {
    final uid = db.auth.currentUser!.id;
    final path = '$uid/$sub${DateTime.now().millisecondsSinceEpoch}-${safeName(fileName)}';
    await db.storage.from(bucket).uploadBinary(path, bytes, fileOptions: FileOptions(contentType: contentType, upsert: false));
    return path;
  }

  static String publicUrl(String bucket, String? path) =>
      (path == null || path.isEmpty) ? '' : db.storage.from(bucket).getPublicUrl(path);

  static Future<String> signedUrl(String bucket, String path, {int seconds = 300}) =>
      db.storage.from(bucket).createSignedUrl(path, seconds);

  static String contentTypeFor(String name) {
    final n = name.toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.pdf')) return 'application/pdf';
    return 'image/jpeg';
  }
}
