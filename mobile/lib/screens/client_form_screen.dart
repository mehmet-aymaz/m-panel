import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/client_provider.dart';
import '../providers/inbound_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import '../widgets/app_notification.dart';
import '../widgets/custom_switch.dart';

class ClientFormScreen extends StatefulWidget {
  final Map<String, dynamic>? client;

  const ClientFormScreen({super.key, this.client});

  @override
  State<ClientFormScreen> createState() => _ClientFormScreenState();
}

class _ClientFormScreenState extends State<ClientFormScreen> {
  final _formKey = GlobalKey<FormState>();

  late TextEditingController _emailController;
  late TextEditingController _uuidController;
  late TextEditingController _totalGbController;
  late TextEditingController _expiryDaysController;
  late TextEditingController _limitIpController;
  late TextEditingController _tgIdController;
  late TextEditingController _commentController;

  int? _selectedInboundId;
  String? _selectedFlow;
  bool _autoUuid = true;
  bool _changeExpiry = false; // Used in edit mode to determine if we should update expiry
  bool _enable = true;

  bool _isSaving = false;
  String? _errorMessage;

  bool get _isEditing => widget.client != null;

  @override
  void initState() {
    super.initState();
    
    // Fetch inbounds in case they are not loaded
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      Provider.of<InboundProvider>(context, listen: false).fetchInbounds(auth.apiService, isSilent: true);
    });

    // Initialize values
    _emailController = TextEditingController(text: widget.client?['email'] ?? '');
    _uuidController = TextEditingController(text: widget.client?['uuid'] ?? '');
    _totalGbController = TextEditingController(text: widget.client?['total_gb']?.toString() ?? '0');
    _expiryDaysController = TextEditingController(text: '0');
    _limitIpController = TextEditingController(text: widget.client?['limit_ip']?.toString() ?? '0');
    _tgIdController = TextEditingController(text: widget.client?['tg_id'] ?? '');
    _commentController = TextEditingController(text: widget.client?['comment'] ?? '');

    _selectedInboundId = widget.client?['inbound_id'];
    _selectedFlow = widget.client?['flow'];
    _enable = widget.client?['enable'] ?? true;
    _autoUuid = !_isEditing; // If editing, keep existing UUID, otherwise default to auto-generate
  }

  @override
  void dispose() {
    _emailController.dispose();
    _uuidController.dispose();
    _totalGbController.dispose();
    _expiryDaysController.dispose();
    _limitIpController.dispose();
    _tgIdController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _handleSave(List<dynamic> inbounds) async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedInboundId == null) {
      setState(() {
        _errorMessage = 'Lütfen bir Inbound düğümü seçin.';
      });
      return;
    }

    setState(() {
      _isSaving = true;
      _errorMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final clientProvider = Provider.of<ClientProvider>(context, listen: false);

    // Build payload
    final Map<String, dynamic> payload = {
      'inbound_id': _selectedInboundId,
      'email': _emailController.text.trim(),
      'total_gb': double.parse(_totalGbController.text.trim()),
      'limit_ip': int.parse(_limitIpController.text.trim()),
      'tg_id': _tgIdController.text.trim().isEmpty ? null : _tgIdController.text.trim(),
      'comment': _commentController.text.trim().isEmpty ? null : _commentController.text.trim(),
      'enable': _enable,
    };

    // UUID
    if (!_autoUuid && _uuidController.text.trim().isNotEmpty) {
      payload['uuid'] = _uuidController.text.trim();
    } else if (_isEditing) {
      // Keep same UUID if editing and not manually changed
      payload['uuid'] = widget.client!['uuid'];
    } else {
      payload['uuid'] = null; // Backend will auto generate
    }

    // Expiry Days
    if (!_isEditing) {
      payload['expiry_days'] = int.parse(_expiryDaysController.text.trim());
    } else if (_changeExpiry) {
      payload['expiry_days'] = int.parse(_expiryDaysController.text.trim());
    }

    // Flow
    final selectedInbound = inbounds.firstWhere((inb) => inb['id'] == _selectedInboundId, orElse: () => null);
    final bool isVlessTcpTls = selectedInbound != null &&
        selectedInbound['protocol']?.toString().toLowerCase() == 'vless' &&
        selectedInbound['network']?.toString().toLowerCase() == 'tcp' &&
        (selectedInbound['security']?.toString().toLowerCase() == 'tls' ||
         selectedInbound['security']?.toString().toLowerCase() == 'reality');
    
    if (isVlessTcpTls) {
      payload['flow'] = _selectedFlow;
    } else {
      payload['flow'] = null;
    }

    try {
      if (_isEditing) {
        await clientProvider.updateClient(auth.apiService, widget.client!['id'], payload);
      } else {
        await clientProvider.createClient(auth.apiService, payload);
      }

      if (mounted) {
        AppNotification.show(context, _isEditing ? 'Kullanıcı güncellendi.' : 'Kullanıcı eklendi.');
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
    final inboundProvider = Provider.of<InboundProvider>(context);

    // Flow selector visibility helper
    final selectedInbound = inboundProvider.inbounds.firstWhere(
      (inb) => inb['id'] == _selectedInboundId,
      orElse: () => null,
    );
    final bool isVlessTcpTls = selectedInbound != null &&
        selectedInbound['protocol']?.toString().toLowerCase() == 'vless' &&
        selectedInbound['network']?.toString().toLowerCase() == 'tcp' &&
        (selectedInbound['security']?.toString().toLowerCase() == 'tls' ||
         selectedInbound['security']?.toString().toLowerCase() == 'reality');

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.bgSecondary,
        elevation: 0,
        title: Text(_isEditing ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı Ekle'),
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
                // Error message banner
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

                // 1. Select Inbound
                Text('Düğüm (Inbound)', style: _labelStyle),
                const SizedBox(height: 6),
                DropdownButtonFormField<int?>(
                  value: _selectedInboundId,
                  dropdownColor: AppColors.bgCard,
                  iconEnabledColor: AppColors.accentCyan,
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                  decoration: const InputDecoration(
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                    prefixIcon: Icon(LucideIcons.server, size: 18),
                  ),
                  items: inboundProvider.inbounds.map<DropdownMenuItem<int?>>((inb) {
                    final remark = inb['remark'] ?? 'İsimsiz Inbound';
                    final protocol = inb['protocol']?.toString().toUpperCase() ?? 'VLESS';
                    return DropdownMenuItem<int?>(
                      value: inb['id'],
                      child: Text('$remark ($protocol)', style: TextStyle(color: AppColors.textPrimary)),
                    );
                  }).toList(),
                  onChanged: _isEditing ? null : (val) {
                    setState(() {
                      _selectedInboundId = val;
                      _selectedFlow = null; // Reset flow when inbound changes
                    });
                  },
                  validator: (val) {
                    if (val == null) return 'Bir inbound seçmek zorunludur.';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 2. Email / Username
                Text('E-posta / Kullanıcı Adı', style: _labelStyle),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _emailController,
                  decoration: const InputDecoration(
                    hintText: 'Örn: mehmet@client.com',
                    prefixIcon: Icon(LucideIcons.mail, size: 18),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'E-posta boş bırakılamaz.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 3. UUID config
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Kullanıcı Şifresi / UUID', style: _labelStyle),
                    if (!_isEditing)
                      Row(
                        children: [
                          Text('Otomatik Üret', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                          Checkbox(
                            value: _autoUuid,
                            activeColor: AppColors.accentCyan,
                            onChanged: (val) {
                              setState(() {
                                _autoUuid = val ?? true;
                              });
                            },
                          ),
                        ],
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _uuidController,
                  enabled: !_autoUuid,
                  decoration: InputDecoration(
                    hintText: _autoUuid ? 'Sistem tarafından otomatik üretilecek' : 'Girin veya 36 haneli UUID girin',
                    prefixIcon: const Icon(LucideIcons.key, size: 18),
                  ),
                  validator: (value) {
                    if (!_autoUuid && (value == null || value.trim().isEmpty)) {
                      return 'UUID alanını doldurun veya otomatik üretmeyi seçin.';
                    }
                    if (!_autoUuid && value != null && value.isNotEmpty) {
                      final reg = RegExp(r'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$');
                      if (!reg.hasMatch(value.trim())) {
                        return 'Geçersiz UUID formatı. Format: 8-4-4-4-12';
                      }
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 4. Traffic Limit (total_gb)
                Text('Trafik Kotası (GB)', style: _labelStyle),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _totalGbController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                    hintText: '0 yazarsanız limitsiz olur',
                    prefixIcon: Icon(LucideIcons.database, size: 18),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) return 'Kota girmek zorunludur.';
                    if (double.tryParse(value.trim()) == null) return 'Geçerli bir sayı girin.';
                    if (double.parse(value.trim()) < 0) return 'Kota sıfırdan küçük olamaz.';
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // 5. Expiry Days
                if (_isEditing) ...[
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Kullanıcı Süresini Güncelle', style: _labelStyle),
                      CustomSwitch(
                        value: _changeExpiry,
                        onChanged: (val) {
                          setState(() {
                            _changeExpiry = val;
                          });
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                ],

                if (!_isEditing || _changeExpiry) ...[
                  Text('Süre Sınırı (Gün)', style: _labelStyle),
                  const SizedBox(height: 6),
                  TextFormField(
                    controller: _expiryDaysController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      hintText: 'Bugünden itibaren kaç gün aktif kalsın? (0 = limitsiz)',
                      prefixIcon: Icon(LucideIcons.calendar, size: 18),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) return 'Süre girmek zorunludur.';
                      if (int.tryParse(value.trim()) == null) return 'Geçerli bir tamsayı girin.';
                      if (int.parse(value.trim()) < 0) return 'Süre sıfırdan küçük olamaz.';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // 6. Limit IP & Telegram ID
                Row(
                  children: [
                    // Limit IP
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('IP Limiti', style: _labelStyle),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _limitIpController,
                            keyboardType: TextInputType.number,
                            decoration: const InputDecoration(
                              hintText: '0 = limitsiz',
                              prefixIcon: Icon(LucideIcons.monitor, size: 18),
                              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                            ),
                            validator: (value) {
                              if (value == null || value.trim().isEmpty) return 'Zorunlu.';
                              if (int.tryParse(value.trim()) == null) return 'Tamsayı olmalı.';
                              if (int.parse(value.trim()) < 0) return 'Negatif olamaz.';
                              return null;
                            },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // Telegram ID
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Telegram ID', style: _labelStyle),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _tgIdController,
                            decoration: const InputDecoration(
                              hintText: 'Örn: 987654321',
                              prefixIcon: Icon(LucideIcons.send, size: 18),
                              contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // 7. Flow selection (if applicable)
                if (isVlessTcpTls) ...[
                  Text('XTLS Akış Modu (Flow)', style: _labelStyle),
                  const SizedBox(height: 6),
                  DropdownButtonFormField<String?>(
                    value: _selectedFlow,
                    dropdownColor: AppColors.bgCard,
                    iconEnabledColor: AppColors.accentCyan,
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                    decoration: const InputDecoration(
                      contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      prefixIcon: Icon(LucideIcons.activity, size: 18),
                    ),
                    items: [
                      DropdownMenuItem<String?>(value: null, child: Text('Seçilmedi (Flow Yok)', style: TextStyle(color: AppColors.textPrimary))),
                      DropdownMenuItem<String?>(value: 'xtls-rprx-vision', child: Text('xtls-rprx-vision', style: TextStyle(color: AppColors.textPrimary))),
                    ],
                    onChanged: (val) {
                      setState(() {
                        _selectedFlow = val;
                      });
                    },
                  ),
                  const SizedBox(height: 16),
                ],

                // 8. Comment
                Text('Açıklama / Yorum', style: _labelStyle),
                const SizedBox(height: 6),
                TextFormField(
                  controller: _commentController,
                  decoration: const InputDecoration(
                    hintText: 'Müşteri hakkında notlar...',
                    prefixIcon: Icon(LucideIcons.messageSquare, size: 18),
                  ),
                ),
                const SizedBox(height: 16),

                // 9. Status Toggle Switch
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.01),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.borderColor),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Kullanıcı Aktif', style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                            const SizedBox(height: 2),
                            Text('Kullanıcının sunucu bağlantı yetkisini kontrol eder.', style: TextStyle(fontSize: 10, color: AppColors.textMuted)),
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
                ),
                const SizedBox(height: 32),

                // 10. Submit button
                ElevatedButton(
                  onPressed: _isSaving ? null : () => _handleSave(inboundProvider.inbounds),
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
                      : Text(_isEditing ? 'Bilgileri Güncelle' : 'Kullanıcı Oluştur'),
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
