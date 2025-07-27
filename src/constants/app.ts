// NoteSpark AI - Application Constants
// Centralized constants for consistent values across the app

// Firebase/Firestore Configuration
export const FIRESTORE_COLLECTIONS = {
  NOTES: 'notes',
  USERS: 'users',
  SETTINGS: 'settings',
  ANALYTICS: 'analytics',
} as const;

// AsyncStorage Keys
export const STORAGE_KEYS = {
  USER_PREFERENCES: 'user_preferences',
  OFFLINE_QUEUE: 'offline_queue',
  THEME_MODE: 'theme_mode',
  LAST_SYNC: 'last_sync',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  VIEW_MODE: 'view_mode',
  SORT_PREFERENCE: 'sort_preference',
} as const;

// API Configuration
export const API_CONFIG = {
  OPENAI_BASE_URL: 'https://api.openai.com/v1',
  GOOGLE_VISION_BASE_URL: 'https://vision.googleapis.com/v1',
  REQUEST_TIMEOUT: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

// Tone Options
export const TONE_OPTIONS = {
  PROFESSIONAL: 'professional',
  CASUAL: 'casual',
  SIMPLIFIED: 'simplified',
  ACADEMIC: 'academic',
  CREATIVE: 'creative',
  TECHNICAL: 'technical',
} as const;

export const TONE_LABELS = {
  [TONE_OPTIONS.PROFESSIONAL]: 'Professional',
  [TONE_OPTIONS.CASUAL]: 'Casual',
  [TONE_OPTIONS.SIMPLIFIED]: 'Simplified',
  [TONE_OPTIONS.ACADEMIC]: 'Academic',
  [TONE_OPTIONS.CREATIVE]: 'Creative',
  [TONE_OPTIONS.TECHNICAL]: 'Technical',
} as const;

export const TONE_ICONS = {
  [TONE_OPTIONS.PROFESSIONAL]: 'briefcase',
  [TONE_OPTIONS.CASUAL]: 'chat',
  [TONE_OPTIONS.SIMPLIFIED]: 'lightbulb',
  [TONE_OPTIONS.ACADEMIC]: 'school',
  [TONE_OPTIONS.CREATIVE]: 'palette',
  [TONE_OPTIONS.TECHNICAL]: 'code-tags',
} as const;

export const TONE_DESCRIPTIONS = {
  [TONE_OPTIONS.PROFESSIONAL]: 'Formal, structured notes with proper headings',
  [TONE_OPTIONS.CASUAL]: 'Friendly, conversational tone with personal touches',
  [TONE_OPTIONS.SIMPLIFIED]: 'Clear, concise summaries focusing on key points',
  [TONE_OPTIONS.ACADEMIC]: 'Scholarly tone with detailed analysis',
  [TONE_OPTIONS.CREATIVE]: 'Engaging, creative writing with vivid descriptions',
  [TONE_OPTIONS.TECHNICAL]: 'Precise, technical language with detailed explanations',
} as const;

// View Modes
export const VIEW_MODES = {
  LIST: 'list',
  GRID: 'grid',
} as const;

// Sort Options
export const SORT_OPTIONS = {
  DATE: 'date',
  TITLE: 'title',
  TONE: 'tone',
} as const;

// OCR Configuration
export const OCR_CONFIG = {
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
  MIN_CONFIDENCE: 0.7,
  SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'webp'],
  ML_KIT_TIMEOUT: 10000, // 10 seconds
  VISION_API_TIMEOUT: 15000, // 15 seconds
} as const;

// Editor Configuration
export const EDITOR_CONFIG = {
  AUTO_SAVE_INTERVAL: 3000, // 3 seconds
  MIN_TITLE_LENGTH: 1,
  MAX_TITLE_LENGTH: 100,
  MIN_CONTENT_LENGTH: 1,
  MAX_CONTENT_LENGTH: 50000,
  WORD_COUNT_UPDATE_INTERVAL: 500, // 0.5 seconds
} as const;

