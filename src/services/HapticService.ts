// NoteSpark AI - Haptic Feedback Service
// Centralized haptic feedback for premium user interactions

import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Platform } from 'react-native';
import { HAPTIC_TYPES, FEATURE_FLAGS } from '../constants/app';

export class HapticService {
  private static instance: HapticService;
  private isEnabled: boolean = FEATURE_FLAGS.HAPTIC_FEEDBACK_ENABLED;

  private constructor() {}

  static getInstance(): HapticService {
    if (!HapticService.instance) {
      HapticService.instance = new HapticService();
    }
    return HapticService.instance;
  }

  // Enable or disable haptic feedback
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  // Trigger haptic feedback with fallback for unsupported platforms
  private trigger(type: any): void {
    if (!this.isEnabled) return;

    // Only trigger on supported platforms
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const options = {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      };

      ReactNativeHapticFeedback.trigger(type as any, options);
    }
  }

  // Light impact - for subtle interactions
  light(): void {
    this.trigger(HAPTIC_TYPES.LIGHT);
  }

  // Medium impact - for standard button presses
  medium(): void {
    this.trigger(HAPTIC_TYPES.MEDIUM);
  }

  // Heavy impact - for important actions
  heavy(): void {
    this.trigger(HAPTIC_TYPES.HEAVY);
  }

  // Selection feedback - for picker/selector changes
  selection(): void {
    this.trigger(HAPTIC_TYPES.SELECTION);
  }

  // Success feedback - for completed actions
  success(): void {
    this.trigger(HAPTIC_TYPES.SUCCESS);
  }

  // Warning feedback - for caution scenarios
  warning(): void {
    this.trigger(HAPTIC_TYPES.WARNING);
  }

  // Error feedback - for error states
  error(): void {
    this.trigger(HAPTIC_TYPES.ERROR);
  }

  // Convenience methods for common UI interactions
  buttonPress(): void {
    this.medium();
  }

  tabPress(): void {
    this.light();
  }

  deleteAction(): void {
    this.heavy();
  }

  saveAction(): void {
    this.success();
  }

  scanComplete(): void {
    this.success();
  }

  aiProcessingComplete(): void {
    this.success();
  }

  navigationTransition(): void {
    this.light();
  }

  swipeAction(): void {
    this.selection();
  }

  longPress(): void {
    this.medium();
  }

  pullToRefresh(): void {
    this.light();
  }

  errorOccurred(): void {
    this.error();
  }

  warningAction(): void {
    this.warning();
  }
}

// Export singleton instance
export const hapticService = HapticService.getInstance();

// Export individual methods for easier imports
export const {
  light,
  medium,
  heavy,
  selection,
  success,
  warning,
  error,
  buttonPress,
  tabPress,
  deleteAction,
  saveAction,
  scanComplete,
  aiProcessingComplete,
  navigationTransition,
  swipeAction,
  longPress,
  pullToRefresh,
  errorOccurred,
  warningAction,
} = hapticService;
