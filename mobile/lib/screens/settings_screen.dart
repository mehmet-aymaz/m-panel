import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/theme_provider.dart';
import '../providers/language_provider.dart';
import '../constants/theme.dart';
import '../constants/translations.dart';
import 'api_tokens_screen.dart';
import '../widgets/app_notification.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> with AutomaticKeepAliveClientMixin {
  final _telegramFormKey = GlobalKey<FormState>();
  final _passwordFormKey = GlobalKey<FormState>();

  final _botTokenController = TextEditingController();
  final _chatIdController = TextEditingController();
  
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isPasswordObscure1 = true;
  bool _isPasswordObscure2 = true;
  bool _isPasswordObscure3 = true;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadSettingsData();
    });
  }

  @override
  void dispose() {
    _botTokenController.dispose();
    _chatIdController.dispose();
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _loadSettingsData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final settingsProv = Provider.of<SettingsProvider>(context, listen: false);
    
    try {
      await settingsProv.fetchSettings(auth.apiService);
      
      final botToken = settingsProv.getSettingValue('telegram_bot_token');
      final chatId = settingsProv.getSettingValue('telegram_chat_id');
      
      _botTokenController.text = botToken;
      _chatIdController.text = chatId;
    } catch (_) {}
  }

  Future<void> _saveTelegramSettings() async {
    if (!_telegramFormKey.currentState!.validate()) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final settingsProv = Provider.of<SettingsProvider>(context, listen: false);

    final settingsToUpdate = [
      {'key': 'telegram_bot_token', 'value': _botTokenController.text.trim()},
      {'key': 'telegram_chat_id', 'value': _chatIdController.text.trim()},
    ];

    try {
      await settingsProv.updateSettings(auth.apiService, settingsToUpdate);
      if (mounted) {
        AppNotification.show(context, tr(context, 'telegram_saved_success'));
      }
    } catch (e) {
      if (mounted) {
        AppNotification.show(context, tr(context, 'telegram_saved_failed', args: {'error': e.toString()}), isError: true);
      }
    }
  }

  Future<void> _sendTestMessage() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final settingsProv = Provider.of<SettingsProvider>(context, listen: false);

    AppNotification.show(context, tr(context, 'telegram_testing'));

    try {
      await settingsProv.testTelegram(auth.apiService);
      if (mounted) {
        AppNotification.show(context, tr(context, 'telegram_test_success'));
      }
    } catch (e) {
      if (mounted) {
        AppNotification.show(context, tr(context, 'telegram_test_failed', args: {'error': e.toString()}), isError: true);
      }
    }
  }

  Future<void> _updatePassword() async {
    if (!_passwordFormKey.currentState!.validate()) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final settingsProv = Provider.of<SettingsProvider>(context, listen: false);

    try {
      await settingsProv.changePassword(
        auth.apiService,
        _currentPasswordController.text,
        _newPasswordController.text,
      );
      
      if (mounted) {
        _currentPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
        
        AppNotification.show(context, tr(context, 'password_updated_success'));
      }
    } catch (e) {
      if (mounted) {
        AppNotification.show(context, tr(context, 'password_updated_failed', args: {'error': e.toString()}), isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    Provider.of<ThemeProvider>(context);
    final settingsProv = Provider.of<SettingsProvider>(context);

    if (settingsProv.isLoading && settingsProv.settings.isEmpty) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
          ),
        ),
      );
    }

    return Scaffold(
      body: RefreshIndicator(
        color: AppColors.accentCyan,
        backgroundColor: AppColors.bgCard,
        onRefresh: _loadSettingsData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 100.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 0. Appearance and Language Settings Card
              _buildAppearanceAndLanguageCard(context),
              const SizedBox(height: 16),

              // 1. Telegram Settings Card
              _buildTelegramCard(settingsProv),
              const SizedBox(height: 16),

              // 2. Change Password Card
              _buildPasswordCard(settingsProv),
              const SizedBox(height: 16),

              // 2.5 API Keys Card
              _buildApiKeysCard(),
              const SizedBox(height: 16),

              // 3. Local Push Notifications Card
              _buildLocalNotificationsCard(settingsProv),
              const SizedBox(height: 16),

              // 4. Update Check Card
              _buildUpdateCheckCard(context, settingsProv),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAppearanceAndLanguageCard(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final languageProvider = Provider.of<LanguageProvider>(context);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.palette, color: AppColors.accentCyan),
                const SizedBox(width: 10),
                Text(
                  tr(context, 'appearance_language'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              tr(context, 'appearance_language_desc'),
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            Divider(color: AppColors.borderColor, height: 24),

            // Theme Dropdown
            Text(
              tr(context, 'theme_selection'),
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            Theme(
              data: Theme.of(context).copyWith(
                splashFactory: NoSplash.splashFactory,
                highlightColor: Colors.transparent,
                hoverColor: Colors.transparent,
                splashColor: Colors.transparent,
              ),
              child: DropdownButtonFormField<String>(
                value: themeProvider.currentTheme,
                dropdownColor: AppColors.bgCard,
                iconEnabledColor: AppColors.accentCyan,
                style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.monitor, size: 16, color: AppColors.textMuted),
                ),
                items: [
                  DropdownMenuItem(value: 'cyberpunk', child: Text(tr(context, 'theme_cyberpunk'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'dracula', child: Text(tr(context, 'theme_dracula'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'nord', child: Text(tr(context, 'theme_nord'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'emerald', child: Text(tr(context, 'theme_emerald'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'light', child: Text(tr(context, 'theme_light'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'dark', child: Text(tr(context, 'theme_dark'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'gold', child: Text(tr(context, 'theme_gold'), style: TextStyle(color: AppColors.textPrimary))),
                ],
                onChanged: (val) {
                  if (val != null) themeProvider.setTheme(val);
                },
              ),
            ),
            const SizedBox(height: 16),

            // Language Dropdown
            Text(
              tr(context, 'language_selection'),
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 8),
            Theme(
              data: Theme.of(context).copyWith(
                splashFactory: NoSplash.splashFactory,
                highlightColor: Colors.transparent,
                hoverColor: Colors.transparent,
                splashColor: Colors.transparent,
              ),
              child: DropdownButtonFormField<String>(
                value: languageProvider.currentLanguage,
                dropdownColor: AppColors.bgCard,
                iconEnabledColor: AppColors.accentCyan,
                style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.globe, size: 16, color: AppColors.textMuted),
                ),
                items: [
                  DropdownMenuItem(value: 'tr', child: Text(tr(context, 'lang_tr'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'en', child: Text(tr(context, 'lang_en'), style: TextStyle(color: AppColors.textPrimary))),
                  DropdownMenuItem(value: 'de', child: Text(tr(context, 'lang_de'), style: TextStyle(color: AppColors.textPrimary))),
                ],
                onChanged: (val) {
                  if (val != null) languageProvider.setLanguage(val);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTelegramCard(SettingsProvider settingsProv) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _telegramFormKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.send, color: AppColors.accentCyan),
                  const SizedBox(width: 10),
                  Text(
                    tr(context, 'telegram_integration'),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                tr(context, 'telegram_integration_desc'),
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              Divider(color: AppColors.borderColor, height: 24),
              
              // Bot Token input
              Text(tr(context, 'bot_token'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _botTokenController,
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.key, size: 16, color: AppColors.textMuted),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return tr(context, 'bot_token_required');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Chat ID input
              Text(tr(context, 'chat_id'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _chatIdController,
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.messageSquare, size: 16, color: AppColors.textMuted),
                ),
                validator: (val) {
                  if (val == null || val.trim().isEmpty) {
                    return tr(context, 'chat_id_required');
                  }
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Actions buttons row
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: settingsProv.isTesting ? null : _sendTestMessage,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: AppColors.accentCyan),
                        foregroundColor: AppColors.accentCyan,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: settingsProv.isTesting
                          ? SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan)),
                            )
                          : const Icon(LucideIcons.bellRing, size: 16),
                      label: Text(tr(context, 'test_btn'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: settingsProv.isSaving ? null : _saveTelegramSettings,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      icon: settingsProv.isSaving
                          ? SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(AppColors.bgPrimary)),
                            )
                          : const Icon(LucideIcons.save, size: 16),
                      label: Text(tr(context, 'save_btn'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
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

  Widget _buildPasswordCard(SettingsProvider settingsProv) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _passwordFormKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(LucideIcons.lock, color: AppColors.accentPurple),
                  const SizedBox(width: 10),
                  Text(
                    tr(context, 'profile_settings'),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.bold,
                          color: AppColors.textPrimary,
                        ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                tr(context, 'profile_settings_desc'),
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              Divider(color: AppColors.borderColor, height: 24),

              // Current password
              Text(tr(context, 'current_password'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _currentPasswordController,
                obscureText: _isPasswordObscure1,
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.lock, size: 16, color: AppColors.textMuted),
                  suffixIcon: IconButton(
                    icon: Icon(_isPasswordObscure1 ? LucideIcons.eyeOff : LucideIcons.eye, size: 16, color: AppColors.textMuted),
                    onPressed: () => setState(() => _isPasswordObscure1 = !_isPasswordObscure1),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.isEmpty) return tr(context, 'current_password_required');
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // New password
              Text(tr(context, 'new_password'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _newPasswordController,
                obscureText: _isPasswordObscure2,
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.shieldAlert, size: 16, color: AppColors.textMuted),
                  suffixIcon: IconButton(
                    icon: Icon(_isPasswordObscure2 ? LucideIcons.eyeOff : LucideIcons.eye, size: 16, color: AppColors.textMuted),
                    onPressed: () => setState(() => _isPasswordObscure2 = !_isPasswordObscure2),
                  ),
                ),
                validator: (val) {
                  if (val == null || val.length < 5) return tr(context, 'new_password_required');
                  return null;
                },
              ),
              const SizedBox(height: 16),

              // Confirm new password
              Text(tr(context, 'confirm_password'), style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textSecondary)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _confirmPasswordController,
                obscureText: _isPasswordObscure3,
                decoration: InputDecoration(
                  prefixIcon: Icon(LucideIcons.shieldCheck, size: 16, color: AppColors.textMuted),
                  suffixIcon: IconButton(
                    icon: Icon(_isPasswordObscure3 ? LucideIcons.eyeOff : LucideIcons.eye, size: 16, color: AppColors.textMuted),
                    onPressed: () => setState(() => _isPasswordObscure3 = !_isPasswordObscure3),
                  ),
                ),
                validator: (val) {
                  if (val != _newPasswordController.text) return tr(context, 'confirm_password_mismatch');
                  return null;
                },
              ),
              const SizedBox(height: 20),

              // Password update action button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: settingsProv.isSaving ? null : _updatePassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentPurple,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  icon: settingsProv.isSaving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)),
                        )
                      : const Icon(LucideIcons.key, size: 16),
                  label: Text(tr(context, 'update_password_btn'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLocalNotificationsCard(SettingsProvider settingsProv) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.bell, color: AppColors.accentBlue),
                const SizedBox(width: 10),
                Text(
                  tr(context, 'mobile_notifications_options'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              tr(context, 'mobile_notifications_options_desc'),
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            Divider(color: AppColors.borderColor, height: 24),

            // CPU/RAM Alert Toggle
            SwitchListTile(
              value: settingsProv.notifyCpuRam,
              onChanged: (val) => settingsProv.setNotifyCpuRam(val),
              title: Text(tr(context, 'critical_resource_alert'), style: const TextStyle(fontSize: 14)),
              subtitle: Text(tr(context, 'critical_resource_alert_desc'), style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              activeColor: AppColors.accentCyan,
              contentPadding: EdgeInsets.zero,
            ),

            // Expiry Alert Toggle
            SwitchListTile(
              value: settingsProv.notifyExpiry,
              onChanged: (val) => settingsProv.setNotifyExpiry(val),
              title: Text(tr(context, 'customer_expiry_alert'), style: const TextStyle(fontSize: 14)),
              subtitle: Text(tr(context, 'customer_expiry_alert_desc'), style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              activeColor: AppColors.accentCyan,
              contentPadding: EdgeInsets.zero,
            ),

            // New User Alert Toggle
            SwitchListTile(
              value: settingsProv.notifyNewUser,
              onChanged: (val) => settingsProv.setNotifyNewUser(val),
              title: Text(tr(context, 'new_user_alert'), style: const TextStyle(fontSize: 14)),
              subtitle: Text(tr(context, 'new_user_alert_desc'), style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
              activeColor: AppColors.accentCyan,
              contentPadding: EdgeInsets.zero,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildApiKeysCard() {
    return Card(
      child: ListTile(
        leading: Icon(LucideIcons.key, color: AppColors.accentCyan),
        title: Text(
          tr(context, 'api_keys_btn'),
          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
        ),
        subtitle: Text(
          tr(context, 'api_keys_desc'),
          style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
        ),
        trailing: Icon(LucideIcons.chevronRight, color: AppColors.textSecondary, size: 16),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const ApiTokensScreen(),
            ),
          );
        },
      ),
    );
  }

  Widget _buildUpdateCheckCard(BuildContext context, SettingsProvider settingsProv) {
    final String currentAppVersion = settingsProv.currentAppVersion;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(LucideIcons.downloadCloud, color: AppColors.accentCyan),
                const SizedBox(width: 10),
                Text(
                  tr(context, 'update_check'),
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              tr(context, 'update_check_desc'),
              style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
            ),
            Divider(color: AppColors.borderColor, height: 24),

            // Current Version Label
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  tr(context, 'current_version_label', args: {'version': currentAppVersion}),
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.textPrimary),
                ),
                if (!settingsProv.isCheckingUpdate && !settingsProv.isDownloadingUpdate)
                  ElevatedButton.icon(
                    onPressed: () async {
                      try {
                        await settingsProv.checkForUpdates(currentAppVersion);
                        if (mounted) {
                          if (settingsProv.updateAvailable) {
                            AppNotification.show(context, tr(context, 'update_available'));
                          } else {
                            AppNotification.show(context, tr(context, 'up_to_date_desc', args: {'version': currentAppVersion}));
                          }
                        }
                      } catch (e) {
                        if (mounted) {
                          AppNotification.show(context, tr(context, 'download_failed', args: {'error': e.toString()}), isError: true);
                        }
                      }
                    },
                    icon: const Icon(LucideIcons.refreshCw, size: 14),
                    label: Text(tr(context, 'check_btn'), style: const TextStyle(fontSize: 12)),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      backgroundColor: AppColors.accentCyan.withOpacity(0.15),
                      foregroundColor: AppColors.accentCyan,
                    ),
                  ),
              ],
            ),

            if (settingsProv.isCheckingUpdate) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan)),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    tr(context, 'checking_updates'),
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                ],
              ),
            ],

            if (!settingsProv.isCheckingUpdate && settingsProv.updateAvailable) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.accentCyan.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.accentCyan.withOpacity(0.15)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(LucideIcons.info, size: 16, color: AppColors.accentCyan),
                        const SizedBox(width: 8),
                        Text(
                          tr(context, 'update_available'),
                          style: TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      tr(context, 'update_available_desc', args: {'version': settingsProv.latestVersion}),
                      style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                    ),
                    if (settingsProv.changelog.isNotEmpty) ...[
                      const SizedBox(height: 8),
                      Text(
                        'Değişiklikler:',
                        style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        settingsProv.changelog,
                        style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (!settingsProv.isDownloadingUpdate)
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      try {
                        await settingsProv.downloadAndInstallUpdate();
                      } catch (e) {
                        if (mounted) {
                          AppNotification.show(context, tr(context, 'download_failed', args: {'error': e.toString()}), isError: true);
                        }
                      }
                    },
                    icon: const Icon(LucideIcons.download, size: 16),
                    label: Text(tr(context, 'download_and_install')),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.accentCyan,
                      foregroundColor: AppColors.brightness == Brightness.dark ? const Color(0xFF0A0F1D) : Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                  ),
                ),
            ],

            if (settingsProv.isDownloadingUpdate) ...[
              const SizedBox(height: 16),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LinearProgressIndicator(
                    value: settingsProv.downloadProgress >= 0 ? settingsProv.downloadProgress : null,
                    backgroundColor: AppColors.borderColor,
                    valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        settingsProv.downloadProgress >= 0
                            ? tr(context, 'downloading_update', args: {'progress': (settingsProv.downloadProgress * 100).toInt().toString()})
                            : tr(context, 'installing_update'),
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                      ),
                      if (settingsProv.downloadProgress >= 0)
                        Text(
                          '${(settingsProv.downloadProgress * 100).toInt()}%',
                          style: TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                    ],
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