// Animation Configuration
export const ANIMATIONS = {
  FADE_IN_DURATION: 300,
  SLIDE_IN_DURATION: 250,
  BOUNCE_DURATION: 400,
  STAGGER_DELAY: 50,
} as const;

// Haptic Feedback Types
export const HAPTIC_TYPES = {
  LIGHT: 'impactLight',
  MEDIUM: 'impactMedium',
  HEAVY: 'impactHeavy',
  SUCCESS: 'notificationSuccess',
  WARNING: 'notificationWarning',
  ERROR: 'notificationError',
  SELECTION: 'selection',
} as const;

// Network Configuration
export const NETWORK_CONFIG = {
  RETRY_DELAY: 2000, // 2 seconds
  MAX_RETRIES: 5,
  OFFLINE_QUEUE_LIMIT: 50,
  CONNECTION_CHECK_INTERVAL: 5000, // 5 seconds
} as const;

// App Configuration
export const APP_CONFIG = {
  NAME: 'NoteSpark AI',
  VERSION: '1.0.0',
  BUILD_NUMBER: 1,
  SUPPORT_EMAIL: 'support@notespark.ai',
  PRIVACY_POLICY_URL: 'https://notespark.ai/privacy',
  TERMS_OF_SERVICE_URL: 'https://notespark.ai/terms',
  WEBSITE_URL: 'https://notespark.ai',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ANALYTICS_ENABLED: true,
  CRASH_REPORTING_ENABLED: true,
  OFFLINE_MODE_ENABLED: true,
  HAPTIC_FEEDBACK_ENABLED: true,
  BETA_FEATURES_ENABLED: false,
} as const;

// Validation Rules
export const VALIDATION = {
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PASSWORD_MIN_LENGTH: 8,
  NOTE_TITLE_MAX_LENGTH: 100,
  NOTE_CONTENT_MAX_LENGTH: 50000,
  TAG_MAX_LENGTH: 20,
  MAX_TAGS_PER_NOTE: 10,
} as const;

// Default Values
export const DEFAULTS = {
  TONE: TONE_OPTIONS.PROFESSIONAL,
  VIEW_MODE: VIEW_MODES.LIST,
  SORT_ORDER: SORT_OPTIONS.DATE,
  NOTES_PER_PAGE: 20,
  SEARCH_DEBOUNCE_MS: 300,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  AUTHENTICATION_ERROR: 'Authentication failed. Please sign in again.',
  PERMISSION_DENIED: 'Permission denied. Please check your permissions.',
  INVALID_INPUT: 'Invalid input. Please check your data.',
  SERVER_ERROR: 'Server error. Please try again later.',
  OCR_FAILED: 'Text recognition failed. Please try again.',
  AI_PROCESSING_FAILED: 'AI processing failed. Please try again.',
  SAVE_FAILED: 'Failed to save note. Please try again.',
  DELETE_FAILED: 'Failed to delete note. Please try again.',
  SYNC_FAILED: 'Sync failed. Changes will be saved locally.',
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  NOTE_SAVED: 'Note saved successfully!',
  NOTE_DELETED: 'Note deleted successfully!',
  SYNC_COMPLETED: 'All changes synced!',
  EXPORT_COMPLETED: 'Export completed successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  ACCOUNT_CREATED: 'Account created successfully!',
  PASSWORD_RESET: 'Password reset email sent!',
} as const;

// Type exports for better TypeScript support
export type ToneOption = typeof TONE_OPTIONS[keyof typeof TONE_OPTIONS];
export type ViewMode = typeof VIEW_MODES[keyof typeof VIEW_MODES];
export type SortOption = typeof SORT_OPTIONS[keyof typeof SORT_OPTIONS];
export type HapticType = typeof HAPTIC_TYPES[keyof typeof HAPTIC_TYPES];
