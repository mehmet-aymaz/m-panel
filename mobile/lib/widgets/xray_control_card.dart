import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import 'blinking_dot.dart';

class XrayControlCard extends StatelessWidget {
  final bool active;
  final int uptime; // seconds
  final int tcpConnections;
  final int udpConnections;
  final bool isActionLoading;
  final Future<void> Function(String action) onAction;

  const XrayControlCard({
    super.key,
    required this.active,
    required this.uptime,
    required this.tcpConnections,
    required this.udpConnections,
    required this.isActionLoading,
    required this.onAction,
  });

  // Uptime formatting helper
  String _formatUptime(int seconds) {
    if (seconds <= 0) return '0 dk';
    final d = seconds ~/ (24 * 3600);
    final h = (seconds % (24 * 3600)) ~/ 3600;
    final m = (seconds % 3600) ~/ 60;

    final List<String> parts = [];
    if (d > 0) parts.add('$d gün');
    if (h > 0) parts.add('$h saat');
    if (m > 0 || parts.isEmpty) parts.add('$m dk');
    return parts.join(' ');
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.bgCard.withOpacity(0.8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderColor, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Icon(
                LucideIcons.shield,
                color: active ? AppColors.success : AppColors.danger,
                size: 18,
              ),
              const SizedBox(width: 8),
              Text(
                'Xray Servis Durumu',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),

          // Details List
          _buildDetailRow('Durum', active ? 'Çalışıyor' : 'Durduruldu', 
            badgeColor: active ? AppColors.success : AppColors.danger),
          _buildDetailRow('Versiyon', 'v26.3.27'),
          _buildDetailRow('Protokoller', 'VLESS, VMess, Trojan', isCyanText: true),
          _buildDetailRow('Çalışma Süresi', _formatUptime(uptime)),
          _buildDetailRow('Bağlantılar (TCP/UDP)', '$tcpConnections / $udpConnections'),

          const SizedBox(height: 16),
          Divider(color: AppColors.borderColor, height: 1),
          const SizedBox(height: 16),

          // Action Buttons Row
          Row(
            children: [
              // Start Button
              Expanded(
                child: Opacity(
                  opacity: active ? 0.5 : 1.0,
                  child: ElevatedButton.icon(
                    onPressed: (active || isActionLoading) ? null : () => onAction('start'),
                    icon: const Icon(LucideIcons.play, size: 14),
                    label: const Text('Başlat', style: TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      backgroundColor: AppColors.success,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: AppColors.success.withOpacity(0.3),
                      disabledForegroundColor: Colors.white.withOpacity(0.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Stop Button
              Expanded(
                child: Opacity(
                  opacity: !active ? 0.5 : 1.0,
                  child: OutlinedButton.icon(
                    onPressed: (!active || isActionLoading) ? null : () => onAction('stop'),
                    icon: const Icon(LucideIcons.power, size: 14),
                    label: const Text('Durdur', style: TextStyle(fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      foregroundColor: AppColors.danger,
                      side: BorderSide(color: AppColors.danger, width: 1.2),
                      disabledForegroundColor: AppColors.danger.withOpacity(0.5),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),

              // Restart Button
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: isActionLoading ? null : () => onAction('restart'),
                  icon: isActionLoading
                      ? SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor: AlwaysStoppedAnimation<Color>(AppColors.textPrimary),
                          ),
                        )
                      : const Icon(LucideIcons.refreshCw, size: 14),
                  label: const Text('Y. Başlat', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    foregroundColor: AppColors.textPrimary,
                    side: BorderSide(color: AppColors.borderColor, width: 1.2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? badgeColor, bool isCyanText = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          if (badgeColor != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: badgeColor.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: badgeColor.withOpacity(0.3)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  badgeColor == AppColors.success
                      ? const BlinkingDot(color: Color(0xFF10B981), size: 6)
                      : Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: badgeColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                  const SizedBox(width: 6),
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: badgeColor,
                    ),
                  ),
                ],
              ),
            )
          else
            Text(
              value,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isCyanText ? AppColors.accentCyan : AppColors.textPrimary,
              ),
            ),
        ],
      ),
    );
  }
}
