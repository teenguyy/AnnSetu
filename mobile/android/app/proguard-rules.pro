# Flutter + plugins ship their own consumer rules; keep notification receivers and Firebase models.
-keep class com.dexterous.** { *; }
-keep class io.flutter.plugins.firebase.** { *; }
-dontwarn com.google.android.play.core.**
