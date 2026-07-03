import 'package:flutter/material.dart';
import '../constants/theme.dart';

class CustomSwitch extends StatefulWidget {
  final bool value;
  final ValueChanged<bool> onChanged;

  const CustomSwitch({
    super.key,
    required this.value,
    required this.onChanged,
  });

  @override
  State<CustomSwitch> createState() => _CustomSwitchState();
}

class _CustomSwitchState extends State<CustomSwitch> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  bool _isDragging = false;
  double _dragX = 0.0;
  bool? _localValue;

  // Dimensions
  final double _width = 52.0;
  final double _height = 28.0;
  final double _thumbSize = 20.0;
  final double _padding = 2.5;

  double get _maxThumbTravel => _width - _thumbSize - (_padding * 2) - 3.0; // adjust for border

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
    _localValue = widget.value;
    if (widget.value) {
      _controller.value = 1.0;
    }
  }

  @override
  void didUpdateWidget(CustomSwitch oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.value != oldWidget.value) {
      setState(() {
        _localValue = widget.value;
      });
      if (!_isDragging) {
        if (widget.value) {
          _controller.forward();
        } else {
          _controller.reverse();
        }
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    final newValue = !(_localValue ?? widget.value);
    setState(() {
      _localValue = newValue;
    });
    if (newValue) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
    widget.onChanged(newValue);
  }

  void _handleDragStart(DragStartDetails details) {
    setState(() {
      _isDragging = true;
      _dragX = (_localValue ?? widget.value) ? _maxThumbTravel : 0.0;
    });
  }

  void _handleDragUpdate(DragUpdateDetails details) {
    setState(() {
      _dragX = (_dragX + details.delta.dx).clamp(0.0, _maxThumbTravel);
      _controller.value = _dragX / _maxThumbTravel;
    });
  }

  void _handleDragEnd(DragEndDetails details) {
    setState(() {
      _isDragging = false;
    });
    
    final bool newValue = _controller.value > 0.5;
    setState(() {
      _localValue = newValue;
    });
    
    if (newValue) {
      _controller.forward();
    } else {
      _controller.reverse();
    }
    
    if (newValue != widget.value) {
      widget.onChanged(newValue);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      onHorizontalDragStart: _handleDragStart,
      onHorizontalDragUpdate: _handleDragUpdate,
      onHorizontalDragEnd: _handleDragEnd,
      behavior: HitTestBehavior.opaque,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final val = _controller.value;
          final trackColor = Color.lerp(
            AppColors.bgInput,
            AppColors.accentCyan.withOpacity(0.15),
            val,
          );
          final borderColor = Color.lerp(
            AppColors.borderColor,
            AppColors.accentCyan.withOpacity(0.4),
            val,
          );
          final thumbColor = Color.lerp(
            AppColors.textMuted,
            AppColors.accentCyan,
            val,
          );

          return Container(
            width: _width,
            height: _height,
            decoration: BoxDecoration(
              color: trackColor,
              borderRadius: BorderRadius.circular(_height / 2),
              border: Border.all(
                color: borderColor ?? AppColors.borderColor,
                width: 1.5,
              ),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  left: _padding + (val * _maxThumbTravel),
                  top: (_height - _thumbSize) / 2 - 1.5,
                  child: Container(
                    width: _thumbSize,
                    height: _thumbSize,
                    decoration: BoxDecoration(
                      color: thumbColor,
                      shape: BoxShape.circle,
                      boxShadow: val > 0.1
                          ? [
                              BoxShadow(
                                color: AppColors.accentCyan.withOpacity(0.3 * val),
                                blurRadius: 4,
                                spreadRadius: 1,
                              )
                            ]
                          : null,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
