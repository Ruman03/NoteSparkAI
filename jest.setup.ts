// Global Jest setup for NoteSparkAI
// Gate real network for Gemini by default and provide stable mock shapes

jest.mock('@google/generative-ai', () => {
  const mockGenerateContent = jest.fn(async (input?: any) => ({
    response: {
      text: () => (typeof input === 'string' ? 'Mocked content' : 'Mocked title')
    }
  }));
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn(() => ({ generateContent: mockGenerateContent }))
    }))
  };
});

// Ensure react-native-config keys are present for both providers under test
jest.mock('react-native-config', () => ({
  default: {
    GEMINI_API_KEY: 'test-gemini-api-key',
    OPENAI_API_KEY: 'test-api-key'
  }
}));

// Mock native haptics module to avoid TurboModule dependency in Jest
jest.mock('react-native-haptic-feedback', () => ({
  __esModule: true,
  default: {
    trigger: jest.fn(),
  },
}));

// Mock RNBootSplash to bypass native dependency during tests
jest.mock('react-native-bootsplash', () => ({
  __esModule: true,
  default: {
    hide: jest.fn().mockResolvedValue(undefined),
    show: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock Firebase Auth to avoid NativeEventEmitter requirements
jest.mock('@react-native-firebase/auth', () => {
  const mockUser = {
    uid: 'test-user',
    email: 'test@example.com',
    emailVerified: true,
    isAnonymous: false,
    metadata: { creationTime: null, lastSignInTime: null },
    providerData: [],
    updateProfile: jest.fn().mockResolvedValue(undefined),
    updateEmail: jest.fn().mockResolvedValue(undefined),
    updatePassword: jest.fn().mockResolvedValue(undefined),
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    reauthenticateWithCredential: jest.fn().mockResolvedValue(undefined),
  };

  const authInstance = {
    currentUser: null as any,
    onAuthStateChanged: jest.fn((cb: any) => {
      const t: any = setTimeout(() => cb(null), 0);
      t?.unref?.();
      return jest.fn();
    }),
    signInWithEmailAndPassword: jest.fn(async () => ({ user: { ...mockUser } })),
    createUserWithEmailAndPassword: jest.fn(async () => ({ user: { ...mockUser, emailVerified: false } })),
    sendPasswordResetEmail: jest.fn(async () => {}),
    signInWithCredential: jest.fn(async () => ({ user: { ...mockUser } })),
    signOut: jest.fn(async () => {}),
    EmailAuthProvider: { credential: jest.fn(() => ({})) },
    GoogleAuthProvider: { credential: jest.fn(() => ({})) },
    AppleAuthProvider: { credential: jest.fn(() => ({})) },
  };

  return {
    __esModule: true,
    default: () => authInstance,
    FirebaseAuthTypes: {},
  };
});

// Mock Google Sign-In
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({ idToken: 'test-token' }),
    isSignedIn: jest.fn().mockResolvedValue(false),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

// Force Platform to android to skip Apple Auth code path in tests
try {
  const rn = require('react-native');
  Object.defineProperty(rn.Platform, 'OS', { get: () => 'android' });
} catch {}

// Mock AsyncStorage for Jest environment
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// Mock Vision Camera to bypass native module requirements
jest.mock('react-native-vision-camera', () => {
  const React = require('react');
  const Camera = React.forwardRef(() => null);
  return {
    __esModule: true,
    Camera,
    useCameraDevice: () => ({ neutralZoom: 1, minZoom: 1, maxZoom: 10, hasFlash: false, supportsFocus: false }),
    useCameraPermission: () => ({ hasPermission: false, requestPermission: jest.fn(async () => true) }),
  };
});

// Mock safe area context to simple components
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const Actual = jest.requireActual('react-native-safe-area-context');
  return {
    ...Actual,
    SafeAreaProvider: ({ children }: any) => React.createElement('SafeAreaProvider', null, children),
    SafeAreaView: ({ children }: any) => React.createElement('SafeAreaView', null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
