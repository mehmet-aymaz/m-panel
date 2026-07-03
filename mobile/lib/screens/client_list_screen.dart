import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/client_provider.dart';
import '../providers/inbound_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import 'client_form_screen.dart';
import '../widgets/client_link_dialog.dart';
import '../widgets/app_notification.dart';
import '../widgets/custom_switch.dart';
import '../widgets/blinking_dot.dart';

class ClientListScreen extends StatefulWidget {
  const ClientListScreen({super.key});

  @override
  State<ClientListScreen> createState() => _ClientListScreenState();
}

class _ClientListScreenState extends State<ClientListScreen> with AutomaticKeepAliveClientMixin {
  final TextEditingController _searchController = TextEditingController();
  int? _selectedInboundId;
  String _searchQuery = '';
  String _sortBy = 'name_asc';

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchData();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final clientProvider = Provider.of<ClientProvider>(context, listen: false);
    final inboundProvider = Provider.of<InboundProvider>(context, listen: false);

    await Future.wait([
      clientProvider.fetchClients(auth.apiService),
      inboundProvider.fetchInbounds(auth.apiService, isSilent: true),
    ]);
  }

  // Format bytes helper
  String _formatBytes(num bytes, {int decimals = 2}) {
    if (bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = (math.log(bytes) / math.log(1024)).floor();
    var value = bytes / math.pow(1024, i);
    return '${value.toStringAsFixed(value < 10 && i > 0 ? decimals : 1)} ${suffixes[i]}';
  }

  Future<void> _toggleClient(int id, bool currentValue) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final clientProvider = Provider.of<ClientProvider>(context, listen: false);

    try {
      await clientProvider.toggleClient(auth.apiService, id);
      if (mounted) {
        AppNotification.show(context, 'Kullanıcı durumu güncellendi.');
      }
    } catch (e) {
      if (mounted) {
        AppNotification.show(context, 'Hata: ${e.toString()}', isError: true);
      }
    }
  }

  Future<void> _resetTraffic(int id, String email) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final clientProvider = Provider.of<ClientProvider>(context, listen: false);

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: AppColors.borderColor),
          ),
          title: const Text('Trafiği Sıfırla'),
          content: Text('"$email" kullanıcısının yükleme ve indirme trafik sayaçları sıfırlanacaktır. Onaylıyor musunuz?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text('Vazgeç', style: TextStyle(color: AppColors.textSecondary)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('Sıfırla', style: TextStyle(color: AppColors.accentCyan)),
            ),
          ],
        );
      },
    );

    if (confirm == true) {
      try {
        await clientProvider.resetClientTraffic(auth.apiService, id);
        if (mounted) {
          AppNotification.show(context, 'Trafik sayaçları sıfırlandı.');
        }
      } catch (e) {
        if (mounted) {
          AppNotification.show(context, 'Hata: ${e.toString()}', isError: true);
        }
      }
    }
  }

  Future<void> _deleteClient(int id, String email) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final clientProvider = Provider.of<ClientProvider>(context, listen: false);

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: AppColors.borderColor),
          ),
          title: const Text('Kullanıcıyı Sil'),
          content: Text('"$email" kullanıcısı kalıcı olarak silinecektir. Bu işlem geri alınamaz. Emin misiniz?'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text('Vazgeç', style: TextStyle(color: AppColors.textSecondary)),
            ),
            TextButton(
              onPressed: () => Navigator.pop(context, true),
              child: Text('Sil', style: TextStyle(color: AppColors.danger, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );

    if (confirm == true) {
      try {
        await clientProvider.deleteClient(auth.apiService, id);
        if (mounted) {
          AppNotification.show(context, 'Kullanıcı başarıyla silindi.');
        }
      } catch (e) {
        if (mounted) {
          AppNotification.show(context, 'Hata: ${e.toString()}', isError: true);
        }
      }
    }
  }

  void _showLinkDialog(Map<String, dynamic> client, List<dynamic> inbounds, String serverUrl) {
    final inbound = inbounds.firstWhere(
      (element) => element['id'] == client['inbound_id'],
      orElse: () => null,
    );

    showDialog(
      context: context,
      builder: (context) {
        return ClientLinkDialog(
          client: client,
          inbound: inbound,
          serverUrl: serverUrl,
        );
      },
    );
  }

  // Format expiry time to friendly text
  Widget _buildExpiryBadge(int expiryTimeMs) {
    if (expiryTimeMs == 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.textMuted.withOpacity(0.1),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Text(
          'Süresiz',
          style: TextStyle(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.w600),
        ),
      );
    }

    final remainingMs = expiryTimeMs - DateTime.now().millisecondsSinceEpoch;
    if (remainingMs <= 0) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: AppColors.danger.withOpacity(0.15),
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: AppColors.danger.withOpacity(0.3)),
        ),
        child: Text(
          'Süresi Doldu',
          style: TextStyle(fontSize: 10, color: AppColors.danger, fontWeight: FontWeight.bold),
        ),
      );
    }

    final days = (remainingMs / (24 * 3600 * 1000)).ceil();
    final Color badgeColor = days <= 5 ? AppColors.warning : AppColors.success;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: badgeColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'Kalan: $days gün',
        style: TextStyle(fontSize: 10, color: badgeColor, fontWeight: FontWeight.w600),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    Provider.of<ThemeProvider>(context);
    final clientProvider = Provider.of<ClientProvider>(context);
    final inboundProvider = Provider.of<InboundProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    // Apply Filter & Search query locally
    final filteredClients = clientProvider.clients.where((client) {
      final email = (client['email'] ?? '').toString().toLowerCase();
      final uuid = (client['uuid'] ?? '').toString().toLowerCase();
      final comment = (client['comment'] ?? '').toString().toLowerCase();
      
      final matchesQuery = email.contains(_searchQuery) || 
                           uuid.contains(_searchQuery) ||
                           comment.contains(_searchQuery);
      
      final matchesInbound = _selectedInboundId == null || client['inbound_id'] == _selectedInboundId;

      return matchesQuery && matchesInbound;
    }).toList();

    // Apply sorting
    filteredClients.sort((a, b) {
      switch (_sortBy) {
        case 'name_asc':
          return (a['email'] ?? '').toString().compareTo((b['email'] ?? '').toString());
        case 'name_desc':
          return (b['email'] ?? '').toString().compareTo((a['email'] ?? '').toString());
        case 'traffic_desc':
          final aTraffic = (a['up'] ?? 0) + (a['down'] ?? 0);
          final bTraffic = (b['up'] ?? 0) + (b['down'] ?? 0);
          return bTraffic.compareTo(aTraffic);
        case 'traffic_asc':
          final aTraffic = (a['up'] ?? 0) + (a['down'] ?? 0);
          final bTraffic = (b['up'] ?? 0) + (b['down'] ?? 0);
          return aTraffic.compareTo(bTraffic);
        case 'expiry_asc':
          final aExp = a['expiry_time'] ?? 0;
          final bExp = b['expiry_time'] ?? 0;
          if (aExp == 0 && bExp == 0) return 0;
          if (aExp == 0) return 1;
          if (bExp == 0) return -1;
          return aExp.compareTo(bExp);
        default:
          return 0;
      }
    });

    return Scaffold(
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 80.0),
        child: FloatingActionButton(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const ClientFormScreen(),
              ),
            );
          },
          backgroundColor: AppColors.accentCyan,
          foregroundColor: const Color(0xFF0A0F1D),
          child: const Icon(LucideIcons.plus),
        ),
      ),
      body: Column(
        children: [
          // Filter section
          _buildFilterBar(inboundProvider),
          
          // Stats section
          _buildStatsHeader(clientProvider.clients),
          
          // Body content
          Expanded(
            child: RefreshIndicator(
              color: AppColors.accentCyan,
              backgroundColor: AppColors.bgCard,
              onRefresh: _fetchData,
              child: _buildListContent(clientProvider, filteredClients, inboundProvider.inbounds, auth.serverUrl),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterBar(InboundProvider inboundProvider) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgCard.withOpacity(0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor, width: 1.5),
      ),
      child: Column(
        children: [
          // Text Search field
          TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'E-posta veya UUID ara...',
              prefixIcon: const Icon(LucideIcons.search, size: 16),
              suffixIcon: _searchQuery.isNotEmpty
                  ? IconButton(
                      icon: const Icon(LucideIcons.x, size: 16),
                      onPressed: () {
                        setState(() {
                          _searchController.clear();
                          _searchQuery = '';
                        });
                      },
                    )
                  : null,
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
            ),
            style: const TextStyle(fontSize: 13),
            onChanged: (val) {
              setState(() {
                _searchQuery = val.trim().toLowerCase();
              });
            },
          ),
          const SizedBox(height: 10),
          
          Row(
            children: [
              Expanded(
                child: DropdownButtonFormField<int?>(
                  value: _selectedInboundId,
                  isExpanded: true,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    labelText: 'Inbound Filtrele',
                    labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                  style: TextStyle(fontSize: 13, color: AppColors.textPrimary),
                  dropdownColor: AppColors.bgCard,
                  items: [
                    DropdownMenuItem<int?>(
                      value: null,
                      child: Text(
                        'Tüm Inbound\'lar',
                        style: TextStyle(color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    ...inboundProvider.inbounds.map((inb) {
                      final remark = inb['remark'] ?? 'İsimsiz Inbound';
                      final protocol = inb['protocol']?.toString().toUpperCase() ?? 'VLESS';
                      return DropdownMenuItem<int?>(
                        value: inb['id'],
                        child: Text(
                          '$remark ($protocol)',
                          style: TextStyle(color: AppColors.textPrimary),
                          overflow: TextOverflow.ellipsis,
                          maxLines: 1,
                        ),
                      );
                    }),
                  ],
                  onChanged: (val) {
                    setState(() {
                      _selectedInboundId = val;
                    });
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: DropdownButtonFormField<String>(
                  value: _sortBy,
                  isExpanded: true,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    labelText: 'Sıralama',
                    labelStyle: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                  ),
                  style: TextStyle(fontSize: 13, color: AppColors.textPrimary),
                  dropdownColor: AppColors.bgCard,
                  items: [
                    DropdownMenuItem(
                      value: 'name_asc',
                      child: Text(
                        'İsim (A-Z)',
                        style: TextStyle(color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'name_desc',
                      child: Text(
                        'İsim (Z-A)',
                        style: TextStyle(color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'traffic_desc',
                      child: Text(
                        'Trafik (Çok-Az)',
                        style: TextStyle(color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'traffic_asc',
                      child: Text(
                        'Trafik (Az-Çok)',
                        style: TextStyle(color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                    DropdownMenuItem(
                      value: 'expiry_asc',
                      child: Text(
                        'Süre (Önce Biten)',
                        style: TextStyle(color: AppColors.textPrimary),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() {
                        _sortBy = val;
                      });
                    }
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatsHeader(List<dynamic> clients) {
    final totalCount = clients.length;
    final activeCount = clients.where((c) => c['enable'] == true).length;
    final onlineCount = clients.where((c) => c['online'] == true).length;
    final passiveCount = clients.where((c) => c['enable'] == false).length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      color: Colors.transparent,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            _buildStatPill('Toplam: $totalCount', AppColors.textSecondary),
            const SizedBox(width: 8),
            _buildStatPill('Aktif: $activeCount', AppColors.accentBlue),
            const SizedBox(width: 8),
            _buildStatPill('Çevrimiçi: $onlineCount', AppColors.success),
            const SizedBox(width: 8),
            _buildStatPill('Pasif: $passiveCount', AppColors.danger),
          ],
        ),
      ),
    );
  }

  Widget _buildStatPill(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3), width: 1),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildListContent(ClientProvider provider, List<dynamic> filteredClients, List<dynamic> inbounds, String serverUrl) {
    if (provider.isLoading && provider.clients.isEmpty) {
      return Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
        ),
      );
    }

    if (provider.errorMessage != null && provider.clients.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.alertTriangle, color: AppColors.danger, size: 48),
              const SizedBox(height: 16),
              Text(
                'Bir Hata Oluştu',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                provider.errorMessage!,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _fetchData,
                icon: const Icon(LucideIcons.refreshCw, size: 16),
                label: const Text('Yeniden Dene'),
              ),
            ],
          ),
        ),
      );
    }

    if (filteredClients.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.users, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text(
              'Kullanıcı Bulunamadı',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(
              'Arama veya filtre kriterlerini değiştirmeyi deneyin.',
              style: TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 100.0),
      itemCount: filteredClients.length,
      itemBuilder: (context, index) {
        final client = filteredClients[index];
        final id = client['id'];
        final email = client['email'] ?? '';
        final uuid = client['uuid'] ?? '';
        final isEnabled = client['enable'] ?? false;
        final isOnline = client['online'] ?? false;
        final inboundRemark = client['inbound_remark'] ?? 'Bilinmeyen Inbound';
        final expiryTime = client['expiry_time'] ?? 0;
        final comment = client['comment'] ?? '';

        // Traffic limits
        final double totalLimitGb = (client['total_gb'] as num?)?.toDouble() ?? 0.0;
        final int bytesUp = client['up'] ?? 0;
        final int bytesDown = client['down'] ?? 0;
        final int bytesUsed = bytesUp + bytesDown;
        final double totalUsedGb = bytesUsed / (1024 * 1024 * 1024);

        // Progress bar calculations
        double progressRatio = 0.0;
        Color progressBarColor = AppColors.success;
        if (totalLimitGb > 0) {
          progressRatio = (totalUsedGb / totalLimitGb).clamp(0.0, 1.0);
          if (progressRatio >= 0.9) {
            progressBarColor = AppColors.danger;
          } else if (progressRatio >= 0.7) {
            progressBarColor = AppColors.warning;
          }
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgCard.withOpacity(0.8),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isEnabled ? AppColors.borderColor : AppColors.danger.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Email and status toggle
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Flexible(
                              child: Text(
                                email,
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                              decoration: BoxDecoration(
                                color: isOnline ? AppColors.success.withOpacity(0.15) : AppColors.textMuted.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: isOnline ? AppColors.success.withOpacity(0.3) : AppColors.textMuted.withOpacity(0.3),
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  isOnline
                                      ? const BlinkingDot(color: Color(0xFF10B981), size: 5)
                                      : Container(
                                          width: 5,
                                          height: 5,
                                          decoration: BoxDecoration(
                                            color: AppColors.textMuted,
                                            shape: BoxShape.circle,
                                          ),
                                        ),
                                  const SizedBox(width: 4),
                                  Text(
                                    isOnline ? 'Çevrimiçi' : 'Çevrimdışı',
                                    style: TextStyle(
                                      fontSize: 8,
                                      color: isOnline ? AppColors.success : AppColors.textSecondary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 4),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Inbound: $inboundRemark',
                          style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  CustomSwitch(
                    value: isEnabled,
                    onChanged: (val) => _toggleClient(id, isEnabled),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Divider(color: AppColors.borderColor, height: 1),
              const SizedBox(height: 12),

              // 2. Expiry status and UUID details
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildExpiryBadge(expiryTime),
                  Expanded(
                    child: Align(
                      alignment: Alignment.centerRight,
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            'UUID: ${uuid.substring(0, math.min<int>(uuid.length as int, 8))}...',
                            style: TextStyle(fontSize: 10, fontFamily: 'monospace', color: AppColors.textMuted),
                          ),
                          const SizedBox(width: 4),
                          InkWell(
                            onTap: () {
                              Clipboard.setData(ClipboardData(text: uuid));
                              AppNotification.show(context, 'UUID kopyalandı!');
                            },
                            borderRadius: BorderRadius.circular(4),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                              child: Icon(
                                LucideIcons.copy,
                                color: AppColors.textSecondary,
                                size: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // Comment if present
              if (comment.isNotEmpty) ...[
                Text(
                  'Yorum: $comment',
                  style: TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 10),
              ],

              // 3. Traffic limit progress bar
              if (totalLimitGb > 0) ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Kota Kullanımı', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                    Text(
                      '${totalUsedGb.toStringAsFixed(2)} GB / ${totalLimitGb.toStringAsFixed(1)} GB',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progressRatio,
                    backgroundColor: AppColors.bgInput,
                    valueColor: AlwaysStoppedAnimation<Color>(progressBarColor),
                    minHeight: 6,
                  ),
                ),
              ] else ...[
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Kullanılan Trafik', style: TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                    Text(
                      '${totalUsedGb.toStringAsFixed(2)} GB (Limitsiz)',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Up: ${_formatBytes(bytesUp)} | Down: ${_formatBytes(bytesDown)}',
                    style: TextStyle(fontSize: 9, color: AppColors.textMuted),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Divider(color: AppColors.borderColor, height: 1),
              const SizedBox(height: 10),

              // 4. Action buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // QR connection Link button
                  IconButton(
                    icon: Icon(LucideIcons.qrCode, color: AppColors.accentCyan, size: 18),
                    tooltip: 'Bağlantı Linki & QR',
                    onPressed: () => _showLinkDialog(client, inbounds, serverUrl),
                  ),
                  
                  // Reset Traffic button
                  IconButton(
                    icon: Icon(LucideIcons.refreshCw, color: AppColors.warning, size: 18),
                    tooltip: 'Trafiği Sıfırla',
                    onPressed: () => _resetTraffic(id, email),
                  ),

                  // Edit button
                  IconButton(
                    icon: Icon(LucideIcons.edit2, color: AppColors.textSecondary, size: 18),
                    tooltip: 'Kullanıcıyı Düzenle',
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => ClientFormScreen(client: client),
                        ),
                      );
                    },
                  ),

                  // Delete button
                  IconButton(
                    icon: Icon(LucideIcons.trash2, color: AppColors.danger, size: 18),
                    tooltip: 'Kullanıcıyı Sil',
                    onPressed: () => _deleteClient(id, email),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
