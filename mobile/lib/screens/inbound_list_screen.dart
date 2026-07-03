import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/inbound_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import 'inbound_form_screen.dart';
import '../widgets/app_notification.dart';
import '../widgets/custom_switch.dart';
import '../widgets/blinking_dot.dart';

class InboundListScreen extends StatefulWidget {
  const InboundListScreen({super.key});

  @override
  State<InboundListScreen> createState() => _InboundListScreenState();
}

class _InboundListScreenState extends State<InboundListScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchInbounds();
    });
  }

  Future<void> _fetchInbounds() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final inboundProvider = Provider.of<InboundProvider>(context, listen: false);
    await inboundProvider.fetchInbounds(auth.apiService);
  }

  // Format bytes helper
  String _formatBytes(num bytes, {int decimals = 2}) {
    if (bytes <= 0) return '0 B';
    const suffixes = ['B', 'KB', 'MB', 'GB', 'TB'];
    var i = (math.log(bytes) / math.log(1024)).floor();
    var value = bytes / math.pow(1024, i);
    return '${value.toStringAsFixed(value < 10 && i > 0 ? decimals : 1)} ${suffixes[i]}';
  }

  Future<void> _toggleInbound(int id, bool currentValue) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final inboundProvider = Provider.of<InboundProvider>(context, listen: false);
    
    try {
      await inboundProvider.toggleInbound(auth.apiService, id);
      if (mounted) {
        AppNotification.show(context, 'Inbound durumu başarıyla güncellendi.');
      }
    } catch (e) {
      if (mounted) {
        AppNotification.show(context, 'Hata: ${e.toString()}', isError: true);
      }
    }
  }

  Future<void> _deleteInbound(int id, String remark) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final inboundProvider = Provider.of<InboundProvider>(context, listen: false);

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: AppColors.borderColor),
          ),
          title: const Text('Inbound Silinsin mi?'),
          content: Text(
            '"$remark" isimli inbound silinecektir. Bu işlem ilişkili tüm kullanıcıları da silecektir. Devam etmek istediğinize emin misiniz?',
            style: TextStyle(color: AppColors.textSecondary, height: 1.4),
          ),
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
        await inboundProvider.deleteInbound(auth.apiService, id);
        if (mounted) {
          AppNotification.show(context, 'Inbound başarıyla silindi.');
        }
      } catch (e) {
        if (mounted) {
          AppNotification.show(context, 'Hata: ${e.toString()}', isError: true);
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    Provider.of<ThemeProvider>(context);
    final inboundProvider = Provider.of<InboundProvider>(context);

    return Scaffold(
      floatingActionButton: Padding(
        padding: const EdgeInsets.only(bottom: 80.0),
        child: FloatingActionButton(
          onPressed: () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => const InboundFormScreen(),
              ),
            );
          },
          backgroundColor: AppColors.accentCyan,
          foregroundColor: const Color(0xFF0A0F1D),
          child: const Icon(LucideIcons.plus),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.accentCyan,
        backgroundColor: AppColors.bgCard,
        onRefresh: _fetchInbounds,
        child: _buildBody(inboundProvider),
      ),
    );
  }

  Widget _buildBody(InboundProvider provider) {
    if (provider.isLoading && provider.inbounds.isEmpty) {
      return Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
        ),
      );
    }

    if (provider.errorMessage != null && provider.inbounds.isEmpty) {
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
                onPressed: _fetchInbounds,
                icon: const Icon(LucideIcons.refreshCw, size: 16),
                label: const Text('Yeniden Dene'),
              ),
            ],
          ),
        ),
      );
    }

    if (provider.inbounds.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.server, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 16),
            Text(
              'Kayıtlı Inbound Bulunmuyor',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Sağ alttaki "+" butonuna basarak yeni bir inbound ekleyebilirsiniz.',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 100.0),
      itemCount: provider.inbounds.length,
      itemBuilder: (context, index) {
        final inbound = provider.inbounds[index];
        final remark = inbound['remark'] == null || inbound['remark'].toString().trim().isEmpty
            ? 'İsimsiz Inbound'
            : inbound['remark'].toString();
        final protocol = inbound['protocol'].toString().toUpperCase();
        final port = inbound['port'];
        final isEnabled = inbound['enable'] ?? false;
        final totalTraffic = inbound['total'] ?? 0;
        final network = inbound['network'] ?? 'ws';
        final security = inbound['security'] ?? 'tls';
        final clientsCount = inbound['total_clients'] ?? 0;
        final activeClientsCount = inbound['active_clients'] ?? 0;
        final onlineClientsCount = inbound['online_clients'] ?? 0;

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
              // Title and switch status
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
                                remark,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.textPrimary,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: isEnabled ? AppColors.success.withOpacity(0.15) : AppColors.textMuted.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: isEnabled ? AppColors.success.withOpacity(0.3) : AppColors.textMuted.withOpacity(0.3),
                                  width: 1,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  isEnabled
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
                                    isEnabled ? 'Aktif' : 'Pasif',
                                    style: TextStyle(
                                      fontSize: 8,
                                      color: isEnabled ? AppColors.success : AppColors.textSecondary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: AppColors.accentCyan.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                protocol,
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  color: AppColors.accentCyan,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Port: $port',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  CustomSwitch(
                    value: isEnabled,
                    onChanged: (val) => _toggleInbound(inbound['id'], isEnabled),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Divider(color: AppColors.borderColor, height: 1),
              const SizedBox(height: 12),

              // Network + Security details
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.accentPurple.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: AppColors.accentPurple.withOpacity(0.3)),
                        ),
                        child: Text(
                          network.toString().toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: AppColors.accentPurple,
                          ),
                        ),
                      ),
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: security.toString().toLowerCase() == 'none'
                              ? AppColors.danger.withOpacity(0.15)
                              : AppColors.accentBlue.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: security.toString().toLowerCase() == 'none'
                                ? AppColors.danger.withOpacity(0.3)
                                : AppColors.accentBlue.withOpacity(0.3),
                          ),
                        ),
                        child: Text(
                          security.toString().toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            color: security.toString().toLowerCase() == 'none'
                                ? AppColors.danger
                                : AppColors.accentBlue,
                          ),
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Icon(LucideIcons.database, color: AppColors.textMuted, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        'Toplam Trafik: ${_formatBytes(totalTraffic)}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 10),

              // User counts
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.users, color: AppColors.textMuted, size: 14),
                      const SizedBox(width: 6),
                      Text(
                        'Kullanıcılar: $activeClientsCount / $clientsCount Aktif',
                        style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                  if (onlineClientsCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.success.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.success.withOpacity(0.3)),
                      ),
                      child: Text(
                        '$onlineClientsCount Çevrimiçi',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                          color: AppColors.success,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 14),
              Divider(color: AppColors.borderColor, height: 1),
              const SizedBox(height: 12),

              // Edit & Delete row buttons
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  // Edit Button
                  TextButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => InboundFormScreen(inbound: inbound),
                        ),
                      );
                    },
                    icon: const Icon(LucideIcons.edit2, size: 14),
                    label: const Text('Düzenle', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.accentCyan,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // Delete Button
                  TextButton.icon(
                    onPressed: () => _deleteInbound(inbound['id'], remark),
                    icon: const Icon(LucideIcons.trash2, size: 14),
                    label: const Text('Sil', style: TextStyle(fontSize: 12)),
                    style: TextButton.styleFrom(
                      foregroundColor: AppColors.danger,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    ),
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
