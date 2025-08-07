// NoteSpark AI - Authentication Service
// Firebase authentication operations with modern modular API

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

// Import Apple Authentication only on iOS
let appleAuth: any = null;
if (Platform.OS === 'ios') {
  try {
    appleAuth = require('@invertase/react-native-apple-authentication');
  } catch (error) {
    console.log('Apple Authentication not available');
  }
}

interface AuthResult {
  user: FirebaseAuthTypes.User;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {
    this.configureGoogleSignIn();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // OPTIMIZED: Enhanced retry mechanism with proper timeout handling
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    timeoutMs: number = 15000 // Auth operations need longer timeout
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`AuthService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Authentication timeout')), timeoutMs);
          // Store timeout ID for potential cleanup
          (timeoutPromise as any).timeoutId = timeoutId;
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`AuthService: ${operationName} succeeded on attempt ${attempt}`);
        
        // Clear timeout if operation completed successfully
        if ((timeoutPromise as any).timeoutId) {
          clearTimeout((timeoutPromise as any).timeoutId);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`AuthService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        // Don't retry for certain auth errors that won't change
        if (this.isNonRetryableError(lastError)) {
          console.log(`AuthService: Non-retryable error for ${operationName}, stopping retries`);
          break;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Progressive backoff for auth operations
        const delay = Math.min(1000 * attempt, 5000); // Max 5 seconds delay
        console.log(`AuthService: Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableCodes = [
      'auth/user-not-found',
      'auth/wrong-password',
      'auth/email-already-in-use',
      'auth/weak-password',
      'auth/invalid-email',
      'auth/user-disabled',
      'auth/invalid-credential',
      'auth/account-exists-with-different-credential'
    ];
    
    return nonRetryableCodes.some(code => error.message.includes(code));
  }

  // OPTIMIZED: Enhanced input validation
  private validateEmailPassword(email: string, password: string): void {
    if (!email || email.trim().length === 0) {
      throw new Error('Email address is required');
    }
    
    if (!password || password.trim().length === 0) {
      throw new Error('Password is required');
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Please enter a valid email address');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
  }

  // OPTIMIZED: Enhanced Google Sign-In configuration with better error handling
  private configureGoogleSignIn() {
    try {
      console.log('AuthService: Configuring Google Sign-In with enhanced settings');
      GoogleSignin.configure({
        webClientId: '421242097567-ob54ji0c1ipkeki4nc48b3t7q598frfk.apps.googleusercontent.com',
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
        // OPTIMIZED: Additional configuration for better reliability
        iosClientId: undefined, // Let it auto-detect from GoogleService-Info.plist
        scopes: ['email', 'profile'], // Explicitly request required scopes
      });
      console.log('AuthService: Google Sign-In configured successfully with enhanced settings');
    } catch (error) {
      console.error('AuthService: Error configuring Google Sign-In', error);
      // Don't throw here as it would prevent app startup
      console.warn('AuthService: Google Sign-In may not be available');
    }
  }

  /**
   * OPTIMIZED: Sign in with email and password with enhanced validation and retry logic
   */
  async signInWithEmailAndPassword(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('AuthService: SignIn attempt for:', email);
      
      // OPTIMIZED: Input validation before attempting authentication
      this.validateEmailPassword(email, password);
      
      const userCredential = await this.withRetry(async () => {
        return await auth().signInWithEmailAndPassword(email.trim(), password);
      }, 'signInWithEmailAndPassword');
      
      console.log('AuthService: SignIn successful for user:', userCredential.user.uid);
      
      // OPTIMIZED: Check if email is verified for better security
      if (!userCredential.user.emailVerified) {
        console.warn('AuthService: User email not verified:', email);
        // Don't throw error, but log the warning
      }
      
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: SignIn error for:', email, error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * OPTIMIZED: Create user account with enhanced validation and automatic email verification
   */
  async createUserWithEmailAndPassword(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('AuthService: SignUp attempt for:', email);
      
      // OPTIMIZED: Input validation before attempting registration
      this.validateEmailPassword(email, password);
      
      const userCredential = await this.withRetry(async () => {
        return await auth().createUserWithEmailAndPassword(email.trim(), password);
      }, 'createUserWithEmailAndPassword');
      
      console.log('AuthService: SignUp successful for user:', userCredential.user.uid);
      
      // OPTIMIZED: Automatically send email verification
      try {
        await this.withRetry(async () => {
          await userCredential.user.sendEmailVerification();
        }, 'sendEmailVerification');
        console.log('AuthService: Email verification sent to:', email);
      } catch (verificationError) {
        console.error('AuthService: Failed to send verification email:', verificationError);
        // Don't fail the registration if email verification fails
      }
      
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: SignUp error for:', email, error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * OPTIMIZED: Send password reset email with validation and retry logic
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      console.log('AuthService: Password reset attempt for:', email);
      
      // OPTIMIZED: Email validation before sending reset
      if (!email || email.trim().length === 0) {
        throw new Error('Email address is required');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Please enter a valid email address');
      }
      
      await this.withRetry(async () => {
        await auth().sendPasswordResetEmail(email.trim());
      }, 'sendPasswordResetEmail');
      
      console.log('AuthService: Password reset email sent successfully to:', email);
    } catch (error: any) {
      console.error('AuthService: Password reset error for:', email, error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Get current user using modern API
   */
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  /**
   * OPTIMIZED: Enhanced auth state listener with error recovery
   */
  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void): () => void {
    try {
      console.log('AuthService: Setting up enhanced auth state listener');
      
      // OPTIMIZED: Wrapper to handle callback errors
      const wrappedCallback = (user: FirebaseAuthTypes.User | null) => {
        try {
          console.log('AuthService: Auth state changed:', user ? `User ${user.uid}` : 'No user');
          callback(user);
        } catch (callbackError) {
          console.error('AuthService: Error in auth state callback:', callbackError);
          // Don't throw here to prevent breaking the auth flow
        }
      };
      
      const unsubscribe = auth().onAuthStateChanged(wrappedCallback);
      
      // OPTIMIZED: Return enhanced cleanup function
      return () => {
        try {
          unsubscribe();
          console.log('AuthService: Auth state listener cleaned up successfully');
        } catch (error) {
          console.error('AuthService: Error cleaning up auth listener:', error);
        }
      };
    } catch (error) {
      console.error('AuthService: Failed to set up auth listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }

  /**
   * OPTIMIZED: Update user profile with validation and retry logic
   */
  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // OPTIMIZED: Validate inputs
      if (updates.displayName !== undefined) {
        if (typeof updates.displayName !== 'string') {
          throw new Error('Display name must be a string');
        }
        if (updates.displayName.trim().length === 0) {
          throw new Error('Display name cannot be empty');
        }
        if (updates.displayName.length > 50) {
          throw new Error('Display name must be 50 characters or less');
        }
      }
      
      if (updates.photoURL !== undefined) {
        if (typeof updates.photoURL !== 'string') {
          throw new Error('Photo URL must be a string');
        }
        // Basic URL validation
        if (updates.photoURL.length > 0) {
          try {
            new URL(updates.photoURL);
          } catch {
            throw new Error('Invalid photo URL format');
          }
        }
      }
      
      await this.withRetry(async () => {
        await user.updateProfile(updates);
      }, 'updateUserProfile');
      
      console.log('AuthService: User profile updated successfully for:', user.uid);
    } catch (error: any) {
      console.error('AuthService: Profile update error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * OPTIMIZED: Update email with validation and retry logic
   */
  async updateEmail(newEmail: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // OPTIMIZED: Email validation
      if (!newEmail || newEmail.trim().length === 0) {
        throw new Error('New email address is required');
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail.trim())) {
        throw new Error('Please enter a valid email address');
      }
      
      if (newEmail.trim().toLowerCase() === user.email?.toLowerCase()) {
        throw new Error('New email must be different from current email');
      }
      
      await this.withRetry(async () => {
        await user.updateEmail(newEmail.trim());
      }, 'updateEmail');
      
      console.log('AuthService: User email updated successfully for:', user.uid);
      
      // OPTIMIZED: Send verification email for new address
      try {
        await this.withRetry(async () => {
          await user.sendEmailVerification();
        }, 'sendEmailVerification');
        console.log('AuthService: Verification email sent to new address:', newEmail);
      } catch (verificationError) {
        console.warn('AuthService: Could not send verification email:', verificationError);
        // Don't fail the email update if verification fails
      }
    } catch (error: any) {
      console.error('AuthService: Email update error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * OPTIMIZED: Update password with enhanced validation and retry logic
   */
  async updateUserPassword(newPassword: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // OPTIMIZED: Password validation
      if (!newPassword || newPassword.trim().length === 0) {
        throw new Error('New password is required');
      }
      
      if (newPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      if (newPassword.length > 128) {
        throw new Error('Password must be 128 characters or less');
      }
      
      // Check for basic password strength
      const hasUpperCase = /[A-Z]/.test(newPassword);
      const hasLowerCase = /[a-z]/.test(newPassword);
      const hasNumbers = /\d/.test(newPassword);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        console.warn('AuthService: Weak password detected - missing uppercase, lowercase, or numbers');
      }
      
      await this.withRetry(async () => {
        await user.updatePassword(newPassword);
      }, 'updateUserPassword');
      
      console.log('AuthService: User password updated successfully for:', user.uid);
    } catch (error: any) {
      console.error('AuthService: Password update error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Delete user account
   */
  async deleteAccount(): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      await user.delete();
      console.log('AuthService: User account deleted successfully');
    } catch (error: any) {
      console.error('AuthService: Account deletion error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Re-authenticate user (required for sensitive operations)
   */
  async reauthenticateWithEmailAndPassword(email: string, password: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      const credential = auth.EmailAuthProvider.credential(email, password);
      await user.reauthenticateWithCredential(credential);
      console.log('AuthService: User reauthenticated successfully');
    } catch (error: any) {
      console.error('AuthService: Reauthentication error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * OPTIMIZED: Enhanced Google Sign-In with comprehensive error handling and retry logic
   */
  async signInWithGoogle(): Promise<AuthResult> {
    try {
      console.log('AuthService: Starting enhanced Google Sign-In flow');
      
      // OPTIMIZED: Check Google Play Services availability with retry
      await this.withRetry(async () => {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }, 'checkPlayServices', 2, 8000);
      
      console.log('AuthService: Google Play Services available');
      
      // OPTIMIZED: Get user token with enhanced error handling
      const signInResult = await this.withRetry(async () => {
        return await GoogleSignin.signIn();
      }, 'googleSignIn', 2, 12000);
      
      const { idToken } = signInResult;
      
      if (!idToken) {
        throw new Error('Google Sign-In failed: No ID token received');
      }
      
      console.log('AuthService: Google ID Token received successfully');
      
      // OPTIMIZED: Create credential and sign in with retry
      const userCredential = await this.withRetry(async () => {
        const googleCredential = auth.GoogleAuthProvider.credential(idToken);
        return await auth().signInWithCredential(googleCredential);
      }, 'firebaseGoogleSignIn', 2, 10000);
      
      console.log('AuthService: Firebase sign-in with Google successful for user:', userCredential.user.uid);
      
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: Google Sign-In failed', error);
      
      // OPTIMIZED: Enhanced error handling with specific codes
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email address but different sign-in credentials. Try signing in with email/password or a different provider.');
      }
      
      if (error.code === 'DEVELOPER_ERROR' || error.code === '-5') {
        throw new Error('Google Sign-In configuration error. Please ensure the app is properly configured in Firebase Console with the correct SHA-1 fingerprint.');
      }
      
      if (error.code === '12501') { // User cancelled
        throw new Error('Google Sign-In was cancelled by the user.');
      }
      
      if (error.code === '7') { // Network error
        throw new Error('Network error during Google Sign-In. Please check your internet connection and try again.');
      }
      
      if (error.code === '10') { // Developer error
        throw new Error('Google Sign-In setup incomplete. The app needs to be registered in Google Cloud Console with the correct package name and SHA-1 certificate.');
      }
      
      throw new Error(`Google Sign-In failed: ${error.message || error.code || 'Unknown error'}`);
    }
  }

  /**
   * Sign in with Apple (iOS only)
   */
  async signInWithApple(): Promise<AuthResult> {
    try {
      if (Platform.OS !== 'ios') {
        throw new Error('Apple Sign-In is only available on iOS devices.');
      }

      if (!appleAuth) {
        throw new Error('Apple Authentication is not available.');
      }

      console.log('AuthService: Starting Apple Sign-In flow');

      // Start the sign-in request
      const appleAuthRequestResponse = await appleAuth.appleAuth.performRequest({
        requestedOperation: appleAuth.appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.appleAuth.Scope.EMAIL, appleAuth.appleAuth.Scope.FULL_NAME],
      });

      // Ensure Apple returned a user identityToken
      if (!appleAuthRequestResponse.identityToken) {
        throw new Error('Apple Sign-In failed - no identify token returned');
      }

      console.log('AuthService: Apple ID Token received');

      // Create a Firebase credential from the response
      const { identityToken, nonce } = appleAuthRequestResponse;
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);

      // Sign the user in with the credential
      const userCredential = await auth().signInWithCredential(appleCredential);
      console.log('AuthService: Firebase sign-in with Apple successful');

      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: Apple Sign-In failed', error);
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email address but different sign-in credentials.');
      }
      
      throw new Error(`Apple Sign-In failed: ${error.message}`);
    }
  }

  /**
   * OPTIMIZED: Enhanced sign out with comprehensive cleanup and retry logic
   */
  async signOut(): Promise<void> {
    try {
      console.log('AuthService: Starting enhanced SignOut process');
      
      // OPTIMIZED: Sign out from Google with retry if signed in
      try {
        const isGoogleSignedIn = await this.withRetry(async () => {
          return await GoogleSignin.isSignedIn();
        }, 'checkGoogleSignInStatus', 2, 5000);
        
        if (isGoogleSignedIn) {
          await this.withRetry(async () => {
            await GoogleSignin.signOut();
          }, 'googleSignOut', 2, 8000);
          console.log('AuthService: Google sign-out successful');
        }
      } catch (googleError) {
        console.warn('AuthService: Google sign-out failed, continuing with Firebase sign-out:', googleError);
        // Don't fail the entire sign-out process if Google sign-out fails
      }
      
      // OPTIMIZED: Sign out from Firebase with retry
      await this.withRetry(async () => {
        await auth().signOut();
      }, 'firebaseSignOut');
      
      console.log('AuthService: Firebase sign-out successful');
      
      // OPTIMIZED: Clear any cached user data
      try {
        await this.clearCachedUserData();
      } catch (clearError) {
        console.warn('AuthService: Failed to clear cached data:', clearError);
        // Don't fail sign-out if cache clearing fails
      }
      
    } catch (error: any) {
      console.error('AuthService: SignOut error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  // OPTIMIZED: Clear cached user data on sign out
  private async clearCachedUserData(): Promise<void> {
    // This can be extended to clear any app-specific cached data
    console.log('AuthService: Clearing cached user data');
    // Implementation can be added here for clearing AsyncStorage, Redux state, etc.
  }

  /**
   * OPTIMIZED: Enhanced error transformation with more comprehensive mapping
   */
  private transformFirebaseError(error: any): string {
    const errorCode = error.code;
    
    switch (errorCode) {
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password is too weak. Please choose a stronger password.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/user-disabled':
        return 'This account has been disabled. Please contact support.';
      case 'auth/too-many-requests':
        return 'Too many failed attempts. Please try again later.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your connection and try again.';
      case 'auth/requires-recent-login':
        return 'This operation requires recent authentication. Please sign in again.';
      case 'auth/invalid-credential':
        return 'Invalid credentials. Please check your email and password.';
      case 'auth/operation-not-allowed':
        return 'This sign-in method is not enabled. Please contact support.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with the same email but different sign-in method. Try signing in with a different provider.';
      case 'auth/credential-already-in-use':
        return 'This credential is already associated with another account.';
      case 'auth/email-change-needs-verification':
        return 'Email change requires verification. Please check your email.';
      case 'auth/invalid-verification-code':
        return 'Invalid verification code. Please try again.';
      case 'auth/invalid-verification-id':
        return 'Invalid verification ID. Please try again.';
      case 'auth/missing-verification-code':
        return 'Verification code is required.';
      case 'auth/session-expired':
        return 'Your session has expired. Please sign in again.';
      case 'auth/timeout':
      case 'Authentication timeout':
        return 'Authentication timed out. Please try again.';
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }

  // OPTIMIZED: Get comprehensive user information
  async getUserInfo(): Promise<{
    uid: string;
    email: string | null;
    displayName: string | null;
    photoURL: string | null;
    emailVerified: boolean;
    isAnonymous: boolean;
    metadata: {
      creationTime: string | null;
      lastSignInTime: string | null;
    };
    providerData: Array<{
      providerId: string;
      uid: string;
      displayName: string | null;
      email: string | null;
      phoneNumber: string | null;
      photoURL: string | null;
    }>;
  } | null> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        return null;
      }

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        emailVerified: user.emailVerified,
        isAnonymous: user.isAnonymous,
        metadata: {
          creationTime: user.metadata.creationTime || null,
          lastSignInTime: user.metadata.lastSignInTime || null,
        },
        providerData: user.providerData.map(provider => ({
          providerId: provider.providerId,
          uid: provider.uid,
          displayName: provider.displayName || null,
          email: provider.email || null,
          phoneNumber: provider.phoneNumber || null,
          photoURL: provider.photoURL || null,
        })),
      };
    } catch (error) {
      console.error('AuthService: Error getting user info:', error);
      return null;
    }
  }

  // OPTIMIZED: Send email verification with retry logic
  async sendEmailVerification(): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }

      if (user.emailVerified) {
        throw new Error('Email is already verified');
      }

      await this.withRetry(async () => {
        await user.sendEmailVerification();
      }, 'sendEmailVerification');

      console.log('AuthService: Email verification sent successfully to:', user.email);
    } catch (error: any) {
      console.error('AuthService: Send email verification error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  // OPTIMIZED: Check authentication status
  isAuthenticated(): boolean {
    const user = this.getCurrentUser();
    return user !== null;
  }

  // OPTIMIZED: Check if user email is verified
  isEmailVerified(): boolean {
    const user = this.getCurrentUser();
    return user ? user.emailVerified : false;
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
export default authService;
