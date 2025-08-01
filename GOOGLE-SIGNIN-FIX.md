# 🚨 URGENT: Fix Google Sign-In DEVELOPER_ERROR

## Issue
Google Sign-In is failing with `DEVELOPER_ERROR` because your Firebase project doesn't have an Android OAuth client configured.

## Your SHA-1 Fingerprint
```
5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
```

## Step-by-Step Fix

### 1. Go to Firebase Console
- Visit: https://console.firebase.google.com
- Select project: `notespark-ai-152e5`

### 2. Add Android App Configuration
1. Go to **Project Settings** (gear icon)
2. Click **General** tab
3. Under "Your apps" section, find your Android app
4. Click on the Android app settings

### 3. Add SHA-1 Fingerprint
1. Scroll down to **SHA certificate fingerprints**
2. Click **Add fingerprint**
3. Paste this fingerprint: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
4. Click **Save**

### 4. Enable Google Sign-In
1. Go to **Authentication** in left sidebar
2. Click **Sign-in method** tab
3. Find **Google** and click on it
4. Toggle **Enable**
5. Set **Project support email** (use your email)
6. Click **Save**

### 5. Download Updated Configuration
1. Go back to **Project Settings > General**
2. In your Android app section, click **google-services.json**
3. Download the updated file
4. Replace the current `android/app/google-services.json` with the new one

### 6. Rebuild the App
```bash
cd "d:\Summers 2025\Vibe Coding\NoteSpark-AI-Clean\NoteSparkAI"
npx react-native run-android
```

## Verification
After completing these steps, your `google-services.json` should include an entry like:
```json
{
  "client_id": "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
  "client_type": 1
}
```
(client_type: 1 = Android, currently you only have client_type: 3 = Web)

## Alternative: Temporary Disable
If you want to focus on other features first, you can temporarily comment out the Google button in `AuthScreen.tsx`:

```tsx
// Temporarily disable Google Sign-In
{false && (
  <SocialButton
    icon="google"
    title="Google"
    onPress={handleGoogleSignIn}
    disabled={loading}
  />
)}
```

## Expected Result
Once configured properly:
- Google Sign-In will work smoothly
- Users can authenticate with their Google accounts
- The DEVELOPER_ERROR will be resolved
