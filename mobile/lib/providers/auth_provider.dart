import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/storage_service.dart';

class AuthProvider extends ChangeNotifier {
  final StorageService _storageService = StorageService();
  late ApiService _apiService;
  
  bool _isAuthenticated = false;
  bool _isLoading = true;
  String _serverUrl = '';
  
  // 2FA flow state
  bool _requires2FA = false;
  String? _tempToken;
  
  AuthProvider() {
    _apiService = ApiService(onUnauthorized: logout);
    _init();
  }
  
  bool get isAuthenticated => _isAuthenticated;
  bool get isLoading => _isLoading;
  String get serverUrl => _serverUrl;
  bool get requires2FA => _requires2FA;
  ApiService get apiService => _apiService;
  
  // Initialize state from storage
  Future<void> _init() async {
    _isLoading = true;
    notifyListeners();
    
    _serverUrl = await _storageService.getServerUrl();
    final token = await _storageService.getToken();
    
    if (token != null) {
      // Validate token (we can fetch system status to check if it's active)
      try {
        final response = await _apiService.get('/system/status');
        if (response.statusCode == 200) {
          _isAuthenticated = true;
        } else {
          // Token expired or invalid
          await _storageService.deleteToken();
          _isAuthenticated = false;
        }
      } catch (_) {
        // If offline/error, default to authenticated to allow offline use of stored token
        _isAuthenticated = true;
      }
    } else {
      _isAuthenticated = false;
    }
    
    _isLoading = false;
    notifyListeners();
  }
  
  // Regular Login
  Future<void> login(String serverUrl, String username, String password) async {
    _isLoading = true;
    _requires2FA = false;
    _tempToken = null;
    notifyListeners();
    
    try {
      // Save server URL first
      await _storageService.saveServerUrl(serverUrl);
      _serverUrl = await _storageService.getServerUrl();
      
      final result = await _apiService.login(username, password);
      
      if (result['status'] == 'requires_2fa') {
        _requires2FA = true;
        _tempToken = result['temp_token'];
        _isLoading = false;
        notifyListeners();
      } else if (result['status'] == 'success') {
        final token = result['access_token'];
        await _storageService.saveToken(token);
        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();
      } else {
        throw Exception('Bilinmeyen giriş durumu.');
      }
    } catch (e) {
      print('AUTH PROVIDER LOGIN ERROR: $e');
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }
  
  // Verify 2FA
  Future<void> verifyOTP(String code) async {
    if (_tempToken == null) {
      throw Exception('Geçici token bulunamadı.');
    }
    
    _isLoading = true;
    notifyListeners();
    
    try {
      final result = await _apiService.verify2FA(_tempToken!, code);
      if (result['status'] == 'success') {
        final token = result['access_token'];
        await _storageService.saveToken(token);
        _isAuthenticated = true;
        _requires2FA = false;
        _tempToken = null;
        _isLoading = false;
        notifyListeners();
      } else {
        throw Exception('Doğrulama başarısız.');
      }
    } catch (e) {
      _isLoading = false;
      notifyListeners();
      rethrow;
    }
  }
  
  // Cancel 2FA process
  void cancel2FA() {
    _requires2FA = false;
    _tempToken = null;
    notifyListeners();
  }
  
  // Logout
  Future<void> logout() async {
    _isLoading = true;
    notifyListeners();
    
    await _storageService.clearAll();
    _isAuthenticated = false;
    _requires2FA = false;
    _tempToken = null;
    
    _isLoading = false;
    notifyListeners();
  }
}
