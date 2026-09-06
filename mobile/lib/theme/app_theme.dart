import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color primaryDark = Color(0xFF070B14);
  static const Color surfaceDark = Color(0xFF0D1527);
  static const Color cardDark = Color(0xFF121C30);
  static const Color accentBlue = Color(0xFF38BDF8);
  static const Color accentRed = Color(0xFFEF4444);
  static const Color accentGreen = Color(0xFF10B981);

  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: primaryDark,
      primaryColor: accentBlue,
      cardColor: cardDark,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.dark().textTheme),
      colorScheme: const ColorScheme.dark(
        primary: accentBlue,
        secondary: accentGreen,
        surface: surfaceDark,
        error: accentRed,
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: const Color(0xFFF1F5F9),
      primaryColor: const Color(0xFF0284C7),
      cardColor: Colors.white,
      textTheme: GoogleFonts.plusJakartaSansTextTheme(ThemeData.light().textTheme),
      colorScheme: const ColorScheme.light(
        primary: Color(0xFF0284C7),
        secondary: accentGreen,
        surface: Colors.white,
        error: accentRed,
      ),
    );
  }
}
