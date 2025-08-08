// Basic analytics service abstraction. Uses Firebase Analytics if available.
// Falls back to console logs in dev or if analytics is not linked.

let firebaseAnalytics: any = null;
try {
  // Lazy require to avoid crashes if module not installed on iOS dev
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  // We check availability via @react-native-firebase/app
  const appModule = require('@react-native-firebase/app');
  if (appModule?.app) {
    firebaseAnalytics = require('@react-native-firebase/analytics').default;
  }
} catch (_) {
  firebaseAnalytics = null;
}

type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

class AnalyticsServiceImpl {
  private enabled = true;

  setEnabled(value: boolean) {
    this.enabled = value;
  }

  async logEvent(name: string, params?: AnalyticsEventParams) {
    if (!this.enabled) return;
    try {
      if (firebaseAnalytics) {
        await firebaseAnalytics().logEvent(name, params as any);
      } else {
        // Dev fallback
        console.log(`AnalyticsService: ${name}`, params || {});
      }
    } catch (e) {
      console.log('AnalyticsService: failed to log event', name, e);
    }
  }

  async setUserId(userId?: string) {
    try {
      if (firebaseAnalytics) {
        await firebaseAnalytics().setUserId(userId || null);
      }
    } catch (e) {
      console.log('AnalyticsService: setUserId failed', e);
    }
  }
}

export const analyticsService = new AnalyticsServiceImpl();

export const AnalyticsEvents = {
  ScanCompleted: 'scan_completed',
  ProcessingSuccess: 'processing_success',
  ProcessingFailure: 'processing_failure',
  CameraPermissionPrompt: 'camera_permission_prompt',
  CameraPermissionGranted: 'camera_permission_granted',
} as const;
