import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

class UpdateService {
  static const String githubOwner = 'mehmet-aymaz';
  static const String githubRepo = 'm-panel-mobile';
  
  static const MethodChannel _channel = MethodChannel('com.mehmetaymaz.mpanel.mpanel_mobile/update');

  // Check if there is an update available on GitHub
  Future<Map<String, dynamic>> checkUpdate(String currentVersion) async {
    final url = Uri.parse('https://api.github.com/repos/$githubOwner/$githubRepo/releases/latest');
    
    try {
      final response = await http.get(url, headers: {'Accept': 'application/vnd.github.v3+json'});
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final String latestVersion = data['tag_name'] ?? 'v1.0.0';
        final String changelog = data['body'] ?? '';
        
        // Find APK asset
        final assets = data['assets'] as List? ?? [];
        String? apkUrl;
        for (var asset in assets) {
          final String name = asset['name'] ?? '';
          if (name.endsWith('.apk')) {
            apkUrl = asset['browser_download_url'];
            break;
          }
        }
        
        // Compare version (e.g. v1.0.0 and v1.0.1)
        bool hasUpdate = _isVersionNewer(currentVersion, latestVersion);
        
        return {
          'has_update': hasUpdate,
          'latest_version': latestVersion,
          'changelog': changelog,
          'apk_url': apkUrl,
        };
      } else {
        throw Exception('GitHub API hata verdi: ${response.statusCode}');
      }
    } catch (e) {
      print('Update check error: $e');
      rethrow;
    }
  }

  // Version comparator helper
  bool _isVersionNewer(String current, String latest) {
    // Normalize by removing leading 'v'
    String cleanCurrent = current.replaceAll(RegExp(r'[^0-9.]'), '');
    String cleanLatest = latest.replaceAll(RegExp(r'[^0-9.]'), '');
    
    List<int> currentParts = cleanCurrent.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    List<int> latestParts = cleanLatest.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    
    int maxLength = currentParts.length > latestParts.length ? currentParts.length : latestParts.length;
    for (int i = 0; i < maxLength; i++) {
      int curr = i < currentParts.length ? currentParts[i] : 0;
      int lat = i < latestParts.length ? latestParts[i] : 0;
      if (lat > curr) return true;
      if (curr > lat) return false;
    }
    return false;
  }

  // Download the APK file with progress reporting
  Future<File> downloadApk(String url, Function(double progress) onProgress) async {
    final client = http.Client();
    final request = http.Request('GET', Uri.parse(url));
    
    try {
      final response = await client.send(request);
      final total = response.contentLength ?? 0;
      int received = 0;
      
      final tempDir = await getTemporaryDirectory();
      final apkFile = File('${tempDir.path}/update.apk');
      
      // If old file exists, delete it
      if (await apkFile.exists()) {
        await apkFile.delete();
      }
      
      final List<int> bytes = [];
      final stream = response.stream;
      
      await for (var chunk in stream) {
        bytes.addAll(chunk);
        received += chunk.length;
        if (total > 0) {
          onProgress(received / total);
        } else {
          onProgress(-1); // Unknown progress
        }
      }
      
      await apkFile.writeAsBytes(bytes);
      return apkFile;
    } catch (e) {
      print('APK download error: $e');
      rethrow;
    } finally {
      client.close();
    }
  }

  // Trigger installation via MethodChannel
  Future<void> installApk(String filePath) async {
    try {
      await _channel.invokeMethod('installApk', {'filePath': filePath});
    } on PlatformException catch (e) {
      throw Exception('APK kurulum hatası: ${e.message}');
    }
  }
}
