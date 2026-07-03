import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/system_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import '../constants/translations.dart';
import '../widgets/radial_gauge.dart';
import '../widgets/speed_card.dart';
import '../widgets/xray_control_card.dart';
import '../widgets/client_stats_card.dart';
import '../widgets/app_notification.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver, AutomaticKeepAliveClientMixin {
  Timer? _refreshTimer;
  bool _isFirstLoad = true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    
    // Initial fetch
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchInitialData();
    });
  }

  @override
  void dispose() {
    _stopTimer();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _startTimer();
      _fetchSilentUpdate();
    } else {
      _stopTimer();
    }
  }

  Future<void> _fetchInitialData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final system = Provider.of<SystemProvider>(context, listen: false);
    
    system.resetSpeedState();
    await system.fetchData(auth.apiService);
    
    setState(() {
      _isFirstLoad = false;
    });

    _startTimer();
  }

  Future<void> _fetchSilentUpdate() async {
    if (!mounted) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final system = Provider.of<SystemProvider>(context, listen: false);
    await system.fetchData(auth.apiService, isSilent: true);
  }

  void _startTimer() {
    _stopTimer();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (timer) {
      _fetchSilentUpdate();
    });
  }

  void _stopTimer() {
    _refreshTimer?.cancel();
    _refreshTimer = null;
  }

  Future<void> _handleRefresh() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final system = Provider.of<SystemProvider>(context, listen: false);
    system.resetSpeedState();
    await system.fetchData(auth.apiService, isSilent: true);
  }

  Future<void> _executeXrayAction(String action) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final system = Provider.of<SystemProvider>(context, listen: false);

    // Show processing indicator
    AppNotification.show(context, tr(context, 'xray_service_sending', args: {'action': action}));
    try {
      await system.controlXray(auth.apiService, action);
      if (mounted) {
        AppNotification.show(
          context, 
          tr(context, 'xray_service_success'),
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotification.show(context, tr(context, 'xray_service_failed', args: {'error': e.toString()}), isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    Provider.of<ThemeProvider>(context);
    final system = Provider.of<SystemProvider>(context);

    // Initial Loading State
    if (_isFirstLoad && system.isLoading) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
              ),
              const SizedBox(height: 16),
              Text(
                tr(context, 'loading_data'),
                style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    // Initial Connection Error State
    if (system.errorMessage != null && system.systemStatus == null) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.bgCard,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: AppColors.danger.withOpacity(0.2)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.alertTriangle, color: AppColors.danger, size: 48),
                  const SizedBox(height: 16),
                  Text(
                    tr(context, 'error_occurred'),
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    system.errorMessage!,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _fetchInitialData,
                    icon: const Icon(LucideIcons.refreshCw, size: 16),
                    label: Text(tr(context, 'retry')),
                    style: ElevatedButton.styleFrom(backgroundColor: AppColors.accentCyan),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    // Extract metrics helper
    final status = system.systemStatus ?? {};
    final cpuUsage = (status['cpu_usage'] as num?)?.toDouble() ?? 0.0;
    final cpuCores = status['cpu_cores'] ?? 1;

    final mem = status['memory'] ?? {};
    final memPercent = (mem['percent'] as num?)?.toDouble() ?? 0.0;
    final memUsed = mem['used_bytes'] ?? 0;
    final memTotal = mem['total_bytes'] ?? 0;

    final swap = status['swap'] ?? {};
    final swapPercent = (swap['percent'] as num?)?.toDouble() ?? 0.0;
    final swapUsed = swap['used_bytes'] ?? 0;
    final swapTotal = swap['total_bytes'] ?? 0;

    final disk = status['disk'] ?? {};
    final diskPercent = (disk['percent'] as num?)?.toDouble() ?? 0.0;
    final diskUsed = disk['used_bytes'] ?? 0;
    final diskTotal = disk['total_bytes'] ?? 0;

    final netIo = status['net_io'] ?? {};
    final netSent = netIo['bytes_sent'] ?? 0;
    final netRecv = netIo['bytes_recv'] ?? 0;

    final connections = status['connections'] ?? {};
    final tcpCount = connections['tcp'] ?? 0;
    final udpCount = connections['udp'] ?? 0;

    final uptime = status['uptime'] ?? 0;
    final xrayActive = status['xray_service_active'] ?? false;

    final double totalTrafficGb = (system.dashboardSummary?['total_traffic_used_gb'] as num?)?.toDouble() ?? 0.0;
    final int totalInbounds = system.dashboardSummary?['total_inbounds_count'] ?? 0;

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.accentCyan,
        backgroundColor: AppColors.bgCard,
        onRefresh: _handleRefresh,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 100.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // System Gauges Grid
              GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                childAspectRatio: 1.08,
                children: [
                  RadialGauge(
                    value: cpuUsage,
                    color: AppColors.accentCyan,
                    label: tr(context, 'cpu_usage'),
                    icon: LucideIcons.cpu,
                    details: 'Çekirdek: $cpuCores',
                  ),
                  RadialGauge(
                    value: memPercent,
                    color: AppColors.accentPurple,
                    label: tr(context, 'ram_usage'),
                    icon: LucideIcons.database,
                    details: SpeedCard.formatBytes(memUsed),
                    subdetails: 'Toplam: ${SpeedCard.formatBytes(memTotal)}',
                  ),
                  RadialGauge(
                    value: swapPercent,
                    color: AppColors.warning,
                    label: tr(context, 'swap_memory'),
                    icon: LucideIcons.database,
                    details: SpeedCard.formatBytes(swapUsed),
                    subdetails: 'Toplam: ${SpeedCard.formatBytes(swapTotal)}',
                  ),
                  RadialGauge(
                    value: diskPercent,
                    color: AppColors.accentBlue,
                    label: tr(context, 'disk_space'),
                    icon: LucideIcons.hardDrive,
                    details: SpeedCard.formatBytes(diskUsed),
                    subdetails: 'Toplam: ${SpeedCard.formatBytes(diskTotal)}',
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Speed & IO Card
              SpeedCard(
                uploadSpeed: system.uploadSpeed,
                downloadSpeed: system.downloadSpeed,
                totalSent: netSent,
                totalReceived: netRecv,
              ),
              const SizedBox(height: 16),

              // Xray controls
              XrayControlCard(
                active: xrayActive,
                uptime: uptime,
                tcpConnections: tcpCount,
                udpConnections: udpCount,
                isActionLoading: system.isActionLoading,
                onAction: _executeXrayAction,
              ),
              const SizedBox(height: 16),

              // Client Stats
              ClientStatsCard(
                totalClients: system.totalClients,
                activeClients: system.activeClients,
                expiredClients: system.expiredClients,
                totalInbounds: totalInbounds,
                totalTrafficGb: totalTrafficGb,
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}
