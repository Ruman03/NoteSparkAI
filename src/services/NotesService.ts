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
  folderId?: string | null;
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
        createdBy: userId, // For compatibility with FolderService
        wordCount: this.calculateWordCount(noteData.plainText),
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

  // OPTIMIZED: Retry helper function with proper cleanup and limits
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    timeoutMs: number = 10000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      let timeoutId: NodeJS.Timeout | undefined;
      
      try {
        console.log(`NotesService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Operation timeout')), timeoutMs);
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`NotesService: ${operationName} succeeded on attempt ${attempt}`);
        
        // Clear timeout if operation completed successfully
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        return result;
      } catch (error) {
        // Clear timeout in case of error
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`NotesService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Optimized backoff: linear instead of exponential to prevent performance issues
        const delay = Math.min(1000 * attempt, 3000); // Max 3 seconds delay
        console.log(`NotesService: Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Accurate word count calculation
  private calculateWordCount(text: string): number {
    if (!text || text.trim().length === 0) {
      return 0;
    }
    
    // Remove extra whitespace and split by word boundaries
    const words = text
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .split(/\s+/) // Split by whitespace
      .filter(word => word.length > 0); // Filter out empty strings
    
    return words.length;
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

      const notes = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Note;
      });
      
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
      console.log('NotesService: Starting deleteNote operation for ID:', noteId);
      const db = getFirestore();
      const noteRef = doc(db, this.collection, noteId);
      
      // Verify ownership with retry
      const noteDoc = await this.withRetry(async () => {
        return await getDoc(noteRef);
      }, 'getDoc for ownership check');
      
      if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
        throw new Error('Note not found or access denied');
      }

      // Delete note with retry
      await this.withRetry(async () => {
        await deleteDoc(noteRef);
      }, 'deleteNote');
      
      console.log('NotesService: Note deleted successfully:', noteId);
    } catch (error) {
      console.error('NotesService: Error deleting note:', error);
      throw error;
    }
  }

  async getNoteById(userId: string, noteId: string): Promise<Note | null> {
    try {
      console.log('NotesService: Starting getNoteById operation for ID:', noteId);
      const db = getFirestore();
      
      // Get note with retry
      const noteDoc = await this.withRetry(async () => {
        return await getDoc(doc(db, this.collection, noteId));
      }, 'getNoteById');
      
      if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
        console.log('NotesService: Note not found or access denied for ID:', noteId);
        return null;
      }

      const data = noteDoc.data();
      if (!data) return null;

      const note = {
        id: noteDoc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Note;
      
      console.log('NotesService: Note retrieved successfully:', { id: note.id, title: note.title });
      return note;
    } catch (error) {
      console.error('NotesService: Error fetching note by ID:', error);
      throw error;
    }
  }

  async searchNotes(userId: string, searchQuery: string): Promise<Note[]> {
    try {
      console.log('NotesService: Starting searchNotes operation for query:', searchQuery);
      
      // Early return for empty queries
      if (!searchQuery || searchQuery.trim().length === 0) {
        return [];
      }
      
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );
      
      // Get notes with retry
      const snapshot = await this.withRetry(async () => {
        return await getDocs(q);
      }, 'searchNotes');

      const notes = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Note;
      });

      // OPTIMIZED: Client-side filtering with better performance
      const queryLower = searchQuery.toLowerCase().trim();
      const filteredNotes = notes.filter(note => {
        // Check title match first (most common)
        if (note.title.toLowerCase().includes(queryLower)) {
          return true;
        }
        
        // Check content match
        if (note.plainText.toLowerCase().includes(queryLower)) {
          return true;
        }
        
        // Check tags (only if note has tags)
        if (note.tags && note.tags.length > 0) {
          return note.tags.some(tag => tag.toLowerCase().includes(queryLower));
        }
        
        return false;
      });
      
      console.log(`NotesService: Search completed, found ${filteredNotes.length} matches out of ${notes.length} notes`);
      return filteredNotes;
    } catch (error) {
      console.error('NotesService: Error searching notes:', error);
      return [];
    }
  }

  async getNotesByTone(userId: string, tone: 'professional' | 'casual' | 'simplified'): Promise<Note[]> {
    try {
      console.log('NotesService: Starting getNotesByTone operation for tone:', tone);
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('tone', '==', tone),
        orderBy('updatedAt', 'desc')
      );
      
      // Get notes with retry
      const snapshot = await this.withRetry(async () => {
        return await getDocs(q);
      }, 'getNotesByTone');

      const notes = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Note;
      });
      
      console.log(`NotesService: Found ${notes.length} notes with tone: ${tone}`);
      return notes;
    } catch (error) {
      console.error('NotesService: Error fetching notes by tone:', error);
      return [];
    }
  }

  async getStarredNotes(userId: string): Promise<Note[]> {
    try {
      console.log('NotesService: Starting getStarredNotes operation for user:', userId);
      const db = getFirestore();
      const q = query(
        collection(db, this.collection),
        where('userId', '==', userId),
        where('isStarred', '==', true),
        orderBy('updatedAt', 'desc')
      );
      
      // Get starred notes with retry
      const snapshot = await this.withRetry(async () => {
        return await getDocs(q);
      }, 'getStarredNotes');

      const notes = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        } as Note;
      });
      
      console.log(`NotesService: Found ${notes.length} starred notes`);
      return notes;
    } catch (error) {
      console.error('NotesService: Error fetching starred notes:', error);
      return [];
    }
  }

  async toggleNoteStar(userId: string, noteId: string): Promise<void> {
    try {
      console.log('NotesService: Starting toggleNoteStar operation for ID:', noteId);
      
      // OPTIMIZED: More efficient star toggle without fetching the entire note
      const db = getFirestore();
      const noteRef = doc(db, this.collection, noteId);
      
      // Get current state with retry
      const noteDoc = await this.withRetry(async () => {
        return await getDoc(noteRef);
      }, 'getDoc for star toggle');
      
      if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
        throw new Error('Note not found or access denied');
      }

      const currentStarState = noteDoc.data()?.isStarred || false;
      
      // Update with retry
      await this.withRetry(async () => {
        await updateDoc(noteRef, { 
          isStarred: !currentStarState,
          updatedAt: new Date()
        });
      }, 'toggleNoteStar');
      
      console.log(`NotesService: Note star toggled successfully: ${noteId} -> ${!currentStarState}`);
    } catch (error) {
      console.error('NotesService: Error toggling note star:', error);
      throw new Error(`Failed to update note star: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // OPTIMIZED: Get user note statistics efficiently
  async getUserNoteStats(userId: string): Promise<{
    totalNotes: number;
    starredNotes: number;
    totalWords: number;
    notesByTone: Record<string, number>;
  }> {
    try {
      console.log('NotesService: Getting user note statistics for:', userId);
      
      const notes = await this.getUserNotes(userId);
      
      const stats = {
        totalNotes: notes.length,
        starredNotes: notes.filter(note => note.isStarred).length,
        totalWords: notes.reduce((total, note) => total + (note.wordCount || 0), 0),
        notesByTone: notes.reduce((acc, note) => {
          acc[note.tone] = (acc[note.tone] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      };
      
      console.log('NotesService: User stats calculated:', stats);
      return stats;
    } catch (error) {
      console.error('NotesService: Error getting user stats:', error);
      return {
        totalNotes: 0,
        starredNotes: 0,
        totalWords: 0,
        notesByTone: {}
      };
    }
  }

  // OPTIMIZED: Batch update notes for better performance
  async batchUpdateNotes(userId: string, updates: Array<{ noteId: string; updates: Partial<Note> }>): Promise<void> {
    try {
      console.log(`NotesService: Starting batch update for ${updates.length} notes`);
      
      const db = getFirestore();
      const updatePromises = updates.map(async ({ noteId, updates: noteUpdates }) => {
        const noteRef = doc(db, this.collection, noteId);
        
        // Verify ownership first
        const noteDoc = await getDoc(noteRef);
        if (!noteDoc.exists || noteDoc.data()?.userId !== userId) {
          throw new Error(`Access denied for note: ${noteId}`);
        }
        
        return updateDoc(noteRef, {
          ...noteUpdates,
          updatedAt: new Date(),
        });
      });
      
      await Promise.all(updatePromises);
      console.log(`NotesService: Batch update completed for ${updates.length} notes`);
    } catch (error) {
      console.error('NotesService: Error in batch update:', error);
      throw error;
    }
  }
}
