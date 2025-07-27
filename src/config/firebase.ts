// NoteSpark AI - Firebase Configuration
// Clean, modern Firebase v10 setup with React Native Firebase

import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Firebase configuration (already handled by google-services.json and GoogleService-Info.plist)
// No need to initialize the app manually with React Native Firebase

// Authentication
export const AuthService = {
  // Get current user
  getCurrentUser: () => auth().currentUser,
  
  // Sign in with email and password
  signInWithEmailAndPassword: async (email: string, password: string) => {
    return await auth().signInWithEmailAndPassword(email, password);
  },
  
  // Create user with email and password
  createUserWithEmailAndPassword: async (email: string, password: string) => {
    return await auth().createUserWithEmailAndPassword(email, password);
  },
  
  // Sign out
  signOut: async () => {
    return await auth().signOut();
  },
  
  // Reset password
  sendPasswordResetEmail: async (email: string) => {
    return await auth().sendPasswordResetEmail(email);
  },
  
  // Auth state change listener
  onAuthStateChanged: (callback: (user: any) => void) => {
    return auth().onAuthStateChanged(callback);
  },
};

// Firestore Database
export const DatabaseService = {
  // Notes collection reference
  notesCollection: () => firestore().collection('notes'),
  
  // Users collection reference
  usersCollection: () => firestore().collection('users'),
  
  // Get user's notes
  getUserNotes: async (userId: string) => {
    const snapshot = await firestore()
      .collection('notes')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  },
  
  // Create a new note
  createNote: async (noteData: any) => {
    const docRef = await firestore().collection('notes').add({
      ...noteData,
      createdAt: firestore.FieldValue.serverTimestamp(),
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
    return docRef.id;
  },
  
  // Update a note
  updateNote: async (noteId: string, updates: any) => {
    await firestore().collection('notes').doc(noteId).update({
      ...updates,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    });
  },
  
  // Delete a note
  deleteNote: async (noteId: string) => {
    await firestore().collection('notes').doc(noteId).delete();
  },
  
  // Get a single note
  getNote: async (noteId: string) => {
    const doc = await firestore().collection('notes').doc(noteId).get();
    if (doc.exists()) {
      return { id: doc.id, ...doc.data() };
    }
    return null;
  },
  
  // Search notes
  searchNotes: async (userId: string, searchTerm: string) => {
    // Note: Firestore doesn't support full-text search natively
    // This is a basic implementation - for production, consider using Algolia or similar
    const snapshot = await firestore()
      .collection('notes')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .get();
    
    const allNotes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Client-side filtering for now
    return allNotes.filter((note: any) => 
      note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.plainText.toLowerCase().includes(searchTerm.toLowerCase())
    );
  },
  
  // Real-time listener for user's notes
  listenToUserNotes: (userId: string, callback: (notes: any[]) => void) => {
    return firestore()
      .collection('notes')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .onSnapshot(snapshot => {
        const notes = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        }));
        callback(notes);
      });
  },
};

// Storage Service
export const StorageService = {
  // Upload image
  uploadImage: async (imageUri: string, path: string) => {
    const reference = storage().ref(path);
    const task = reference.putFile(imageUri);
    
    await task;
    
    // Get download URL
    const downloadURL = await reference.getDownloadURL();
    return downloadURL;
  },
  
  // Delete image
  deleteImage: async (path: string) => {
    const reference = storage().ref(path);
    await reference.delete();
  },
  
  // Upload scanned document image
  uploadDocumentImage: async (imageUri: string, userId: string, noteId: string) => {
    const path = `documents/${userId}/${noteId}/original.jpg`;
    return await StorageService.uploadImage(imageUri, path);
  },
};

// Export Firestore instance for advanced queries
export { firestore };

// Export auth instance for advanced auth operations
export { auth };

// Export storage instance for advanced storage operations
export { storage };
