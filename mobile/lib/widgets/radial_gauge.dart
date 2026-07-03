import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/theme_provider.dart';
import '../constants/theme.dart';

class RadialGauge extends StatelessWidget {
  final double value; // 0 to 100
  final Color color;
  final String label;
  final IconData icon;
  final String details;
  final String? subdetails;

  const RadialGauge({
    super.key,
    required this.value,
    required this.color,
    required this.label,
    required this.icon,
    required this.details,
    this.subdetails,
  });

  @override
  Widget build(BuildContext context) {
    Provider.of<ThemeProvider>(context);
    final cleanValue = value.clamp(0.0, 100.0);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.bgCard.withOpacity(0.8),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Circular progress meter
          SizedBox(
            width: 68,
            height: 68,
            child: Stack(
              children: [
                // Custom Paint for Neon glowing arc
                Positioned.fill(
                  child: CustomPaint(
                    painter: _GlowArcPainter(
                      progress: cleanValue / 100,
                      color: color,
                    ),
                  ),
                ),
                // Center Icon and value
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(icon, color: color, size: 16),
                      const SizedBox(height: 2),
                      Text(
                        '${cleanValue.round()}%',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          // Labels & Details
          Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),
          Text(
            details,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: AppColors.textSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (subdetails != null) ...[
            const SizedBox(height: 2),
            Text(
              subdetails!,
              style: TextStyle(
                fontSize: 10,
                color: AppColors.textMuted,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }
}

class _GlowArcPainter extends CustomPainter {
  final double progress;
  final Color color;

  _GlowArcPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = math.min(size.width, size.height) / 2 - 6;
    const strokeWidth = 6.0;

    // Background track paint
    final trackPaint = Paint()
      ..color = Colors.white.withOpacity(0.03)
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    // Drawing the background track circle
    canvas.drawCircle(center, radius, trackPaint);

    // Glow effect shadow paint (drawn underneath the active progress stroke)
    final shadowPaint = Paint()
      ..color = color.withOpacity(0.4)
      ..strokeWidth = strokeWidth + 4.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5.0);

    // Active progress arc paint
    final progressPaint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const startAngle = -math.pi / 2;
    final sweepAngle = 2 * math.pi * progress;

    if (progress > 0) {
      // Draw glow shadow
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweepAngle,
        false,
        shadowPaint,
      );
      // Draw primary progress arc
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        sweepAngle,
        false,
        progressPaint,
      );
    }
  }

  @override
  bool shouldRepaint(covariant _GlowArcPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.color != color;
  }
}
