// NoteSpark AI - Authentication Service
// Firebase authentication operations separated from context

import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';

interface AuthResult {
  user: FirebaseAuthTypes.User;
}

export class AuthService {
  private static instance: AuthService;

  private constructor() {}

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmailAndPassword(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('AuthService: SignIn attempt for:', email);
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      console.log('AuthService: SignIn successful');
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: SignIn error:', error);
      console.error('AuthService: Error code:', error.code);
      console.error('AuthService: Error message:', error.message);
      
      // Transform Firebase errors to user-friendly messages
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Create new user account
   */
  async createUserWithEmailAndPassword(email: string, password: string): Promise<AuthResult> {
    try {
      console.log('AuthService: SignUp attempt for:', email);
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      console.log('AuthService: SignUp successful');
      return { user: userCredential.user };
    } catch (error: any) {
      console.error('AuthService: SignUp error:', error);
      console.error('AuthService: Error code:', error.code);
      console.error('AuthService: Error message:', error.message);
      
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      console.log('AuthService: SignOut attempt');
      await auth().signOut();
      console.log('AuthService: SignOut successful');
    } catch (error: any) {
      console.error('AuthService: SignOut error:', error);
      const friendlyError = this.transformFirebaseError(error);
      throw new Error(friendlyError);
    }
  }

  /**
   * Send password reset email
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
   * Get current user
   */
  getCurrentUser(): FirebaseAuthTypes.User | null {
    return auth().currentUser;
  }

  /**
   * Set up auth state listener
   */
  onAuthStateChanged(callback: (user: FirebaseAuthTypes.User | null) => void): () => void {
    try {
      console.log('AuthService: Setting up auth state listener');
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
   * Update user email
   */
  async updateUserEmail(newEmail: string): Promise<void> {
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
   * Update user password
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
  async deleteUser(): Promise<void> {
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
