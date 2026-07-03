import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class StorageService {
  static const String _keyToken = 'mpanel_jwt_token';
  static const String _keyServerUrl = 'mpanel_server_url';
  static const String _keyRememberMe = 'mpanel_remember_me';
  static const String _keySavedUsername = 'mpanel_saved_username';
  static const String _keySavedPassword = 'mpanel_saved_password';
  
  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  
  // Secure Storage: Token Management
  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: _keyToken, value: token);
  }
  
  Future<String?> getToken() async {
    return await _secureStorage.read(key: _keyToken);
  }
  
  Future<void> deleteToken() async {
    await _secureStorage.delete(key: _keyToken);
  }
  
  // Shared Preferences: Settings & Config
  Future<void> saveServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    // Normalize url
    String normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      // Default to https if no protocol specified
      normalized = 'https://$normalized';
    }
    // Remove trailing slash if exists
    if (normalized.endsWith('/')) {
      normalized = normalized.substring(0, normalized.length - 1);
    }
    await prefs.setString(_keyServerUrl, normalized);
  }
  
  Future<String> getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keyServerUrl) ?? 'https://panel.mehmetaymaz.com.tr:8443';
  }

  // Remember Me helpers
  Future<void> saveRememberMe(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_keyRememberMe, value);
  }

  Future<bool> getRememberMe() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_keyRememberMe) ?? false;
  }

  Future<void> saveSavedUsername(String username) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keySavedUsername, username);
  }

  Future<String?> getSavedUsername() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_keySavedUsername);
  }

  Future<void> deleteSavedUsername() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySavedUsername);
  }

  Future<void> saveSavedPassword(String password) async {
    await _secureStorage.write(key: _keySavedPassword, value: password);
  }

  Future<String?> getSavedPassword() async {
    return await _secureStorage.read(key: _keySavedPassword);
  }

  Future<void> deleteSavedPassword() async {
    await _secureStorage.delete(key: _keySavedPassword);
  }
  
  // Clear all cached credentials/data
  Future<void> clearAll() async {
    await deleteToken();
    // Keep server URL so the user doesn't have to re-type it, but clear token.
  }
}
