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

  private configureGoogleSignIn() {
    try {
      console.log('AuthService: Configuring Google Sign-In');
      GoogleSignin.configure({
        webClientId: '421242097567-ob54ji0c1ipkeki4nc48b3t7q598frfk.apps.googleusercontent.com',
        offlineAccess: true,
        hostedDomain: '',
        forceCodeForRefreshToken: true,
      });
      console.log('AuthService: Google Sign-In configured successfully');
    } catch (error) {
      console.error('AuthService: Error configuring Google Sign-In', error);
    }
  }

  /**
   * Sign in with email and password using modern API
   */
  async signInWithEmailAndPassword(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('AuthService: SignIn attempt for:', email);
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      console.log('AuthService: SignIn successful');
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: SignIn error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Create new user account using modern API
   */
  async createUserWithEmailAndPassword(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('AuthService: SignUp attempt for:', email);
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      console.log('AuthService: SignUp successful');
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: SignUp error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Send password reset email using modern API
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      console.log('AuthService: Password reset attempt for:', email);
      await auth().sendPasswordResetEmail(email);
      console.log('AuthService: Password reset email sent');
    } catch (error: any) {
      console.error('AuthService: Password reset error:', error);
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
   * Set up auth state change listener using modern modular API
   * This is the critical method that was causing the error
   */
  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void): () => void {
    try {
      console.log('AuthService: Setting up modern auth state listener');
      // Use the modern modular API to avoid deprecation warnings
      return auth().onAuthStateChanged(callback);
    } catch (error) {
      console.error('AuthService: Failed to set up auth listener:', error);
      return () => {}; // Return empty cleanup function
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      await user.updateProfile(updates);
      console.log('AuthService: User profile updated successfully');
    } catch (error: any) {
      console.error('AuthService: Profile update error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Update user's email address
   */
  async updateEmail(newEmail: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      await user.updateEmail(newEmail);
      console.log('AuthService: User email updated successfully');
    } catch (error: any) {
      console.error('AuthService: Email update error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Update user's password
   */
  async updateUserPassword(newPassword: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      await user.updatePassword(newPassword);
      console.log('AuthService: User password updated successfully');
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
   * Sign in with Google
   */
  async signInWithGoogle(): Promise<AuthResult> {
    try {
      console.log('AuthService: Starting Google Sign-In flow');
      
      // Check if device has Google Play Services
      await GoogleSignin.hasPlayServices();
      
      // Get the user's ID token
      const { idToken } = await GoogleSignin.signIn();
      console.log('AuthService: Google ID Token received');
      
      // Create a Google credential with the token
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      
      // Sign-in the user with the credential
      const userCredential = await auth().signInWithCredential(googleCredential);
      console.log('AuthService: Firebase sign-in with Google successful');
      
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: Google Sign-In failed', error);
      
      if (error.code === 'auth/account-exists-with-different-credential') {
        throw new Error('An account already exists with the same email address but different sign-in credentials.');
      }
      
      if (error.code === 'DEVELOPER_ERROR') {
        throw new Error('Google Sign-In configuration error. Please ensure the app is properly configured in Firebase Console with the correct SHA-1 fingerprint.');
      }
      
      if (error.code === '-5') { // DEVELOPER_ERROR code
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
   * Enhanced sign out with social providers
   */
  async signOut(): Promise<void> {
    try {
      console.log('AuthService: SignOut attempt');
      
      // Sign out from Google if signed in
      const isGoogleSignedIn = await GoogleSignin.isSignedIn();
      if (isGoogleSignedIn) {
        await GoogleSignin.signOut();
        console.log('AuthService: Google sign-out successful');
      }
      
      // Sign out from Firebase
      await auth().signOut();
      console.log('AuthService: Firebase sign-out successful');
    } catch (error: any) {
      console.error('AuthService: SignOut error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Transform Firebase error codes to user-friendly messages
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
      default:
        return error.message || 'An unexpected error occurred. Please try again.';
    }
  }
}

// Export singleton instance
export const authService = AuthService.getInstance();
export default authService;
