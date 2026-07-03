import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ApiTokenProvider extends ChangeNotifier {
  List<dynamic> _tokens = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<dynamic> get tokens => _tokens;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // 1. Fetch API Tokens
  Future<void> fetchTokens(ApiService apiService, {bool isSilent = false}) async {
    if (!isSilent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await apiService.get('/auth/api-tokens');
      if (response.statusCode == 200) {
        _tokens = jsonDecode(response.body);
        _errorMessage = null;
      } else {
        _errorMessage = 'API anahtarları yüklenemedi. Sunucu hata kodu bildirdi.';
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 2. Create API Token
  Future<Map<String, dynamic>> createToken(
      ApiService apiService, String name, String scope) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.post(
        '/auth/api-tokens',
        {'name': name, 'scope': scope},
      );
      if (response.statusCode == 200) {
        final newToken = jsonDecode(response.body);
        await fetchTokens(apiService, isSilent: true);
        return newToken;
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'API Anahtarı oluşturulurken hata oluştu.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 3. Delete API Token
  Future<void> deleteToken(ApiService apiService, int tokenId) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.delete('/auth/api-tokens/$tokenId');
      if (response.statusCode == 200) {
        _tokens.removeWhere((element) => element['id'] == tokenId);
        _errorMessage = null;
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'API Anahtarı silinemedi.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
