// Simple in-memory settings without external dependencies
class SimpleSettings {
  static final Map<String, dynamic> _settings = {};
  
  static Future<void> setBool(String key, bool value) async {
    _settings[key] = value;
  }
  
  static Future<void> setDouble(String key, double value) async {
    _settings[key] = value;
  }
  
  static Future<void> setString(String key, String value) async {
    _settings[key] = value;
  }
  
  static bool getBool(String key, {bool defaultValue = false}) {
    return _settings[key] as bool? ?? defaultValue;
  }
  
  static double getDouble(String key, {double defaultValue = 0.0}) {
    return _settings[key] as double? ?? defaultValue;
  }
  
  static String getString(String key, {String defaultValue = ''}) {
    return _settings[key] as String? ?? defaultValue;
  }
  
  static Future<bool> remove(String key) async {
    return _settings.remove(key) != null;
  }
  
  static Future<bool> clear() async {
    _settings.clear();
    return true;
  }
}