import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/inbound_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import '../widgets/app_notification.dart';
import '../widgets/custom_switch.dart';

class InboundFormScreen extends StatefulWidget {
  final Map<String, dynamic>? inbound;

  const InboundFormScreen({super.key, this.inbound});

  @override
  State<InboundFormScreen> createState() => _InboundFormScreenState();
}

class _InboundFormScreenState extends State<InboundFormScreen> {
  final _formKey = GlobalKey<FormState>();
  
  late TextEditingController _remarkController;
  late TextEditingController _portController;
  late TextEditingController _sniController;
  late TextEditingController _wsPathController;
  late TextEditingController _wsHostController;
  late TextEditingController _grpcServiceNameController;

  late String _protocol;
  late String _network;
  late String _security;
  late bool _sniffingEnabled;
  late bool _enable;

  bool _isSaving = false;
  String? _errorMessage;

  bool get _isEditing => widget.inbound != null;

  @override
  void initState() {
    super.initState();
    
    // Initialize fields
    _remarkController = TextEditingController(text: widget.inbound?['remark'] ?? '');
    _portController = TextEditingController(text: widget.inbound?['port']?.toString() ?? '');
    _sniController = TextEditingController(text: widget.inbound?['sni'] ?? '');
    _wsPathController = TextEditingController(text: widget.inbound?['ws_path'] ?? '/');
    _wsHostController = TextEditingController(text: widget.inbound?['ws_host'] ?? '');
    _grpcServiceNameController = TextEditingController(text: widget.inbound?['grpc_service_name'] ?? '');

    _protocol = widget.inbound?['protocol'] ?? 'vless';
    _network = widget.inbound?['network'] ?? 'ws';
    _security = widget.inbound?['security'] ?? 'tls';
    _sniffingEnabled = widget.inbound?['sniffing_enabled'] ?? true;
    _enable = widget.inbound?['enable'] ?? true;
  }

