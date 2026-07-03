import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LanguageProvider extends ChangeNotifier {
  static const String _keyLanguage = 'mpanel_app_language';
  String _currentLanguage = 'tr';
  bool _isLoading = true;

  String get currentLanguage => _currentLanguage;
  bool get isLoading => _isLoading;

  LanguageProvider() {
    _loadLanguage();
  }

  Future<void> _loadLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _currentLanguage = prefs.getString(_keyLanguage) ?? 'tr';
    } catch (_) {
      _currentLanguage = 'tr';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> setLanguage(String langCode) async {
    if (langCode == _currentLanguage) return;
    _currentLanguage = langCode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyLanguage, langCode);
    } catch (_) {}
  }
}
