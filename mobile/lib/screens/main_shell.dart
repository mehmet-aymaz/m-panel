import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import '../constants/translations.dart';
import 'package:flutter/services.dart';
import '../widgets/app_notification.dart';
import 'home_screen.dart';
import 'inbound_list_screen.dart';
import 'client_list_screen.dart';
import 'settings_screen.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  late final PageController _pageController;
  late final List<Widget> _screens;
  DateTime? _lastPressedAt;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
    _screens = const [
      HomeScreen(),
      InboundListScreen(),
      ClientListScreen(),
      SettingsScreen(),
    ];
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    return PopScope(
      canPop: false,
      onPopInvoked: (bool didPop) async {
        if (didPop) return;
        
        // 1. If not on the first page, go back to the first page (Dashboard)
        if (_currentIndex != 0) {
          _pageController.animateToPage(
            0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
          return;
        }
        
        // 2. If on the first page, check for double back tap within 2 seconds
        final now = DateTime.now();
        if (_lastPressedAt == null || now.difference(_lastPressedAt!) > const Duration(seconds: 2)) {
          _lastPressedAt = now;
          AppNotification.show(context, tr(context, 'press_back_again_to_exit'));
        } else {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        extendBody: true,
      appBar: AppBar(
        backgroundColor: AppColors.bgSecondary,
        elevation: 0,
        toolbarHeight: 64,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _getAppBarTitle(context),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.accentCyan.withOpacity(0.15),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: AppColors.accentCyan.withOpacity(0.3),
                  width: 1,
                ),
              ),
              child: Text(
                auth.serverUrl.replaceFirst(RegExp(r'https?://'), ''),
                style: TextStyle(
                  fontSize: 9,
                  color: AppColors.accentCyan,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16.0, top: 10.0, bottom: 10.0),
            child: InkWell(
              onTap: () => _showLogoutDialog(context, auth),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.danger.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.danger.withOpacity(0.3),
                    width: 1.5,
                  ),
                ),
                child: Icon(
                  LucideIcons.logOut,
                  color: AppColors.danger,
                  size: 18,
                ),
              ),
            ),
          ),
        ],
      ),
      body: PageView(
        controller: _pageController,
        onPageChanged: (index) {
          setState(() {
            _currentIndex = index;
          });
        },
        children: _screens,
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16.0, 0.0, 16.0, 16.0),
          child: Container(
            height: 72,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: AppColors.bgSecondary.withOpacity(0.95),
              borderRadius: BorderRadius.circular(36),
              border: Border.all(
                color: AppColors.borderColor,
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.4),
                  blurRadius: 16,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildCustomNavItem(0, LucideIcons.gauge, tr(context, 'tab_overview')),
                _buildCustomNavItem(1, LucideIcons.server, tr(context, 'tab_inbounds')),
                _buildCustomNavItem(2, LucideIcons.users, tr(context, 'tab_users')),
                _buildCustomNavItem(3, LucideIcons.settings, tr(context, 'tab_settings')),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}

  Widget _buildCustomNavItem(int index, IconData iconData, String label) {
    final isActive = _currentIndex == index;
    final activeColor = AppColors.accentCyan;
    final inactiveColor = AppColors.textMuted;

    return Expanded(
      child: GestureDetector(
        onTap: () {
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        },
        behavior: HitTestBehavior.opaque,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 6),
          decoration: BoxDecoration(
            color: isActive 
                ? activeColor.withOpacity(0.15) 
                : Colors.transparent,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isActive 
                  ? activeColor.withOpacity(0.3) 
                  : Colors.transparent,
              width: 1.5,
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                iconData,
                color: isActive ? activeColor : inactiveColor,
                size: 20,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: isActive ? activeColor : inactiveColor,
                  fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
                  fontSize: 10,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getAppBarTitle(BuildContext context) {
    switch (_currentIndex) {
      case 0:
        return tr(context, 'title_dashboard');
      case 1:
        return tr(context, 'title_inbounds');
      case 2:
        return tr(context, 'title_clients');
      case 3:
        return tr(context, 'title_settings');
      default:
        return 'M-Panel';
    }
  }

  void _showLogoutDialog(BuildContext context, AuthProvider auth) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: AppColors.borderColor),
          ),
          title: Text(tr(context, 'logout_title')),
          content: Text(tr(context, 'logout_confirm')),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(tr(context, 'cancel'), style: TextStyle(color: AppColors.textSecondary)),
            ),
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                auth.logout();
              },
              child: Text(tr(context, 'logout'), style: TextStyle(color: AppColors.danger)),
            ),
          ],
        );
      },
    );
  }
}


