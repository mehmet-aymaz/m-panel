import 'dart:convert';
import 'package:http/http.dart' as http;
import 'storage_service.dart';

class ApiService {
  final StorageService _storageService = StorageService();
  void Function()? onUnauthorized;
  
  ApiService({this.onUnauthorized});

  // Base request headers helper
  Future<Map<String, String>> _getHeaders({bool requireAuth = true}) async {
    final Map<String, String> headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    
    if (requireAuth) {
      final token = await _storageService.getToken();
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }
    return headers;
  }

  // Handle Response and capture 401 Unauthorized errors
  void _handleResponseStatus(http.Response response) {
    if (response.statusCode == 401) {
      if (onUnauthorized != null) {
        onUnauthorized!();
      }
    }
  }

  // HTTP GET
  Future<http.Response> get(String path, {bool requireAuth = true}) async {
    final baseUrl = await _storageService.getServerUrl();
    final url = Uri.parse('$baseUrl/api$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    
    try {
      final response = await http.get(url, headers: headers);
      _handleResponseStatus(response);
      return response;
    } catch (e) {
      print('API GET ERROR: calling $path: $e');
      throw Exception('Bağlantı hatası: Sunucuya erişilemiyor.');
    }
  }

  // HTTP POST
  Future<http.Response> post(String path, dynamic body, {bool requireAuth = true}) async {
    final baseUrl = await _storageService.getServerUrl();
    final url = Uri.parse('$baseUrl/api$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    
    try {
      final response = await http.post(
        url,
        headers: headers,
        body: jsonEncode(body),
      );
      _handleResponseStatus(response);
      return response;
    } catch (e) {
      print('API POST ERROR: calling $path: $e');
      throw Exception('Bağlantı hatası: Sunucuya erişilemiyor.');
    }
  }

  // HTTP PUT
  Future<http.Response> put(String path, dynamic body, {bool requireAuth = true}) async {
    final baseUrl = await _storageService.getServerUrl();
    final url = Uri.parse('$baseUrl/api$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    
    try {
      final response = await http.put(
        url,
        headers: headers,
        body: jsonEncode(body),
      );
      _handleResponseStatus(response);
      return response;
    } catch (e) {
      print('API PUT ERROR: calling $path: $e');
      throw Exception('Bağlantı hatası: Sunucuya erişilemiyor.');
    }
  }

  // HTTP DELETE
  Future<http.Response> delete(String path, {bool requireAuth = true}) async {
    final baseUrl = await _storageService.getServerUrl();
    final url = Uri.parse('$baseUrl/api$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    
    try {
      final response = await http.delete(url, headers: headers);
      _handleResponseStatus(response);
      return response;
    } catch (e) {
      print('API DELETE ERROR: calling $path: $e');
      throw Exception('Bağlantı hatası: Sunucuya erişilemiyor.');
    }
  }

  // HTTP PATCH
  Future<http.Response> patch(String path, {bool requireAuth = true}) async {
    final baseUrl = await _storageService.getServerUrl();
    final url = Uri.parse('$baseUrl/api$path');
    final headers = await _getHeaders(requireAuth: requireAuth);
    
    try {
      final response = await http.patch(url, headers: headers);
      _handleResponseStatus(response);
      return response;
    } catch (e) {
      print('API PATCH ERROR: calling $path: $e');
      throw Exception('Bağlantı hatası: Sunucuya erişilemiyor.');
    }
  }

  // Authenticate (Phase 1)
  Future<Map<String, dynamic>> login(String username, String password) async {
    final response = await post(
      '/auth/login',
      {'username': username, 'password': password},
      requireAuth: false,
    );
    
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data; // contains status: 'success' / 'requires_2fa'
    } else {
      final detail = data['detail'] ?? 'Giriş yapılamadı. Kullanıcı adı veya şifre hatalı.';
      throw Exception(detail);
    }
  }

  // Verify 2FA (Phase 1)
  Future<Map<String, dynamic>> verify2FA(String tempToken, String code) async {
    final response = await post(
      '/auth/login/verify-2fa',
      {'temp_token': tempToken, 'code': code},
      requireAuth: false,
    );
    
    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data;
    } else {
      final detail = data['detail'] ?? '2FA Doğrulaması başarısız oldu.';
      throw Exception(detail);
    }
  }
}
