import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../services/api_service.dart';
import '../services/update_service.dart';

class SettingsProvider extends ChangeNotifier {
  Map<String, dynamic> _settings = {};
  bool _isLoading = false;
  bool _isSaving = false;
  bool _isTesting = false;
  String? _errorMessage;

  // Update check states
  bool _isCheckingUpdate = false;
  bool _isDownloadingUpdate = false;
  double _downloadProgress = 0.0;
  bool _updateAvailable = false;
  String _latestVersion = '';
  String _changelog = '';
  String? _apkDownloadUrl;
  final UpdateService _updateService = UpdateService();
  String _currentAppVersion = 'v1.0.0';

  bool get isCheckingUpdate => _isCheckingUpdate;
  bool get isDownloadingUpdate => _isDownloadingUpdate;
  double get downloadProgress => _downloadProgress;
  bool get updateAvailable => _updateAvailable;
  String get latestVersion => _latestVersion;
  String get changelog => _changelog;
  String? get apkDownloadUrl => _apkDownloadUrl;
  String get currentAppVersion => _currentAppVersion;

  // Local notification preferences (simulated push)
  bool _notifyCpuRam = true;
  bool _notifyExpiry = true;
  bool _notifyNewUser = false;

  Map<String, dynamic> get settings => _settings;
  bool get isLoading => _isLoading;
  bool get isSaving => _isSaving;
  bool get isTesting => _isTesting;
  String? get errorMessage => _errorMessage;

  String getSettingValue(String key) {
    return _settings[key]?.toString() ?? '';
  }

  bool get notifyCpuRam => _notifyCpuRam;
  bool get notifyExpiry => _notifyExpiry;
  bool get notifyNewUser => _notifyNewUser;

  SettingsProvider() {
    loadLocalNotificationPreferences();
    initVersion();
  }

  Future<void> initVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      _currentAppVersion = 'v${packageInfo.version}';
      notifyListeners();
    } catch (_) {}
  }

  // 1. Fetch System Settings
  Future<void> fetchSettings(ApiService apiService, {bool isSilent = false}) async {
    if (!isSilent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await apiService.get('/settings/');
      if (response.statusCode == 200) {
        _settings = jsonDecode(response.body);
        _errorMessage = null;
      } else {
        _errorMessage = 'Ayarlar yüklenemedi. Sunucu hata kodu bildirdi.';
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 2. Update System Settings (Telegram configurations, etc.)
  Future<void> updateSettings(ApiService apiService, List<Map<String, String>> settingsList) async {
    _isSaving = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.put('/settings/', settingsList);
      if (response.statusCode == 200) {
        // Refresh local cache
        await fetchSettings(apiService, isSilent: true);
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Ayarlar kaydedilemedi.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  // 3. Change Administrator Password
  Future<void> changePassword(ApiService apiService, String currentPassword, String newPassword) async {
    _isSaving = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.post('/settings/change-password', {
        'current_password': currentPassword,
        'new_password': newPassword,
      });

      if (response.statusCode != 200) {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Şifre değiştirilemedi.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isSaving = false;
      notifyListeners();
    }
  }

  // 4. Test Telegram Integration Alert
  Future<void> testTelegram(ApiService apiService) async {
    _isTesting = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.post('/settings/telegram/test', {});
      if (response.statusCode != 200) {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Telegram testi başarısız.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isTesting = false;
      notifyListeners();
    }
  }

  // 5. Manage local push notification preferences
  Future<void> loadLocalNotificationPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _notifyCpuRam = prefs.getBool('notify_cpu_ram') ?? true;
      _notifyExpiry = prefs.getBool('notify_expiry') ?? true;
      _notifyNewUser = prefs.getBool('notify_new_user') ?? false;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> setNotifyCpuRam(bool value) async {
    _notifyCpuRam = value;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('notify_cpu_ram', value);
    } catch (_) {}
  }

  Future<void> setNotifyExpiry(bool value) async {
    _notifyExpiry = value;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('notify_expiry', value);
    } catch (_) {}
  }

  Future<void> setNotifyNewUser(bool value) async {
    _notifyNewUser = value;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('notify_new_user', value);
    } catch (_) {}
  }

  // 6. Check for App Updates on GitHub
  Future<void> checkForUpdates(String currentVersion) async {
    _isCheckingUpdate = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _updateService.checkUpdate(currentVersion);
      _updateAvailable = result['has_update'] ?? false;
      _latestVersion = result['latest_version'] ?? '';
      _changelog = result['changelog'] ?? '';
      _apkDownloadUrl = result['apk_url'];
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      _updateAvailable = false;
    } finally {
      _isCheckingUpdate = false;
      notifyListeners();
    }
  }

  // 7. Download and Install the Update APK
  Future<void> downloadAndInstallUpdate() async {
    if (_apkDownloadUrl == null || _apkDownloadUrl!.isEmpty) {
      throw Exception('İndirme adresi bulunamadı.');
    }

    _isDownloadingUpdate = true;
    _downloadProgress = 0.0;
    _errorMessage = null;
    notifyListeners();

    try {
      final apkFile = await _updateService.downloadApk(_apkDownloadUrl!, (progress) {
        _downloadProgress = progress;
        notifyListeners();
      });
      
      // Start Android APK installation intent
      await _updateService.installApk(apkFile.path);
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isDownloadingUpdate = false;
      notifyListeners();
    }
  }
}
