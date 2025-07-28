# Social Authentication Setup Guide

This guide explains how to set up Google and Apple sign-in for NoteSpark AI.

## 🚨 IMPORTANT: Current Google Sign-In Issue

You're getting a `DEVELOPER_ERROR` because Google Sign-In requires additional setup in the Firebase Console.

### Immediate Fix Required:

1. **Get SHA-1 Fingerprint**:
   ```bash
   cd android && ./gradlew signingReport
   ```
   Look for the `SHA1` fingerprint under `Variant: debug` and `Config: debug`

2. **Add Android App to Firebase**:
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Select your `notespark-ai-152e5` project
   - Go to Project Settings > General tab
   - Under "Your apps", find your Android app or add it if missing
   - Add the SHA-1 fingerprint you got from step 1
   - Download the updated `google-services.json` and replace the current one

3. **Alternative Quick Fix**:
   If the above doesn't work immediately, you can temporarily disable Google Sign-In in the UI and focus on email/password authentication.

## Google Sign-In Setup

### Android Configuration
1. **Firebase Console Setup**:
   - Ensure your Android app is registered with package name: `com.notespark.ai`
   - Add SHA-1 fingerprint from your debug keystore
   - Enable Google Sign-In in Authentication > Sign-in method

2. **Debug Keystore SHA-1**:
   ```bash
   # From the android directory
   ./gradlew signingReport
   
   # Or manually with keytool
   keytool -list -v -keystore app/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```

3. **Verify google-services.json**:
   - Should contain an `oauth_client` entry with `client_type: 1` (Android client)
   - Current file only has web client (type 3) which causes DEVELOPER_ERROR

### iOS Configuration
1. Add your iOS OAuth client ID to the `GoogleService-Info.plist` file
2. Add the URL scheme to `ios/NoteSparkAI/Info.plist`:
```xml
<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLName</key>
        <string>GoogleSignIn</string>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>YOUR_REVERSED_CLIENT_ID</string>
        </array>
    </dict>
</array>
```

## Apple Sign-In Setup

### iOS Configuration
1. Enable Apple Sign-In capability in Xcode:
   - Open `ios/NoteSparkAI.xcodeproj` in Xcode
   - Select your project target
   - Go to "Signing & Capabilities"
   - Click "+ Capability" and add "Sign In with Apple"

2. The Apple Sign-In is automatically handled by Firebase Auth on iOS

### Android Configuration
Apple Sign-In on Android uses web-based authentication through Firebase, which is already configured.

## Testing

1. **Google Sign-In**: Currently failing due to missing Android OAuth client
2. **Apple Sign-In**: Works on iOS devices and simulators, shows appropriate error message on Android
3. **Email/Password**: Fully functional

## Error Handling

The implementation includes comprehensive error handling:
- Network connectivity issues
- Account conflicts (same email, different provider)
- Platform-specific errors
- User-friendly error messages

## Temporary Workaround

If you want to temporarily disable Google Sign-In while setting up the Firebase configuration:

1. Comment out the Google button in AuthScreen.tsx
2. Or add a conditional check to hide it during development

## Security Notes

- All authentication flows use Firebase Auth for security
- OAuth tokens are handled securely by Firebase
- No sensitive credentials are stored locally

## Next Steps

1. **Priority 1**: Fix Google Sign-In configuration in Firebase Console
2. **Priority 2**: Test on physical device after configuration
3. **Priority 3**: Set up iOS configuration for Apple Sign-In