  @override
  void dispose() {
    _remarkController.dispose();
    _portController.dispose();
    _sniController.dispose();
    _wsPathController.dispose();
    _wsHostController.dispose();
    _grpcServiceNameController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final inboundProvider = Provider.of<InboundProvider>(context, listen: false);

    // Build payload
    final payload = {
      'remark': _remarkController.text.trim(),
      'protocol': _protocol.toLowerCase(),
      'port': int.parse(_portController.text.trim()),
      'network': _network.toLowerCase(),
      'security': _security.toLowerCase(),
      'sni': _sniController.text.trim().isEmpty ? null : _sniController.text.trim(),
      'ws_path': _network == 'ws' ? (_wsPathController.text.trim().isEmpty ? '/' : _wsPathController.text.trim()) : null,
      'ws_host': _network == 'ws' && _wsHostController.text.trim().isNotEmpty ? _wsHostController.text.trim() : null,
      'grpc_service_name': _network == 'grpc' && _grpcServiceNameController.text.trim().isNotEmpty ? _grpcServiceNameController.text.trim() : null,
      'sniffing_enabled': _sniffingEnabled,
      'enable': _enable,
    };

    try {
      if (_isEditing) {
        await inboundProvider.updateInbound(auth.apiService, widget.inbound!['id'], payload);
      } else {
        await inboundProvider.createInbound(auth.apiService, payload);
      }

      if (mounted) {
        AppNotification.show(context, _isEditing ? 'Inbound başarıyla güncellendi.' : 'Inbound başarıyla oluşturuldu.');
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _isSaving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.bgSecondary,
        elevation: 0,
        title: Text(_isEditing ? 'Inbound Düzenle' : 'Yeni Inbound Ekle'),
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: GestureDetector(
        onTap: () => FocusScope.of(context).unfocus(),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Error message
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.danger.withOpacity(0.1),
                      border: Border.all(color: AppColors.danger.withOpacity(0.2)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        Icon(LucideIcons.alertTriangle, color: AppColors.danger, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: TextStyle(color: AppColors.danger, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                // 1. Remark
                Text('Açıklama / İsim (Remark)', style: _labelStyle),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _remarkController,
                  decoration: const InputDecoration(
                    hintText: 'Örn: Almanya-VLESS-1',
                    prefixIcon: Icon(LucideIcons.tag, size: 18),
                  ),
                ),
                const SizedBox(height: 16),

                // 2. Protocol & Port row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Protocol Dropdown
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Protokol', style: _labelStyle),
                          const SizedBox(height: 6),
                          DropdownButtonFormField<String>(
                            value: _protocol,
                            dropdownColor: AppColors.bgCard,
                            iconEnabledColor: AppColors.accentCyan,
                            style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                            decoration: const InputDecoration(
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            items: [
                              DropdownMenuItem(value: 'vless', child: Text('VLESS', style: TextStyle(color: AppColors.textPrimary))),
                              DropdownMenuItem(value: 'vmess', child: Text('VMess', style: TextStyle(color: AppColors.textPrimary))),
                              DropdownMenuItem(value: 'trojan', child: Text('Trojan', style: TextStyle(color: AppColors.textPrimary))),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _protocol = val;
                                });
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Port Input
                    Expanded(
                      flex: 5,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Port', style: _labelStyle),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _portController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              hintText: 'Örn: 2096',
                              prefixIcon: Icon(LucideIcons.hash, size: 18),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) {
                                return 'Port zorunludur.';
                              }
                              final portNum = int.tryParse(value.trim());
                              if (portNum == null) {
                                return 'Geçerli bir sayı girin.';
                              }
                              if (portNum < 1 || portNum > 65535) {
                                return '1-65535 arası olmalı.';
                              }
                              // Avoid system reserved ports
                              final reserved = [22, 80, 443, 8000, 8443];
                              if (reserved.contains(portNum)) {
                                return 'Sistem portu rezerve.';
                              }
                              return null;
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 3. Network & Security row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Network Dropdown
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Network', style: _labelStyle),
                          const SizedBox(height: 6),
                          DropdownButtonFormField<String>(
                            value: _network,
                            dropdownColor: AppColors.bgCard,
                            iconEnabledColor: AppColors.accentCyan,
                            style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                            decoration: const InputDecoration(
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            items: [
                              DropdownMenuItem(value: 'ws', child: Text('WS', style: TextStyle(color: AppColors.textPrimary))),
                              DropdownMenuItem(value: 'grpc', child: Text('gRPC', style: TextStyle(color: AppColors.textPrimary))),
                              DropdownMenuItem(value: 'tcp', child: Text('TCP', style: TextStyle(color: AppColors.textPrimary))),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _network = val;
                                });
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Security Dropdown
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Güvenlik', style: _labelStyle),
                          const SizedBox(height: 6),
                          DropdownButtonFormField<String>(
                            value: _security,
                            dropdownColor: AppColors.bgCard,
                            iconEnabledColor: AppColors.accentCyan,
                            style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                            decoration: const InputDecoration(
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            ),
                            items: [
                              DropdownMenuItem(value: 'tls', child: Text('TLS', style: TextStyle(color: AppColors.textPrimary))),
                              DropdownMenuItem(value: 'none', child: Text('None', style: TextStyle(color: AppColors.textPrimary))),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _security = val;
                                });
                              }
                            },
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 4. SNI (Tls Server Name Indication)
                if (_security == 'tls') ...[
                  Text('SNI', style: _labelStyle),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _sniController,
                    decoration: const InputDecoration(
                      hintText: 'Örn: panel.mehmetaymaz.com.tr',
                      prefixIcon: Icon(LucideIcons.globe, size: 18),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // 5. Conditional Network Form Fields
                if (_network == 'ws') ...[
                  // WS Path
                  Text('WebSocket Path', style: _labelStyle),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _wsPathController,
                    decoration: const InputDecoration(
                      hintText: 'Örn: /vless',
                      prefixIcon: Icon(LucideIcons.compass, size: 18),
                    ),
                  ),
                  const SizedBox(height: 16),
                  // WS Host
                  Text('WebSocket Host', style: _labelStyle),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _wsHostController,
                    decoration: const InputDecoration(
                      hintText: 'Örn: global.host.com',
                      prefixIcon: Icon(LucideIcons.globe, size: 18),
                    ),
                  ),
                  const SizedBox(height: 16),
                ] else if (_network == 'grpc') ...[
                  // gRPC Service Name
                  Text('gRPC Service Name', style: _labelStyle),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _grpcServiceNameController,
                    decoration: const InputDecoration(
                      hintText: 'Örn: GrpcServiceName',
                      prefixIcon: Icon(LucideIcons.box, size: 18),
                    ),
                    validator: (value) {
                      if (_network == 'grpc' && (value == null || value.trim().isEmpty)) {
                        return 'gRPC Service Name zorunludur.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // 6. Sniffing toggle & Enable toggle
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.01),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.borderColor),
                  ),
                  child: Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Trafik Sniffing (Dinleme)', style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                                const SizedBox(height: 2),
                                Text('Trafik isteklerini analiz edip yönlendirir.', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                              ],
                            ),
                          ),
                          CustomSwitch(
                            value: _sniffingEnabled,
                            onChanged: (val) {
                              setState(() {
                                _sniffingEnabled = val;
                              });
                            },
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Divider(color: AppColors.borderColor, height: 1),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text('Aktif / Çalışır Durumda', style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                                const SizedBox(height: 2),
                                Text('Inbound bağlantısını aktif eder.', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
                              ],
                            ),
                          ),
                          CustomSwitch(
                            value: _enable,
                            onChanged: (val) {
                              setState(() {
                                _enable = val;
                              });
                            },
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),

                // 7. Submit button
                ElevatedButton(
                  onPressed: _isSaving ? null : _handleSave,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentCyan,
                    shadowColor: AppColors.accentCyan.withOpacity(0.3),
                    elevation: 8,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _isSaving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0A0F1D)),
                          ),
                        )
                      : Text(_isEditing ? 'Değişiklikleri Kaydet' : 'Inbound Ekle'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

final TextStyle _labelStyle = TextStyle(
  fontSize: 11,
  fontWeight: FontWeight.w600,
  color: AppColors.textSecondary,
);
