import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';

class ClientStatsCard extends StatelessWidget {
  final int totalClients;
  final int activeClients;
  final int expiredClients;
  final int totalInbounds;
  final double totalTrafficGb;

  const ClientStatsCard({
    super.key,
    required this.totalClients,
    required this.activeClients,
    required this.expiredClients,
    required this.totalInbounds,
    required this.totalTrafficGb,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4.0),
          child: Text(
            'Kullanıcı & Sunucu Özetleri',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimary,
            ),
          ),
        ),
        const SizedBox(height: 12),
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.6,
          children: [
            _buildStatBox(
              'Toplam Kullanıcı',
              totalClients.toString(),
              LucideIcons.users,
              AppColors.accentPurple,
            ),
            _buildStatBox(
              'Aktif Kullanıcı',
              activeClients.toString(),
              LucideIcons.checkCircle2,
              AppColors.success,
            ),
            _buildStatBox(
              'Süresi Dolan / Pasif',
              expiredClients.toString(),
              LucideIcons.xCircle,
              AppColors.danger,
            ),
            _buildStatBox(
              'Kullanılan Trafik',
              '${totalTrafficGb.toStringAsFixed(2)} GB',
              LucideIcons.database,
              AppColors.accentCyan,
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStatBox(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.bgCard.withOpacity(0.8),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderColor, width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textSecondary,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
