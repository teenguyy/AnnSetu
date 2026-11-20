import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Light / dark / system, remembered on the device.
class ThemeController extends ValueNotifier<ThemeMode> {
  ThemeController._() : super(ThemeMode.system);
  static final ThemeController instance = ThemeController._();
  static const _key = 'annsetu.theme';

  Future<void> load() async {
    final v = (await SharedPreferences.getInstance()).getString(_key);
    value = ThemeMode.values.firstWhere((m) => m.name == v, orElse: () => ThemeMode.system);
  }

  Future<void> set(ThemeMode m) async {
    value = m;
    await (await SharedPreferences.getInstance()).setString(_key, m.name);
  }
}
