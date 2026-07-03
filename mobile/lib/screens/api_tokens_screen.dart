import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/api_token_provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';
import '../widgets/app_notification.dart';

class ApiTokensScreen extends StatefulWidget {
  const ApiTokensScreen({super.key});

  @override
  State<ApiTokensScreen> createState() => _ApiTokensScreenState();
}

class _ApiTokensScreenState extends State<ApiTokensScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fetchTokens();
    });
  }

  Future<void> _fetchTokens() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final apiTokenProvider = Provider.of<ApiTokenProvider>(context, listen: false);
    await apiTokenProvider.fetchTokens(auth.apiService);
  }

  String _getScopeLabel(String scope) {
    switch (scope) {
      case 'read_only':
        return 'Salt Okunur (Read Only)';
      case 'client_manage':
        return 'Kullanıcı Yönetimi (Client Manage)';
      case 'full_access':
        return 'Tam Yetki (Full Access)';
      default:
        return scope;
    }
  }

  Color _getScopeColor(String scope) {
    switch (scope) {
      case 'read_only':
        return AppColors.textSecondary;
      case 'client_manage':
        return AppColors.accentBlue;
      case 'full_access':
        return AppColors.accentPurple;
      default:
        return AppColors.accentCyan;
    }
  }

  void _showCreateTokenDialog() {
    final nameController = TextEditingController();
    String selectedScope = 'read_only';
    final formKey = GlobalKey<FormState>();
    bool isCreating = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return AlertDialog(
              backgroundColor: AppColors.bgCard,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: AppColors.borderColor),
              ),
              title: const Text('Yeni API Anahtarı Oluştur'),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Token Açıklaması / İsim', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary)),
                    const SizedBox(height: 6),
                    TextFormField(
                      controller: nameController,
                      decoration: const InputDecoration(
                        hintText: 'Örn: WHMCS Entegrasyonu',
                        prefixIcon: Icon(LucideIcons.tag, size: 16),
                      ),
                      validator: (val) {
                        if (val == null || val.trim().isEmpty) {
                          return 'İsim boş olamaz';
                        }
                        return null;
                      },
                      enabled: !isCreating,
                    ),
                    const SizedBox(height: 16),
                    Text('Yetki Kapsamı (Scope)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.textSecondary)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<String>(
                      value: selectedScope,
                      dropdownColor: AppColors.bgCard,
                      iconEnabledColor: AppColors.accentCyan,
                      style: TextStyle(color: AppColors.textPrimary, fontSize: 14, fontFamily: 'Inter'),
                      decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                      ),
                      items: [
                        DropdownMenuItem(value: 'read_only', child: Text('Salt Okunur (Read Only)', style: TextStyle(color: AppColors.textPrimary))),
                        DropdownMenuItem(value: 'client_manage', child: Text('Kullanıcı Yönetimi', style: TextStyle(color: AppColors.textPrimary))),
                        DropdownMenuItem(value: 'full_access', child: Text('Tam Yetki (Full Access)', style: TextStyle(color: AppColors.textPrimary))),
                      ],
                      onChanged: isCreating ? null : (val) {
                        if (val != null) {
                          setModalState(() {
                            selectedScope = val;
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: isCreating ? null : () => Navigator.pop(context),
                  child: Text('Vazgeç', style: TextStyle(color: AppColors.textSecondary)),
                ),
                TextButton(
                  onPressed: isCreating
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          setModalState(() {
                            isCreating = true;
                          });

                          final auth = Provider.of<AuthProvider>(context, listen: false);
                          final apiTokenProvider = Provider.of<ApiTokenProvider>(context, listen: false);

                          try {
                            final newToken = await apiTokenProvider.createToken(
                              auth.apiService,
                              nameController.text.trim(),
                              selectedScope,
                            );

                            if (context.mounted) {
                              Navigator.pop(context); // Close creation dialog
                              _showTokenCreatedSuccessDialog(newToken['token']);
                            }
                          } catch (e) {
                            if (context.mounted) {
                              AppNotification.show(context, 'Hata: ${e.toString()}', isError: true);
                              Navigator.pop(context);
                            }
                          }
                        },
                  child: isCreating
                      ? SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan)),
                        )
                      : Text('Oluştur', style: TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showTokenCreatedSuccessDialog(String rawToken) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: AppColors.borderColor),
          ),
          title: Row(
            children: [
              Icon(LucideIcons.checkCircle, color: AppColors.success, size: 24),
              const SizedBox(width: 8),
              const Text('Anahtar Oluşturuldu!'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lütfen bu API anahtarını güvenli bir yere kopyalayın. Güvenlik nedeniyle bu anahtar sadece bir kez gösterilecektir.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.4),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.bgInput,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.borderColor),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        rawToken,
                        style: TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: Icon(LucideIcons.copy, size: 18, color: AppColors.accentCyan),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: rawToken));
                        AppNotification.show(context, 'API anahtarı kopyalandı!');
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('Kapat', style: TextStyle(color: AppColors.accentCyan, fontWeight: FontWeight.bold)),
            ),
          ],
        );
      },
    );
  }

  Future<void> _deleteToken(int id, String name) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
            side: BorderSide(color: AppColors.borderColor),
          ),
          title: const Text('API Anahtarı Silinsin mi?'),
          content: Text('"$name" isimli API anahtarı kalıcı olarak silinecektir. Bu anahtarı kullanan entegrasyonlar artık sunucuya erişemeyecektir.'),
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
      if (!mounted) return;
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final apiTokenProvider = Provider.of<ApiTokenProvider>(context, listen: false);

      try {
        await apiTokenProvider.deleteToken(auth.apiService, id);
        if (mounted) {
          AppNotification.show(context, 'API anahtarı silindi.');
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
    Provider.of<ThemeProvider>(context);
    final provider = Provider.of<ApiTokenProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('API Anahtarları'),
        backgroundColor: AppColors.bgSecondary,
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _showCreateTokenDialog,
        backgroundColor: AppColors.accentCyan,
        foregroundColor: const Color(0xFF0A0F1D),
        child: const Icon(LucideIcons.plus),
      ),
      body: RefreshIndicator(
        onRefresh: _fetchTokens,
        color: AppColors.accentCyan,
        backgroundColor: AppColors.bgCard,
        child: _buildBody(provider),
      ),
    );
  }

  Widget _buildBody(ApiTokenProvider provider) {
    if (provider.isLoading && provider.tokens.isEmpty) {
      return Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(AppColors.accentCyan),
        ),
      );
    }

    if (provider.errorMessage != null && provider.tokens.isEmpty) {
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
                onPressed: _fetchTokens,
                icon: const Icon(LucideIcons.refreshCw, size: 16),
                label: const Text('Yeniden Dene'),
              ),
            ],
          ),
        ),
      );
    }

    if (provider.tokens.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.key, size: 48, color: AppColors.textMuted),
              const SizedBox(height: 16),
              Text(
                'API Anahtarı Bulunmuyor',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
              ),
              const SizedBox(height: 8),
              Text(
                'Üçüncü taraf entegrasyonlar için "+" butonuna basarak yeni bir API anahtarı ekleyebilirsiniz.',
                style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: provider.tokens.length,
      itemBuilder: (context, index) {
        final token = provider.tokens[index];
        final id = token['id'];
        final name = token['name'] ?? 'İsimsiz Anahtar';
        final maskedToken = token['token'] ?? '';
        final scope = token['scope'] ?? 'read_only';
        final createdAt = token['created_at'] ?? '';
        
        // Format ISO Date String
        String dateStr = createdAt;
        try {
          if (createdAt.contains('T')) {
            final dt = DateTime.parse(createdAt);
            dateStr = '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')}.${dt.year} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
          }
        } catch (_) {}

        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.bgCard.withOpacity(0.8),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Text(
                      name,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  IconButton(
                    icon: Icon(LucideIcons.trash2, color: AppColors.danger, size: 18),
                    onPressed: () => _deleteToken(id, name),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(LucideIcons.key, size: 14, color: AppColors.textMuted),
                  const SizedBox(width: 6),
                  Text(
                    maskedToken,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Divider(color: AppColors.borderColor, height: 1),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getScopeColor(scope).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _getScopeLabel(scope),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: _getScopeColor(scope),
                      ),
                    ),
                  ),
                  Text(
                    dateStr,
                    style: TextStyle(
                      fontSize: 10,
                      color: AppColors.textMuted,
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
