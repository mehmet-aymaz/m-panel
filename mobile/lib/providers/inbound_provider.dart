import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class InboundProvider extends ChangeNotifier {
  List<dynamic> _inbounds = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<dynamic> get inbounds => _inbounds;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // 1. Fetch Inbounds
  Future<void> fetchInbounds(ApiService apiService, {bool isSilent = false}) async {
    if (!isSilent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final response = await apiService.get('/inbounds/');
      if (response.statusCode == 200) {
        _inbounds = jsonDecode(response.body);
        _errorMessage = null;
      } else {
        _errorMessage = 'Inbound listesi yüklenemedi. Sunucu hata kodu bildirdi.';
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 2. Create Inbound
  Future<void> createInbound(ApiService apiService, Map<String, dynamic> data) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.post('/inbounds/', data);
      if (response.statusCode == 200) {
        // Refresh list
        await fetchInbounds(apiService, isSilent: true);
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Inbound eklenirken bir hata oluştu.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 3. Update Inbound
  Future<void> updateInbound(ApiService apiService, int id, Map<String, dynamic> data) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.put('/inbounds/$id', data);
      if (response.statusCode == 200) {
        // Refresh list
        await fetchInbounds(apiService, isSilent: true);
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Inbound güncellenirken bir hata oluştu.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // 4. Toggle Inbound Status
  Future<void> toggleInbound(ApiService apiService, int id) async {
    // We update local state optimistically or silently
    try {
      final response = await apiService.patch('/inbounds/$id/toggle');
      if (response.statusCode == 200) {
        final updatedInbound = jsonDecode(response.body);
        final index = _inbounds.indexWhere((element) => element['id'] == id);
        if (index != -1) {
          _inbounds[index] = updatedInbound;
          notifyListeners();
        }
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'İşlem başarısız.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      notifyListeners();
      rethrow;
    }
  }

  // 5. Delete Inbound
  Future<void> deleteInbound(ApiService apiService, int id) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final response = await apiService.delete('/inbounds/$id');
      if (response.statusCode == 200) {
        _inbounds.removeWhere((element) => element['id'] == id);
        _errorMessage = null;
      } else {
        final Map<String, dynamic> responseData = jsonDecode(response.body);
        throw Exception(responseData['detail'] ?? 'Inbound silinemedi.');
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
