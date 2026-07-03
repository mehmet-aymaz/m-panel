import 'package:flutter/material.dart';

abstract class AppColorTheme {
  Brightness get brightness;

  Color get bgPrimary;
  Color get bgSecondary;
  Color get bgCard;
  Color get bgInput;
  
  Color get accentCyan;
  Color get accentPurple;
  Color get accentBlue;
  
  Color get textPrimary;
  Color get textSecondary;
  Color get textMuted;
  
  Color get success;
  Color get warning;
  Color get danger;
  
  Color get borderColor;
  Color get borderFocus;
}

class CyberpunkTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.dark;
  @override Color get bgPrimary => const Color(0xFF0B0F19);
  @override Color get bgSecondary => const Color(0xFF121826);
  @override Color get bgCard => const Color(0xFF131A26);
  @override Color get bgInput => const Color(0xFF111827);
  @override Color get accentCyan => const Color(0xFF06B6D4);
  @override Color get accentPurple => const Color(0xFF8B5CF6);
  @override Color get accentBlue => const Color(0xFF3B82F6);
  @override Color get textPrimary => const Color(0xFFF3F4F6);
  @override Color get textSecondary => const Color(0xFF9CA3AF);
  @override Color get textMuted => const Color(0xFF6B7280);
  @override Color get success => const Color(0xFF10B981);
  @override Color get warning => const Color(0xFFF59E0B);
  @override Color get danger => const Color(0xFFEF4444);
  @override Color get borderColor => const Color(0x14FFFFFF);
  @override Color get borderFocus => const Color(0x8006B6D4);
}

class DraculaTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.dark;
  @override Color get bgPrimary => const Color(0xFF1E1E2E);
  @override Color get bgSecondary => const Color(0xFF252538);
  @override Color get bgCard => const Color(0xFF2B2B3F);
  @override Color get bgInput => const Color(0xFF1A1A26);
  @override Color get accentCyan => const Color(0xFFBD93F9);
  @override Color get accentPurple => const Color(0xFFFF79C6);
  @override Color get accentBlue => const Color(0xFF8BE9FD);
  @override Color get textPrimary => const Color(0xFFF8F8F2);
  @override Color get textSecondary => const Color(0xFF6272A4);
  @override Color get textMuted => const Color(0xFF44475A);
  @override Color get success => const Color(0xFF50FA7B);
  @override Color get warning => const Color(0xFFF1FA8C);
  @override Color get danger => const Color(0xFFFF5555);
  @override Color get borderColor => const Color(0x1CFFFFFF);
  @override Color get borderFocus => const Color(0x80BD93F9);
}

class NordTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.dark;
  @override Color get bgPrimary => const Color(0xFF2E3440);
  @override Color get bgSecondary => const Color(0xFF3B4252);
  @override Color get bgCard => const Color(0xFF434C5E);
  @override Color get bgInput => const Color(0xFF242933);
  @override Color get accentCyan => const Color(0xFF88C0D0);
  @override Color get accentPurple => const Color(0xFFB48EAD);
  @override Color get accentBlue => const Color(0xFF81A1C1);
  @override Color get textPrimary => const Color(0xFFECEFF4);
  @override Color get textSecondary => const Color(0xFFD8DEE9);
  @override Color get textMuted => const Color(0xFF4C566A);
  @override Color get success => const Color(0xFFA3BE8C);
  @override Color get warning => const Color(0xFFEBCB8B);
  @override Color get danger => const Color(0xFFBF616A);
  @override Color get borderColor => const Color(0x18FFFFFF);
  @override Color get borderFocus => const Color(0x8088C0D0);
}

class EmeraldTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.dark;
  @override Color get bgPrimary => const Color(0xFF0F1713);
  @override Color get bgSecondary => const Color(0xFF14221B);
  @override Color get bgCard => const Color(0xFF1B2E24);
  @override Color get bgInput => const Color(0xFF0C1310);
  @override Color get accentCyan => const Color(0xFF10B981);
  @override Color get accentPurple => const Color(0xFF34D399);
  @override Color get accentBlue => const Color(0xFF60A5FA);
  @override Color get textPrimary => const Color(0xFFECFDF5);
  @override Color get textSecondary => const Color(0xFF94A3B8);
  @override Color get textMuted => const Color(0xFF64748B);
  @override Color get success => const Color(0xFF34D399);
  @override Color get warning => const Color(0xFFFBBF24);
  @override Color get danger => const Color(0xFFF87171);
  @override Color get borderColor => const Color(0x14FFFFFF);
  @override Color get borderFocus => const Color(0x8010B981);
}

class LightTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.light;
  @override Color get bgPrimary => const Color(0xFFF3F4F6);
  @override Color get bgSecondary => const Color(0xFFFFFFFF);
  @override Color get bgCard => const Color(0xFFFFFFFF);
  @override Color get bgInput => const Color(0xFFF9FAFB);
  @override Color get accentCyan => const Color(0xFF0891B2);
  @override Color get accentPurple => const Color(0xFF7C3AED);
  @override Color get accentBlue => const Color(0xFF2563EB);
  @override Color get textPrimary => const Color(0xFF111827);
  @override Color get textSecondary => const Color(0xFF4B5563);
  @override Color get textMuted => const Color(0xFF9CA3AF);
  @override Color get success => const Color(0xFF059669);
  @override Color get warning => const Color(0xFFD97706);
  @override Color get danger => const Color(0xFFDC2626);
  @override Color get borderColor => const Color(0xFFE5E7EB);
  @override Color get borderFocus => const Color(0x800891B2);
}

class DarkTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.dark;
  @override Color get bgPrimary => const Color(0xFF09090B);
  @override Color get bgSecondary => const Color(0xFF121214);
  @override Color get bgCard => const Color(0xFF18181B);
  @override Color get bgInput => const Color(0xFF09090B);
  @override Color get accentCyan => const Color(0xFF38BDF8);
  @override Color get accentPurple => const Color(0xFFC084FC);
  @override Color get accentBlue => const Color(0xFF60A5FA);
  @override Color get textPrimary => const Color(0xFFFAFAFA);
  @override Color get textSecondary => const Color(0xFFA1A1AA);
  @override Color get textMuted => const Color(0xFF52525B);
  @override Color get success => const Color(0xFF4ADE80);
  @override Color get warning => const Color(0xFFFBBF24);
  @override Color get danger => const Color(0xFFF87171);
  @override Color get borderColor => const Color(0xFF27272A);
  @override Color get borderFocus => const Color(0x8038BDF8);
}

class GoldTheme implements AppColorTheme {
  @override Brightness get brightness => Brightness.dark;
  @override Color get bgPrimary => const Color(0xFF12100E);
  @override Color get bgSecondary => const Color(0xFF1A1714);
  @override Color get bgCard => const Color(0xFF231F1B);
  @override Color get bgInput => const Color(0xFF12100E);
  @override Color get accentCyan => const Color(0xFFF59E0B);
  @override Color get accentPurple => const Color(0xFFD97706);
  @override Color get accentBlue => const Color(0xFFFBBF24);
  @override Color get textPrimary => const Color(0xFFFDFBF7);
  @override Color get textSecondary => const Color(0xFFB7A590);
  @override Color get textMuted => const Color(0xFF6E5F4F);
  @override Color get success => const Color(0xFF10B981);
  @override Color get warning => const Color(0xFFF59E0B);
  @override Color get danger => const Color(0xFFEF4444);
  @override Color get borderColor => const Color(0x26F59E0B);
  @override Color get borderFocus => const Color(0x80F59E0B);
}

class AppColors {
  static AppColorTheme _currentTheme = CyberpunkTheme();

  static void setTheme(AppColorTheme theme) {
    _currentTheme = theme;
  }

  static Brightness get brightness => _currentTheme.brightness;

  static Color get bgPrimary => _currentTheme.bgPrimary;
  static Color get bgSecondary => _currentTheme.bgSecondary;
  static Color get bgCard => _currentTheme.bgCard;
  static Color get bgInput => _currentTheme.bgInput;
  
  static Color get accentCyan => _currentTheme.accentCyan;
  static Color get accentPurple => _currentTheme.accentPurple;
  static Color get accentBlue => _currentTheme.accentBlue;
  
  static Color get textPrimary => _currentTheme.textPrimary;
  static Color get textSecondary => _currentTheme.textSecondary;
  static Color get textMuted => _currentTheme.textMuted;
  
  static Color get success => _currentTheme.success;
  static Color get warning => _currentTheme.warning;
  static Color get danger => _currentTheme.danger;
  
  static Color get borderColor => _currentTheme.borderColor;
  static Color get borderFocus => _currentTheme.borderFocus;
}

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: AppColors.brightness,
      scaffoldBackgroundColor: AppColors.bgPrimary,
      primaryColor: AppColors.accentCyan,
      colorScheme: ColorScheme(
        brightness: AppColors.brightness,
        primary: AppColors.accentCyan,
        onPrimary: AppColors.brightness == Brightness.dark ? const Color(0xFF0A0F1D) : Colors.white,
        secondary: AppColors.accentPurple,
        onSecondary: Colors.white,
        error: AppColors.danger,
        onError: Colors.white,
        surface: AppColors.bgCard,
        onSurface: AppColors.textPrimary,
      ),
      fontFamily: 'Inter',
      cardTheme: CardTheme(
        color: AppColors.bgCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: AppColors.borderColor, width: 1.5),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.bgInput,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 14),
        labelStyle: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.accentCyan),
        ),
      ),
      textButtonTheme: TextButtonThemeData(
        style: TextButton.styleFrom(
          foregroundColor: AppColors.accentCyan,
          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          elevation: 0,
          backgroundColor: AppColors.accentCyan,
          foregroundColor: AppColors.brightness == Brightness.dark ? const Color(0xFF0A0F1D) : Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
        ),
      ),
    );
  }
}
