import 'dart:convert';
import 'package:flutter/material.dart';
import '../services/api_service.dart';

class SystemProvider extends ChangeNotifier {
  Map<String, dynamic>? _systemStatus;
  Map<String, dynamic>? _dashboardSummary;
  List<dynamic> _clients = [];

  bool _isLoading = true;
  String? _errorMessage;
  bool _isActionLoading = false;

  // Speed calculation state
  double _uploadSpeed = 0.0;
  double _downloadSpeed = 0.0;
  int? _lastBytesSent;
  int? _lastBytesRecv;
  DateTime? _lastSpeedCheckTime;

  // Client counts
  int _totalClients = 0;
  int _activeClients = 0;
  int _expiredClients = 0;

  Map<String, dynamic>? get systemStatus => _systemStatus;
  Map<String, dynamic>? get dashboardSummary => _dashboardSummary;
  List<dynamic> get clients => _clients;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isActionLoading => _isActionLoading;

  double get uploadSpeed => _uploadSpeed;
  double get downloadSpeed => _downloadSpeed;

  int get totalClients => _totalClients;
  int get activeClients => _activeClients;
  int get expiredClients => _expiredClients;

  // Fetch all dashboard data
  Future<void> fetchData(ApiService apiService, {bool isSilent = false}) async {
    if (!isSilent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final results = await Future.wait([
        apiService.get('/system/status'),
        apiService.get('/dashboard/summary'),
        apiService.get('/clients/'),
      ]);

      final statusRes = results[0];
      final summaryRes = results[1];
      final clientsRes = results[2];

      if (statusRes.statusCode == 200 && summaryRes.statusCode == 200 && clientsRes.statusCode == 200) {
        _systemStatus = jsonDecode(statusRes.body);
        _dashboardSummary = jsonDecode(summaryRes.body);
        _clients = jsonDecode(clientsRes.body);
        
        _calculateSpeed(_systemStatus!);
        _calculateClientStats(_clients);
        _errorMessage = null;
      } else {
        _errorMessage = 'Veriler alınamadı. Sunucu hata kodu bildirdi.';
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  // Speed calculation helper
  void _calculateSpeed(Map<String, dynamic> status) {
    if (status['net_io'] == null) return;
    final netIo = status['net_io'];
    final int currentSent = netIo['bytes_sent'] ?? 0;
    final int currentRecv = netIo['bytes_recv'] ?? 0;
    final DateTime now = DateTime.now();

    if (_lastBytesSent != null && _lastBytesRecv != null && _lastSpeedCheckTime != null) {
      final double secondsDiff = now.difference(_lastSpeedCheckTime!).inMilliseconds / 1000.0;
      if (secondsDiff > 0) {
        final double up = (currentSent - _lastBytesSent!) / secondsDiff;
        final double down = (currentRecv - _lastBytesRecv!) / secondsDiff;
        _uploadSpeed = up >= 0 ? up : 0.0;
        _downloadSpeed = down >= 0 ? down : 0.0;
      }
    }

    _lastBytesSent = currentSent;
    _lastBytesRecv = currentRecv;
    _lastSpeedCheckTime = now;
  }

  // Client status counters
  void _calculateClientStats(List<dynamic> clientsList) {
    _totalClients = clientsList.length;
    int active = 0;
    int expired = 0;
    final int nowMs = DateTime.now().millisecondsSinceEpoch;

    for (var client in clientsList) {
      final bool enable = client['enable'] ?? false;
      final int expiryTime = client['expiry_time'] ?? 0;
      final bool isExpired = expiryTime > 0 && expiryTime <= nowMs;

      if (enable && !isExpired) {
        active++;
      } else {
        expired++;
      }
    }
    _activeClients = active;
    _expiredClients = expired;
  }

  // Xray service action controls (start, stop, restart)
  Future<void> controlXray(ApiService apiService, String action) async {
    _isActionLoading = true;
    notifyListeners();

    try {
      final response = await apiService.post('/system/xray/control?action=$action', {});
      if (response.statusCode == 200) {
        // Refresh immediately to show updated status
        await fetchData(apiService, isSilent: true);
      } else {
        final data = jsonDecode(response.body);
        throw Exception(data['detail'] ?? 'Xray işlemi başarısız.');
      }
    } catch (e) {
      _errorMessage = e.toString().replaceAll('Exception: ', '');
      rethrow;
    } finally {
      _isActionLoading = false;
      notifyListeners();
    }
  }

  void resetSpeedState() {
    _lastBytesSent = null;
    _lastBytesRecv = null;
    _lastSpeedCheckTime = null;
    _uploadSpeed = 0.0;
    _downloadSpeed = 0.0;
  }
}
