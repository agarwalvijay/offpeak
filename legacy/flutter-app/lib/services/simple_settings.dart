import 'package:shared_preferences/shared_preferences.dart';

class SimpleSettings {
  static SharedPreferences? _prefs;

  static Future<void> init() async {
    _prefs ??= await SharedPreferences.getInstance();
  }

  static Future<void> setBool(String key, bool value) async {
    await init();
    await _prefs!.setBool(key, value);
  }

  static Future<void> setDouble(String key, double value) async {
    await init();
    await _prefs!.setDouble(key, value);
  }

  static Future<void> setString(String key, String value) async {
    await init();
    await _prefs!.setString(key, value);
  }

  static bool getBool(String key, {bool defaultValue = false}) {
    return _prefs?.getBool(key) ?? defaultValue;
  }

  static double getDouble(String key, {double defaultValue = 0.0}) {
    return _prefs?.getDouble(key) ?? defaultValue;
  }

  static String getString(String key, {String defaultValue = ''}) {
    return _prefs?.getString(key) ?? defaultValue;
  }

  static Future<void> remove(String key) async {
    await init();
    await _prefs!.remove(key);
  }
}
