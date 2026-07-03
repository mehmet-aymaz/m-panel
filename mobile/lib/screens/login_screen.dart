import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../providers/auth_provider.dart';
import '../providers/theme_provider.dart';
import '../providers/language_provider.dart';
import '../constants/theme.dart';
import '../constants/translations.dart';
import '../services/storage_service.dart';
import '../widgets/blinking_dot.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _otpFormKey = GlobalKey<FormState>();
  
  final _serverUrlController = TextEditingController();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _otpController = TextEditingController();
  
  final _storageService = StorageService();
  String? _errorMessage;
  bool _obscurePassword = true;
  bool _rememberMe = false;
  bool _showServerInput = false;

  @override
  void initState() {
    super.initState();
    // Initialize server url from provider if already set
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      if (auth.serverUrl.isNotEmpty) {
        _serverUrlController.text = auth.serverUrl;
        if (mounted) {
          setState(() {
            _showServerInput = false;
          });
        }
      } else {
        _serverUrlController.text = 'https://panel.mehmetaymaz.com.tr:8443';
        if (mounted) {
          setState(() {
            _showServerInput = true;
          });
        }
      }
      
      // Load Remember Me options
      final isRemembered = await _storageService.getRememberMe();
      if (isRemembered) {
        final savedUser = await _storageService.getSavedUsername();
        final savedPass = await _storageService.getSavedPassword();
        if (mounted) {
          setState(() {
            _rememberMe = true;
            if (savedUser != null) _usernameController.text = savedUser;
            if (savedPass != null) _passwordController.text = savedPass;
          });
        }
      }
    });
  }

  @override
  void dispose() {
    _serverUrlController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() {
      _errorMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.login(
        _serverUrlController.text.trim(),
        _usernameController.text.trim(),
        _passwordController.text.trim(),
      );
      
      if (_rememberMe) {
        await _storageService.saveRememberMe(true);
        await _storageService.saveSavedUsername(_usernameController.text.trim());
        await _storageService.saveSavedPassword(_passwordController.text);
      } else {
        await _storageService.saveRememberMe(false);
        await _storageService.deleteSavedUsername();
        await _storageService.deleteSavedPassword();
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  Future<void> _handleVerifyOTP() async {
    if (!_otpFormKey.currentState!.validate()) return;
    
    setState(() {
      _errorMessage = null;
    });

    final auth = Provider.of<AuthProvider>(context, listen: false);
    try {
      await auth.verifyOTP(_otpController.text.trim());
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    final auth = Provider.of<AuthProvider>(context);

    return Scaffold(
      body: GestureDetector(
        onTap: () => FocusManager.instance.primaryFocus?.unfocus(),
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: double.infinity,
          height: double.infinity,
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: const Alignment(0, 0),
              radius: 1.2,
              colors: [
                AppColors.bgSecondary,
                AppColors.bgPrimary,
              ],
            ),
          ),
        child: SafeArea(
          child: Stack(
            children: [
              Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(24.0, 60.0, 24.0, 24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                  // App Brand Logo/Icon
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [AppColors.accentCyan, AppColors.accentPurple],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(18),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.accentCyan.withOpacity(0.3),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: const Center(
                      child: Text(
                        'M',
                        style: TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.w900,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  
                  // App title
                  Text(
                    'M-Panel Mobile',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    auth.requires2FA 
                        ? tr(context, 'two_factor_instructions')
                        : tr(context, 'login_subtitle'),
                    style: TextStyle(
                      fontSize: 14,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 36),

                  // Error Banner
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

                  // Form Container (Glassmorphism look card)
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: AppColors.bgCard.withOpacity(0.8),
                      border: Border.all(color: AppColors.borderColor, width: 1.5),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 30,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: auth.requires2FA 
                        ? _build2FAForm(auth) 
                        : _buildLoginForm(auth),
                  ),
                ],
              ),
            ),
          ),
          Positioned(
            top: 16,
            right: 16,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _buildLanguageSelector(context),
                const SizedBox(width: 8),
                _buildThemeSelector(context),
              ],
            ),
          ),
        ],
      ),
    ),
  ),
),
);
  }

  // 1. Regular Login Form
  Widget _buildLoginForm(AuthProvider auth) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Dynamic Server Input / Pill Badge
          AnimatedCrossFade(
            duration: const Duration(milliseconds: 300),
            firstCurve: Curves.easeInOut,
            secondCurve: Curves.easeInOut,
            crossFadeState: _showServerInput 
                ? CrossFadeState.showSecond 
                : CrossFadeState.showFirst,
            firstChild: _buildCompactServerBadge(),
            secondChild: _buildExpandedServerInput(),
          ),
          const SizedBox(height: 16),

          // Username Input
          Text(
            tr(context, 'username'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _usernameController,
            decoration: const InputDecoration(
              hintText: 'Yönetici e-postası veya adı',
              prefixIcon: Icon(LucideIcons.user, size: 18),
            ),
            validator: (value) {
              if (value == null || value.trim().isEmpty) {
                return tr(context, 'username_required');
              }
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Password Input
          Text(
            tr(context, 'password'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              hintText: 'Şifreniz',
              prefixIcon: const Icon(LucideIcons.lock, size: 18),
              suffixIcon: IconButton(
                icon: Icon(
                  _obscurePassword ? LucideIcons.eyeOff : LucideIcons.eye,
                  size: 18,
                  color: AppColors.textSecondary,
                ),
                onPressed: () {
                  setState(() {
                    _obscurePassword = !_obscurePassword;
                  });
                },
              ),
            ),
            validator: (value) {
              if (value == null || value.isEmpty) {
                return tr(context, 'password_required');
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          
          // Remember Me Checkbox Row
          Row(
            children: [
              SizedBox(
                width: 24,
                height: 24,
                child: Checkbox(
                  value: _rememberMe,
                  activeColor: AppColors.accentCyan,
                  checkColor: const Color(0xFF0A0F1D),
                  side: BorderSide(color: AppColors.textMuted, width: 1.5),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                  onChanged: (val) {
                    setState(() {
                      _rememberMe = val ?? false;
                    });
                  },
                ),
              ),
              const SizedBox(width: 10),
              GestureDetector(
                onTap: () {
                  setState(() {
                    _rememberMe = !_rememberMe;
                  });
                },
                child: Text(
                  'Beni Hatırla',
                  style: TextStyle(
                    fontSize: 13,
                    color: AppColors.textSecondary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),

          // Submit button
          ElevatedButton(
            onPressed: auth.isLoading ? null : _handleLogin,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentCyan,
              shadowColor: AppColors.accentCyan.withOpacity(0.3),
              elevation: 8,
            ),
            child: auth.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0A0F1D)),
                    ),
                  )
                : Text(tr(context, 'login_btn')),
          ),
        ],
      ),
    );
  }

  // 2. 2FA Form
  Widget _build2FAForm(AuthProvider auth) {
    return Form(
      key: _otpFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            tr(context, 'verification_code'),
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          TextFormField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              letterSpacing: 8,
            ),
            textAlign: TextAlign.center,
            decoration: InputDecoration(
              hintText: '000000',
              hintStyle: TextStyle(letterSpacing: 4, color: AppColors.textMuted),
              prefixIcon: Icon(LucideIcons.shieldAlert, size: 18),
              counterText: '',
            ),
            validator: (value) {
              if (value == null || value.trim().length != 6) {
                return tr(context, 'enter_6_digit');
              }
              return null;
            },
          ),
          const SizedBox(height: 24),

          // Verify Button
          ElevatedButton(
            onPressed: auth.isLoading ? null : _handleVerifyOTP,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentPurple,
              shadowColor: AppColors.accentPurple.withOpacity(0.3),
              elevation: 8,
              foregroundColor: Colors.white,
            ),
            child: auth.isLoading
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  )
                : Text(tr(context, 'verify_code_btn')),
          ),
          const SizedBox(height: 12),

          // Cancel 2FA Button
          TextButton(
            onPressed: auth.isLoading ? null : () {
              auth.cancel2FA();
              _otpController.clear();
              setState(() {
                _errorMessage = null;
              });
            },
            child: Text(
              tr(context, 'cancel_go_back'),
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ],
      ),
    );
  }

  // Helper widget for compact server connection badge
  Widget _buildCompactServerBadge() {
    final displayUrl = _serverUrlController.text
        .replaceFirst(RegExp(r'https?://'), '')
        .trim();
    
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(bottom: 8.0),
        child: InkWell(
          onTap: () {
            setState(() {
              _showServerInput = true;
            });
          },
          borderRadius: BorderRadius.circular(30),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.accentCyan.withOpacity(0.06),
              borderRadius: BorderRadius.circular(30),
              border: Border.all(
                color: AppColors.accentCyan.withOpacity(0.2),
                width: 1.2,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.accentCyan.withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                BlinkingDot(
                  color: AppColors.success,
                  size: 7.0,
                ),
                const SizedBox(width: 8),
                Flexible(
                  child: Text(
                    displayUrl.isEmpty ? 'Sunucu Adresi Girilmedi' : displayUrl,
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textPrimary.withOpacity(0.9),
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  LucideIcons.edit3,
                  color: AppColors.accentCyan,
                  size: 12,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // Helper widget for expanded server URL input card
  Widget _buildExpandedServerInput() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.bgInput.withOpacity(0.5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.accentCyan.withOpacity(0.2),
          width: 1.2,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(LucideIcons.server, color: AppColors.accentCyan, size: 14),
              const SizedBox(width: 6),
              Text(
                tr(context, 'server_url'),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  letterSpacing: 0.3,
                ),
              ),
              const Spacer(),
              if (_serverUrlController.text.trim().isNotEmpty)
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 16),
                  color: AppColors.textMuted,
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(),
                  onPressed: () {
                    setState(() {
                      _showServerInput = false;
                    });
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: TextFormField(
                  controller: _serverUrlController,
                  keyboardType: TextInputType.url,
                  style: TextStyle(fontSize: 13, color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'https://panel.example.com:8443',
                    prefixIcon: Icon(LucideIcons.link2, size: 16, color: AppColors.accentCyan),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                    filled: true,
                    fillColor: AppColors.bgPrimary.withOpacity(0.5),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: AppColors.borderColor),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: AppColors.accentCyan, width: 1.5),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              InkWell(
                onTap: () async {
                  var val = _serverUrlController.text.trim();
                  if (val.isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(tr(context, 'server_url_required')),
                        backgroundColor: AppColors.danger,
                      ),
                    );
                    return;
                  }
                  
                  if (!val.startsWith('http://') && !val.startsWith('https://')) {
                    val = 'https://$val';
                  }
                  
                  final uri = Uri.tryParse(val);
                  if (uri == null || !uri.hasScheme || !uri.hasAuthority) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Geçerli bir URL girin'),
                        backgroundColor: Colors.redAccent,
                      ),
                    );
                    return;
                  }

                  _serverUrlController.text = val;

                  // Save immediately to local storage
                  await _storageService.saveServerUrl(val);

                  setState(() {
                    _showServerInput = false;
                  });
                },
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [AppColors.accentCyan, AppColors.accentCyan.withOpacity(0.8)],
                    ),
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.accentCyan.withOpacity(0.25),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(
                    LucideIcons.check,
                    color: AppColors.brightness == Brightness.dark ? const Color(0xFF0A0F1D) : Colors.white,
                    size: 16,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLanguageSelector(BuildContext context) {
    final languageProvider = Provider.of<LanguageProvider>(context);
    final currentLang = languageProvider.currentLanguage;
    
    return Listener(
      onPointerDown: (_) {
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Theme(
        data: Theme.of(context).copyWith(
          splashFactory: NoSplash.splashFactory,
          highlightColor: Colors.transparent,
          hoverColor: Colors.transparent,
          splashColor: Colors.transparent,
        ),
        child: PopupMenuButton<String>(
          initialValue: currentLang,
          icon: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              border: Border.all(color: AppColors.borderColor, width: 1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.globe, size: 13, color: AppColors.textSecondary),
                const SizedBox(width: 6),
                Text(
                  currentLang.toUpperCase(),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          offset: const Offset(0, 36),
          color: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
            side: BorderSide(color: AppColors.borderColor),
          ),
          onSelected: (String lang) {
            languageProvider.setLanguage(lang);
            FocusManager.instance.primaryFocus?.unfocus();
          },
          itemBuilder: (context) => [
            PopupMenuItem(
              value: 'tr',
              child: Text(tr(context, 'lang_tr'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'en',
              child: Text(tr(context, 'lang_en'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'de',
              child: Text(tr(context, 'lang_de'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildThemeSelector(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final currentTheme = themeProvider.currentTheme;
    
    String getThemeDisplayName(String themeKey) {
      switch (themeKey) {
        case 'cyberpunk': return tr(context, 'theme_cyberpunk');
        case 'dracula': return tr(context, 'theme_dracula');
        case 'nord': return tr(context, 'theme_nord');
        case 'emerald': return tr(context, 'theme_emerald');
        case 'light': return tr(context, 'theme_light');
        case 'dark': return tr(context, 'theme_dark');
        case 'gold': return tr(context, 'theme_gold');
        default: return 'Cyberpunk';
      }
    }
    
    return Listener(
      onPointerDown: (_) {
        FocusManager.instance.primaryFocus?.unfocus();
      },
      child: Theme(
        data: Theme.of(context).copyWith(
          splashFactory: NoSplash.splashFactory,
          highlightColor: Colors.transparent,
          hoverColor: Colors.transparent,
          splashColor: Colors.transparent,
        ),
        child: PopupMenuButton<String>(
          initialValue: currentTheme,
          icon: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              border: Border.all(color: AppColors.borderColor, width: 1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(LucideIcons.palette, size: 13, color: AppColors.accentCyan),
                const SizedBox(width: 6),
                Text(
                  getThemeDisplayName(currentTheme),
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
          offset: const Offset(0, 36),
          color: AppColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
            side: BorderSide(color: AppColors.borderColor),
          ),
          onSelected: (String theme) {
            themeProvider.setTheme(theme);
            FocusManager.instance.primaryFocus?.unfocus();
          },
          itemBuilder: (context) => [
            PopupMenuItem(
              value: 'cyberpunk',
              child: Text(tr(context, 'theme_cyberpunk'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'dracula',
              child: Text(tr(context, 'theme_dracula'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'nord',
              child: Text(tr(context, 'theme_nord'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'emerald',
              child: Text(tr(context, 'theme_emerald'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'light',
              child: Text(tr(context, 'theme_light'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'dark',
              child: Text(tr(context, 'theme_dark'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
            PopupMenuItem(
              value: 'gold',
              child: Text(tr(context, 'theme_gold'), style: TextStyle(color: AppColors.textPrimary, fontSize: 13)),
            ),
          ],
        ),
      ),
    );
  }
}
