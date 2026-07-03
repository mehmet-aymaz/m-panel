import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import 'app_notification.dart';

class ClientLinkDialog extends StatelessWidget {
  final Map<String, dynamic> client;
  final Map<String, dynamic>? inbound;
  final String serverUrl;

  const ClientLinkDialog({
    super.key,
    required this.client,
    required this.inbound,
    required this.serverUrl,
  });

  // Generates connection link (VLESS/VMess/Trojan) based on backend configurations
  String _generateConnectionLink() {
    if (inbound == null) return '';
    final protocol = (inbound!['protocol'] ?? 'vless').toString().toLowerCase();
    
    // Extract host from serverUrl
    String host = 'panel.mehmetaymaz.com.tr';
    try {
      final uri = Uri.parse(serverUrl);
      host = uri.host;
    } catch (_) {}

    var port = inbound!['port'] ?? 443;
    final uuid = client['uuid'] ?? '';
    final remark = '${inbound!['remark'] ?? 'inbound'}-${client['email'] ?? 'client'}';
    final remarkEncoded = Uri.encodeComponent(remark);

    final params = <String, String>{
      'type': inbound!['network'] ?? 'ws',
      'security': inbound!['security'] ?? 'none',
    };

    if (params['type'] == 'ws') {
      params['security'] = 'tls';
      port = 443;
      params['path'] = inbound!['ws_path'] ?? '/';
      if (inbound!['ws_host'] != null && inbound!['ws_host'].toString().isNotEmpty) {
        params['host'] = inbound!['ws_host'].toString();
      }
    } else if (params['type'] == 'grpc') {
      if (inbound!['grpc_service_name'] != null && inbound!['grpc_service_name'].toString().isNotEmpty) {
        params['serviceName'] = inbound!['grpc_service_name'].toString();
      }
    }

    if (params['security'] == 'tls' || params['security'] == 'reality') {
      if (inbound!['sni'] != null && inbound!['sni'].toString().isNotEmpty) {
        params['sni'] = inbound!['sni'].toString();
      }
      if (params['security'] == 'tls') {
        params['alpn'] = 'http/1.1';
        params['fp'] = 'chrome';
      }
    }

    if (params['security'] == 'reality') {
      // reality parameters fallback
      params['pbk'] = 'FEd7tNvmNJdVrZIG-e8EUOZn3acrkHWYu9AYWlF7WCE';
      params['fp'] = 'chrome';
      params['sid'] = '0123456789abcdef';
      params['flow'] = client['flow'] ?? 'xtls-rprx-vision';
    }

    if (protocol == 'vless') {
      params['encryption'] = 'none';
      final queryStr = params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
      return 'vless://$uuid@$host:$port?$queryStr#$remarkEncoded';
    } else if (protocol == 'trojan') {
      final queryStr = params.entries.map((e) => '${e.key}=${Uri.encodeComponent(e.value)}').join('&');
      return 'trojan://$uuid@$host:$port?$queryStr#$remarkEncoded';
    } else if (protocol == 'vmess') {
      final vmessJson = {
        'v': '2',
        'ps': remark,
        'add': host,
        'port': port,
        'id': uuid,
        'aid': '0',
        'scy': 'auto',
        'net': params['type'] ?? 'ws',
        'type': 'none',
        'host': params['host'] ?? '',
        'path': params['path'] ?? '',
        'tls': params['security'] == 'tls' ? 'tls' : '',
        'sni': params['sni'] ?? '',
        'alpn': params['alpn'] ?? '',
        'fp': params['fp'] ?? ''
      };
      final jsonStr = jsonEncode(vmessJson);
      final base64Str = base64Encode(utf8.encode(jsonStr));
      return 'vmess://$base64Str';
    }

    return '';
  }

  void _copyToClipboard(BuildContext context, String link) {
    Clipboard.setData(ClipboardData(text: link));
    AppNotification.show(context, 'Bağlantı linki kopyalandı!');
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    final link = _generateConnectionLink();
    final protocolName = (inbound?['protocol'] ?? 'VLESS').toString().toUpperCase();

    return Dialog(
      backgroundColor: AppColors.bgCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: AppColors.borderColor, width: 1.5),
      ),
      child: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Header
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '$protocolName Bağlantısı',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  IconButton(
                    icon: Icon(LucideIcons.x, color: AppColors.textSecondary, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // QR Code in White Container for High-Contrast Scanning
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: QrImageView(
                  data: link,
                  version: QrVersions.auto,
                  size: 180.0,
                  gapless: false,
                ),
              ),
              const SizedBox(height: 16),
              
              Text(
                client['email'] ?? '',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Inbound: ${inbound?['remark'] ?? 'Bilinmiyor'}',
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 20),

              // URI Link Text area
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.bgInput,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderColor),
                ),
                constraints: const BoxConstraints(maxHeight: 80),
                width: double.infinity,
                child: SingleChildScrollView(
                  child: Text(
                    link,
                    style: TextStyle(
                      fontSize: 10,
                      fontFamily: 'monospace',
                      color: AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Action buttons
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _copyToClipboard(context, link),
                      icon: const Icon(LucideIcons.copy, size: 16),
                      label: const Text('Linki Kopyala', style: TextStyle(fontSize: 13)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.accentCyan,
                        foregroundColor: const Color(0xFF0A0F1D),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
