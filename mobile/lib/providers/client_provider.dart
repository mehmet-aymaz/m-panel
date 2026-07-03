import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class ClientProvider extends ChangeNotifier {
  List<dynamic> _clients = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<dynamic> get clients => _clients;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // 1. Fetch Clients
  Future<void> fetchClients(ApiService apiService, {bool isSilent = false}) async {
    if (!isSilent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await apiService.get('/clients/');
      if (response.statusCode == 200) {
        _clients = jsonDecode(response.body);
        _errorMessage = null;
      } else {
        _errorMessage = 'Kullanıcı listesi yüklenemedi. Sunucu hata kodu bildirdi.';
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 2. Create Client
  Future<void> createClient(ApiService apiService, Map<String, dynamic> data) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.post('/clients/', data);
      if (response.statusCode == 200) {
        await fetchClients(apiService, isSilent: true);
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Kullanıcı eklenirken bir hata oluştu.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 3. Update Client
  Future<void> updateClient(ApiService apiService, int id, Map<String, dynamic> data) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.put('/clients/$id', data);
      if (response.statusCode == 200) {
        await fetchClients(apiService, isSilent: true);
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Kullanıcı güncellenirken bir hata oluştu.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 4. Toggle Client Active State
  Future<void> toggleClient(ApiService apiService, int id) async {
    try {
      final response = await apiService.patch('/clients/$id/toggle');
      if (response.statusCode == 200) {
        final updatedClient = jsonDecode(response.body);
        final index = _clients.indexWhere((element) => element['id'] == id);
        if (index != -1) {
          _clients[index] = updatedClient;
          notifyListeners();
        }
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Kullanıcı durumu güncellenemedi.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      rethrow;
    }
  }

  // 5. Reset Client Traffic
  Future<void> resetClientTraffic(ApiService apiService, int id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.post('/clients/$id/reset-traffic', {});
      if (response.statusCode == 200) {
        final updatedClient = jsonDecode(response.body);
        final index = _clients.indexWhere((element) => element['id'] == id);
        if (index != -1) {
          _clients[index] = updatedClient;
        }
        _errorMessage = null;
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Kullanıcı trafiği sıfırlanamadı.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 6. Delete Client
  Future<void> deleteClient(ApiService apiService, int id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.delete('/clients/$id');
      if (response.statusCode == 200) {
        _clients.removeWhere((element) => element['id'] == id);
        _errorMessage = null;
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Kullanıcı silinemedi.');
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
