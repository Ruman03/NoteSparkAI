// NoteSpark AI - Notes Management Service
// Firebase Firestore integration for note CRUD operations

import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  updateDoc, 
  getDoc, 
  deleteDoc 
} from '@react-native-firebase/firestore';
import type { Note } from '../types';

interface CreateNoteRequest {
  title: string;
  content: string;
  plainText: string;
  tone: 'professional' | 'casual' | 'simplified';
  originalText: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  sourceImageUrl?: string;
}

export class NotesService {
  private static instance: NotesService;
  private readonly collection = 'notes';

  private constructor() {}

  static getInstance(): NotesService {
    if (!NotesService.instance) {
      NotesService.instance = new NotesService();
    }
    return NotesService.instance;
  }

  async saveNote(userId: string, noteData: CreateNoteRequest): Promise<string> {
    try {
      console.log('NotesService: Starting saveNote operation for user:', userId);
      
      const db = getFirestore();
      const noteRef = doc(collection(db, this.collection));
      console.log('NotesService: Note reference created with ID:', noteRef.id);
      
      const note: Omit<Note, 'id'> = {
        ...noteData,
        userId,
        wordCount: noteData.plainText.split(' ').length,
        isStarred: false,
      };

      console.log('NotesService: Note object prepared:', {
        title: note.title,
        userId: note.userId,
        wordCount: note.wordCount,
        contentLength: note.content.length
      });

      // Add timeout and retry logic
      await this.withRetry(async () => {
        await setDoc(noteRef, note);
      }, 'saveNote');
      
      console.log('NotesService: Note saved successfully with ID:', noteRef.id);
      return noteRef.id;
    } catch (error) {
      console.error('NotesService: Error saving note:', error);
      console.error('NotesService: Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  // Retry helper function
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    timeoutMs: number = 10000
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`NotesService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)
        );
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`NotesService: ${operationName} succeeded on attempt ${attempt}`);
        return result;
      } catch (error) {
        console.error(`NotesService: ${operationName} failed on attempt ${attempt}:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`NotesService: Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}`);
  }

  async getUserNotes(userId: string): Promise<Note[]> {
    try {
      console.log('NotesService: Starting getUserNotes operation for user:', userId);
      
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      console.log('NotesService: Query created for user notes');
      
      // Use retry logic for fetching notes
      const snapshot = await this.withRetry(async () => {
        return await getDocs(q);
      }, 'getUserNotes');
      
      console.log('NotesService: Query executed, found', snapshot.docs.length, 'notes');

      const notes = snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt.toDate(),
        updatedAt: docSnap.data().updatedAt.toDate(),
      })) as Note[];
      
      console.log('NotesService: Processed notes:', notes.map(n => ({ id: n.id, title: n.title })));
      return notes;
    } catch (error) {
      console.error('NotesService: Error fetching notes:', error);
      console.error('NotesService: Error details:', JSON.stringify(error, null, 2));
      throw error;
    }
  }

  async updateNote(userId: string, noteId: string, updates: Partial<Note>): Promise<void> {
    try {
      console.log('NotesService: Starting updateNote operation for ID:', noteId);
      const db = getFirestore();
      const noteRef = doc(db, this.collection, noteId);
      
      // Verify ownership with retry
      const noteDoc = await this.withRetry(async () => {
        return await getDoc(noteRef);
      }, 'getDoc for ownership check');
      
      if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
        throw new Error('Note not found or access denied');
      }

      // Update note with retry
      await this.withRetry(async () => {
        await updateDoc(noteRef, {
          ...updates,
          updatedAt: new Date(),
        });
      }, 'updateNote');
      
      console.log('NotesService: Note updated successfully:', noteId);
    } catch (error) {
      console.error('NotesService: Error updating note:', error);
      throw error;
    }
  }

  async deleteNote(userId: string, noteId: string): Promise<void> {
    try {
      const db = getFirestore();
      const noteRef = doc(db, this.collection, noteId);
      
      // Verify ownership
      const noteDoc = await getDoc(noteRef);
      if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
        throw new Error('Note not found or access denied');
      }

      await deleteDoc(noteRef);
    } catch (error) {
      console.error('Error deleting note:', error);
      throw error;
    }
  }

  async getNoteById(userId: string, noteId: string): Promise<Note | null> {
    try {
      const db = getFirestore();
      const noteDoc = await getDoc(doc(db, this.collection, noteId));
      
      if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
        return null;
      }

      const data = noteDoc.data();
      if (!data) return null;

      return {
        id: noteDoc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Note;
    } catch (error) {
      console.error('Error fetching note by ID:', error);
      throw error;
    }
  }

  async searchNotes(userId: string, searchQuery: string): Promise<Note[]> {
    try {
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);

      const notes = snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt.toDate(),
        updatedAt: docSnap.data().updatedAt.toDate(),
      })) as Note[];

      // Client-side filtering for full-text search
      const queryLower = searchQuery.toLowerCase();
      return notes.filter(note => 
        note.title.toLowerCase().includes(queryLower) ||
        note.plainText.toLowerCase().includes(queryLower) ||
        note.tags.some(tag => tag.toLowerCase().includes(queryLower))
      );
    } catch (error) {
      console.error('Error searching notes:', error);
      return [];
    }
  }

  async getNotesByTone(userId: string, tone: 'professional' | 'casual' | 'simplified'): Promise<Note[]> {
    try {
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('tone', '==', tone),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt.toDate(),
        updatedAt: docSnap.data().updatedAt.toDate(),
      })) as Note[];
    } catch (error) {
      console.error('Error fetching notes by tone:', error);
      return [];
    }
  }

  async getStarredNotes(userId: string): Promise<Note[]> {
    try {
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('isStarred', '==', true),
        orderBy('updatedAt', 'desc')
      );
      const snapshot = await getDocs(q);

      return snapshot.docs.map((docSnap: any) => ({
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt.toDate(),
        updatedAt: docSnap.data().updatedAt.toDate(),
      })) as Note[];
    } catch (error) {
      console.error('Error fetching starred notes:', error);
      return [];
    }
  }

  async toggleNoteStar(userId: string, noteId: string): Promise<void> {
    try {
      const note = await this.getNoteById(userId, noteId);
      if (!note) {
        throw new Error('Note not found');
      }

      await this.updateNote(userId, noteId, { isStarred: !note.isStarred });
    } catch (error) {
      console.error('Error toggling note star:', error);
      throw new Error('Failed to update note');
    }
  }
}
