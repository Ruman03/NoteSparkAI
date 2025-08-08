# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }

# Reanimated v4
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Worklets / Worklets Core
-keep class com.shopify.reactnative.skia.** { *; }
-keep class com.worklets.core.** { *; }

# VisionCamera
-keep class com.mrousavy.camera.** { *; }
-keep class com.mrousavy.camera.frameprocessor.** { *; }
-keep class com.mrousavy.camera.types.** { *; }

# Firebase (auth, firestore, storage)
-keep class com.google.firebase.** { *; }
-keepclassmembers class * { @com.google.firebase.annotations.PublicApi *; }
-dontwarn com.google.firebase.**

# Google Play Services
-dontwarn com.google.android.gms.**

# Kotlin (reflect, coroutines)
-dontwarn kotlin.**
-dontwarn kotlinx.coroutines.**

# React Native Vector Icons (font loading)
-keep class com.oblador.vectoricons.** { *; }

# Okio/OkHttp warnings
-dontwarn okhttp3.**
-dontwarn okio.**

# Gson/JSON (if used transitively)
-dontwarn com.google.gson.**

# Keep annotations
-keepattributes *Annotation*

