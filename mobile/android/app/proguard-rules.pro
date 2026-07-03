# Flutter Proguard Rules
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.** { *; }
-keep class io.flutter.util.** { *; }
-keep class io.flutter.view.** { *; }
-keep class io.flutter.embedding.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep Flutter wrapper and engine internals
-keep class io.flutter.plugin.editing.** { *; }
-keep class io.flutter.plugin.common.** { *; }
-keep class io.flutter.plugin.platform.** { *; }

# Keep system classes
-keep class android.support.v4.** { *; }
-keep class androidx.** { *; }
-dontwarn androidx.**
-dontwarn android.support.**

# Ignore Google Play Core library warnings (referenced by Flutter engine but not used)
-dontwarn com.google.android.play.core.**
