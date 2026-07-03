import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/theme.dart';

class ThemeProvider extends ChangeNotifier {
  static const String _keyTheme = 'mpanel_app_theme';
  String _currentTheme = 'cyberpunk';
  bool _isLoading = true;

  String get currentTheme => _currentTheme;
  bool get isLoading => _isLoading;

  ThemeProvider() {
    _loadTheme();
  }

  Future<void> _loadTheme() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _currentTheme = prefs.getString(_keyTheme) ?? 'cyberpunk';
      _applyThemeColors(_currentTheme);
    } catch (_) {
      _currentTheme = 'cyberpunk';
      _applyThemeColors('cyberpunk');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> setTheme(String themeName) async {
    if (themeName == _currentTheme) return;
    _currentTheme = themeName;
    _applyThemeColors(themeName);
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyTheme, themeName);
    } catch (_) {}
  }

  void _applyThemeColors(String themeName) {
    switch (themeName) {
      case 'dracula':
        AppColors.setTheme(DraculaTheme());
        break;
      case 'nord':
        AppColors.setTheme(NordTheme());
        break;
      case 'emerald':
        AppColors.setTheme(EmeraldTheme());
        break;
      case 'light':
        AppColors.setTheme(LightTheme());
        break;
      case 'dark':
        AppColors.setTheme(DarkTheme());
        break;
      case 'gold':
        AppColors.setTheme(GoldTheme());
        break;
      case 'cyberpunk':
      default:
        AppColors.setTheme(CyberpunkTheme());
        break;
    }
  }
}
