// src/services/FolderService.ts
// NoteSpark AI - Comprehensive Folder Management Service
// Enterprise-grade folder organization with performance optimization

import firestore from '@react-native-firebase/firestore';
import { 
  Folder, 
  FolderWithNotes, 
  FolderStats, 
  CreateFolderRequest, 
  UpdateFolderRequest,
  MoveNotesRequest,
  FolderFilter,
  BulkFolderOperation,
  Note,
  SYSTEM_FOLDERS,
  FOLDER_COLORS,
  FOLDER_ICONS
} from '../types/folders';

export class FolderService {
  private static instance: FolderService;

  static getInstance(): FolderService {
    if (!FolderService.instance) {
      FolderService.instance = new FolderService();
    }
    return FolderService.instance;
  }

  // OPTIMIZED: Enhanced retry mechanism with proper timeout handling for Firestore operations
  private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 3,
    timeoutMs: number = 12000 // Firestore operations need reasonable timeout
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`FolderService: ${operationName} attempt ${attempt}/${maxRetries}`);
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => reject(new Error('Firestore operation timeout')), timeoutMs);
          // Store timeout ID for potential cleanup
          (timeoutPromise as any).timeoutId = timeoutId;
        });
        
        const result = await Promise.race([operation(), timeoutPromise]);
        console.log(`FolderService: ${operationName} succeeded on attempt ${attempt}`);
        
        // Clear timeout if operation completed successfully
        if ((timeoutPromise as any).timeoutId) {
          clearTimeout((timeoutPromise as any).timeoutId);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`FolderService: ${operationName} failed on attempt ${attempt}:`, lastError.message);
        
        // Don't retry for certain errors that won't change
        if (this.isNonRetryableError(lastError)) {
          console.log(`FolderService: Non-retryable error for ${operationName}, stopping retries`);
          break;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Progressive backoff for Firestore operations
        const delay = Math.min(1000 * attempt, 4000); // Max 4 seconds delay
        console.log(`FolderService: Retrying ${operationName} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`All ${maxRetries} attempts failed for ${operationName}: ${lastError!.message}`);
  }

  // OPTIMIZED: Check if error should not be retried
  private isNonRetryableError(error: Error): boolean {
    const nonRetryableCodes = [
      'permission-denied',
      'not-found',
      'already-exists',
      'invalid-argument',
      'failed-precondition',
      'out-of-range'
    ];
    
    const errorMessage = error.message.toLowerCase();
    return nonRetryableCodes.some(code => errorMessage.includes(code)) ||
           errorMessage.includes('access denied') ||
           errorMessage.includes('folder not found') ||
           errorMessage.includes('duplicate') ||
           errorMessage.includes('validation');
  }

  // OPTIMIZED: Enhanced input validation for folder operations
  private validateFolderInput(name: string, description?: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Folder name is required');
    }
    
    if (name.trim().length > 100) {
      throw new Error('Folder name must be 100 characters or less');
    }
    
    if (description && description.length > 500) {
      throw new Error('Folder description must be 500 characters or less');
    }
    
    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      throw new Error('Folder name contains invalid characters');
    }
  }

  /**
   * OPTIMIZED: Create folder with enhanced validation, retry logic, and atomic operations
   */
  async createFolder(
    request: CreateFolderRequest,
    userId: string
  ): Promise<Folder> {
    try {
      console.log('FolderService: Starting createFolder operation for user:', userId);
      
      // OPTIMIZED: Enhanced input validation
      this.validateFolderInput(request.name, request.description);
      
      // OPTIMIZED: Validate userId
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }
      
      // OPTIMIZED: Validate parent folder if specified
      if (request.parentId) {
        const parentFolder = await this.withRetry(async () => {
          return await this.getFolderById(request.parentId!, userId);
        }, 'validateParentFolder');
        
        if (!parentFolder) {
          throw new Error('Parent folder not found or access denied');
        }
      }

      const folderRef = firestore().collection('folders').doc();
      const now = new Date();
      
      // Get next order number with retry
      const nextOrder = await this.withRetry(async () => {
        return await this.getNextFolderOrder(userId);
      }, 'getNextFolderOrder');

      const folder: Folder = {
        id: folderRef.id,
        name: request.name.trim(),
        description: request.description?.trim() || '',
        color: request.color || FOLDER_COLORS[Math.floor(Math.random() * FOLDER_COLORS.length)],
        icon: request.icon || 'folder',
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
        noteCount: 0,
        isDefault: false,
        isArchived: false,
        order: nextOrder,
      };

      // Only add parentId if it's not undefined
      if (request.parentId) {
        folder.parentId = request.parentId;
      }

      // OPTIMIZED: Use atomic transaction with retry logic
      await this.withRetry(async () => {
        return await firestore().runTransaction(async (transaction) => {
          // Check for duplicate names within the transaction
          const existingQuery = firestore()
            .collection('folders')
            .where('createdBy', '==', userId)
            .where('name', '==', request.name.trim())
            .where('isArchived', '==', false);
          
          const existingSnapshot = await existingQuery.get();
          
          if (!existingSnapshot.empty) {
            throw new Error('A folder with this name already exists');
          }
          
          // Create the folder atomically
          transaction.set(folderRef, folder);
        });
      }, 'createFolderTransaction');

      console.log('FolderService: Folder created successfully:', folder.id);

      // Log analytics with error handling
      try {
        await this.logFolderAnalytics(folder.id, 'created', userId);
      } catch (analyticsError) {
        console.warn('FolderService: Failed to log analytics:', analyticsError);
        // Don't fail the operation if analytics fails
      }

      return folder;
    } catch (error) {
      console.error('FolderService: Error creating folder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create folder');
    }
  }

  /**
   * OPTIMIZED: Get user folders with enhanced filtering, retry logic, and performance optimization
   */
  async getUserFolders(
    userId: string, 
    filter?: FolderFilter
  ): Promise<Folder[]> {
    try {
      console.log('FolderService: Starting getUserFolders operation for user:', userId);
      
      // OPTIMIZED: Input validation
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }
      
      let query = firestore()
        .collection('folders')
        .where('createdBy', '==', userId)
        .where('isArchived', '==', false);

      // Apply filters with validation
      if (filter?.color) {
        const isValidColor = (FOLDER_COLORS as readonly string[]).includes(filter.color);
        if (!isValidColor) {
          console.warn('FolderService: Invalid color filter provided:', filter.color);
        } else {
          query = query.where('color', '==', filter.color);
        }
      }

      if (filter?.hasNotes !== undefined) {
        if (filter.hasNotes) {
          query = query.where('noteCount', '>', 0);
        } else {
          query = query.where('noteCount', '==', 0);
        }
      }

      if (filter?.createdAfter) {
        query = query.where('createdAt', '>=', filter.createdAfter);
      }

      if (filter?.createdBefore) {
        query = query.where('createdAt', '<=', filter.createdBefore);
      }

      // Apply sorting with validation
      const sortBy = filter?.sortBy || 'order';
      const sortOrder = filter?.sortOrder || 'asc';
      
      if (['order', 'name', 'createdAt', 'updatedAt', 'noteCount'].includes(sortBy)) {
        query = query.orderBy(sortBy, sortOrder);
      } else {
        console.warn('FolderService: Invalid sortBy field, using default order');
        query = query.orderBy('order', 'asc');
      }

      // OPTIMIZED: Execute query with retry logic
      const snapshot = await this.withRetry(async () => {
        return await query.get();
      }, 'getUserFolders');
      
      let folders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt.toDate(),
          updatedAt: data.updatedAt.toDate(),
        };
      }) as Folder[];

      // OPTIMIZED: Apply text search filter with better performance
      if (filter?.searchQuery) {
        const searchTerm = filter.searchQuery.toLowerCase().trim();
        if (searchTerm.length > 0) {
          folders = folders.filter(folder => {
            const nameMatch = folder.name.toLowerCase().includes(searchTerm);
            const descriptionMatch = folder.description?.toLowerCase().includes(searchTerm);
            return nameMatch || descriptionMatch;
          });
        }
      }

      console.log(`FolderService: Retrieved ${folders.length} folders for user:`, userId);
      return folders;
    } catch (error) {
      console.error('FolderService: Error fetching user folders:', error);
      return [];
    }
  }

  /**
   * OPTIMIZED: Get folder by ID with enhanced validation and retry logic
   */
  async getFolderById(folderId: string, userId: string): Promise<Folder | null> {
    try {
      console.log('FolderService: Starting getFolderById operation:', folderId);
      
      // OPTIMIZED: Input validation
      if (!folderId || folderId.trim().length === 0) {
        throw new Error('Folder ID is required');
      }
      
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }

      const doc = await this.withRetry(async () => {
        return await firestore()
          .collection('folders')
          .doc(folderId)
          .get();
      }, 'getFolderById');

      if (!doc.exists) {
        console.log('FolderService: Folder not found:', folderId);
        return null;
      }

      const data = doc.data()!;
      
      // Verify ownership
      if (data.createdBy !== userId) {
        console.warn('FolderService: Access denied for folder:', folderId, 'user:', userId);
        throw new Error('Access denied');
      }

      const folder = {
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Folder;
      
      console.log('FolderService: Folder retrieved successfully:', folderId);
      return folder;
    } catch (error) {
      console.error('FolderService: Error fetching folder by ID:', error);
      return null;
    }
  }

  /**
   * OPTIMIZED: Update folder with enhanced validation, duplicate checking, and retry logic
   */
  async updateFolder(
    folderId: string,
    updates: UpdateFolderRequest,
    userId: string
  ): Promise<boolean> {
    try {
      console.log('FolderService: Starting updateFolder operation:', folderId);
      
      // OPTIMIZED: Input validation
      if (!folderId || folderId.trim().length === 0) {
        throw new Error('Folder ID is required');
      }
      
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }

      // Verify ownership first with retry
      const folder = await this.withRetry(async () => {
        return await this.getFolderById(folderId, userId);
      }, 'verifyFolderOwnership');
      
      if (!folder) {
        throw new Error('Folder not found or access denied');
      }

      // OPTIMIZED: Validate name if being updated
      if (updates.name !== undefined) {
        this.validateFolderInput(updates.name, updates.description);

        // Check for duplicate names (excluding current folder) with retry
        const existingFolder = await this.withRetry(async () => {
          return await this.getFolderByName(updates.name!.trim(), userId);
        }, 'checkDuplicateName');
        
        if (existingFolder && existingFolder.id !== folderId) {
          throw new Error('A folder with this name already exists');
        }
      }

      const updateData: any = {
        ...updates,
        updatedAt: new Date(),
      };

      // Trim name if provided
      if (updateData.name) {
        updateData.name = updateData.name.trim();
      }
      
      // Trim description if provided
      if (updateData.description) {
        updateData.description = updateData.description.trim();
      }

      // OPTIMIZED: Update with retry logic
      await this.withRetry(async () => {
        await firestore()
          .collection('folders')
          .doc(folderId)
          .update(updateData);
      }, 'updateFolder');

      console.log('FolderService: Folder updated successfully:', folderId);

      // Log analytics with error handling
      try {
        await this.logFolderAnalytics(folderId, 'updated', userId);
      } catch (analyticsError) {
        console.warn('FolderService: Failed to log analytics:', analyticsError);
        // Don't fail the operation if analytics fails
      }

      return true;
    } catch (error) {
      console.error('FolderService: Error updating folder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update folder');
    }
  }

  /**
   * OPTIMIZED: Move notes to folder with enhanced validation, retry logic, and atomic operations
   */
  async moveNotesToFolder(
    request: MoveNotesRequest,
    userId: string
  ): Promise<boolean> {
    try {
      console.log(`FolderService: Starting moveNotesToFolder operation for ${request.noteIds.length} notes`);
      
      // OPTIMIZED: Input validation
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }
      
      if (!request.noteIds || request.noteIds.length === 0) {
        console.log('FolderService: No notes to move, returning success');
        return true;
      }
      
      if (request.noteIds.length > 100) {
        throw new Error('Cannot move more than 100 notes at once');
      }

      // Verify folder ownership if moving to a folder with retry
      if (request.targetFolderId) {
        const targetFolder = await this.withRetry(async () => {
          return await this.getFolderById(request.targetFolderId!, userId);
        }, 'verifyTargetFolder');
        
        if (!targetFolder) {
          throw new Error('Target folder not found or access denied');
        }
      }

      // Get current notes to determine source folders with retry
      const sourcefolderCounts: Record<string, number> = {};
      const validNoteIds: string[] = [];
      
      for (const noteId of request.noteIds) {
        try {
          const noteDoc = await this.withRetry(async () => {
            return await firestore().collection('notes').doc(noteId).get();
          }, `verifyNote_${noteId}`);
          
          if (!noteDoc.exists || noteDoc.data()?.createdBy !== userId) {
            console.warn(`FolderService: Note ${noteId} not found or access denied, skipping`);
            continue;
          }

          const currentFolderId = noteDoc.data()?.folderId;
          if (currentFolderId) {
            sourcefolderCounts[currentFolderId] = (sourcefolderCounts[currentFolderId] || 0) + 1;
          }
          
          validNoteIds.push(noteId);
        } catch (noteError) {
          console.warn(`FolderService: Error verifying note ${noteId}:`, noteError);
          // Continue with other notes
        }
      }
      
      if (validNoteIds.length === 0) {
        throw new Error('No valid notes found to move');
      }

      // OPTIMIZED: Use batch operations with retry logic
      await this.withRetry(async () => {
        const batch = firestore().batch();
        const now = new Date();

        // Update note's folder reference
        for (const noteId of validNoteIds) {
          const noteRef = firestore().collection('notes').doc(noteId);
          batch.update(noteRef, {
            folderId: request.targetFolderId || null,
            updatedAt: now,
          });
        }

        // Update source folder note counts (decrease)
        for (const [sourceFolderId, count] of Object.entries(sourcefolderCounts)) {
          const sourceFolderRef = firestore().collection('folders').doc(sourceFolderId);
          batch.update(sourceFolderRef, {
            noteCount: firestore.FieldValue.increment(-count),
            updatedAt: now,
          });
        }

        // Update target folder note count (increase)
        if (request.targetFolderId) {
          const targetFolderRef = firestore().collection('folders').doc(request.targetFolderId);
          batch.update(targetFolderRef, {
            noteCount: firestore.FieldValue.increment(validNoteIds.length),
            updatedAt: now,
          });
        }

        await batch.commit();
      }, 'moveNotesToFolderBatch');

      console.log(`FolderService: Successfully moved ${validNoteIds.length} notes to folder:`, request.targetFolderId);

      // Log analytics with error handling
      if (request.targetFolderId) {
        try {
          await this.logFolderAnalytics(request.targetFolderId, 'notes_added', userId);
        } catch (analyticsError) {
          console.warn('FolderService: Failed to log analytics:', analyticsError);
        }
      }

      return true;
    } catch (error) {
      console.error('FolderService: Error moving notes to folder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to move notes');
    }
  }

  /**
   * Delete folder with options for handling contained notes
   */
  async deleteFolder(
    folderId: string,
    userId: string,
    moveNotesToFolderId?: string | null
  ): Promise<boolean> {
    try {
      // Verify ownership
      const folder = await this.getFolderById(folderId, userId);
      if (!folder) {
        throw new Error('Folder not found or access denied');
      }

      // Cannot delete system folders
      if (folder.isDefault) {
        throw new Error('Cannot delete system folders');
      }

      const batch = firestore().batch();
      const now = new Date();

      // Get all notes in the folder
      const notesSnapshot = await firestore()
        .collection('notes')
        .where('folderId', '==', folderId)
        .where('createdBy', '==', userId)
        .get();

      // Handle notes in the folder
      if (notesSnapshot.docs.length > 0) {
        // Move notes to specified folder or inbox (null)
        notesSnapshot.docs.forEach(noteDoc => {
          batch.update(noteDoc.ref, {
            folderId: moveNotesToFolderId || null,
            updatedAt: now,
          });
        });

        // Update destination folder note count if moving to a folder
        if (moveNotesToFolderId) {
          const destinationFolderRef = firestore()
            .collection('folders')
            .doc(moveNotesToFolderId);
          
          batch.update(destinationFolderRef, {
            noteCount: firestore.FieldValue.increment(notesSnapshot.docs.length),
            updatedAt: now,
          });
        }
      }

      // Delete the folder
      const folderRef = firestore().collection('folders').doc(folderId);
      batch.delete(folderRef);

      await batch.commit();

      // Log analytics
      await this.logFolderAnalytics(folderId, 'deleted', userId);

      return true;
    } catch (error) {
      console.error('Error deleting folder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to delete folder');
    }
  }

  /**
   * Get notes without folder (inbox/unorganized notes)
   */
  async getUnorganizedNotes(userId: string): Promise<Note[]> {
    try {
      const snapshot = await firestore()
        .collection('notes')
        .where('createdBy', '==', userId)
        .where('folderId', '==', null)
        .orderBy('updatedAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Note[];
    } catch (error) {
      console.error('Error fetching unorganized notes:', error);
      return [];
    }
  }

  /**
   * Migrate existing notes to include folderId field
   */
  async migrateExistingNotes(userId: string): Promise<boolean> {
    try {
      console.log('FolderService: Starting migration for user:', userId);
      
      // Get all notes for this user that don't have folderId field
      // Check both userId and createdBy fields for compatibility
      const notesSnapshotUserId = await firestore()
        .collection('notes')
        .where('userId', '==', userId)
        .get();

      const notesSnapshotCreatedBy = await firestore()
        .collection('notes')
        .where('createdBy', '==', userId)
        .get();

      const batch = firestore().batch();
      let updateCount = 0;

      // Process notes with userId field
      for (const doc of notesSnapshotUserId.docs) {
        const data = doc.data();
        
        // Check if note doesn't have folderId field or has undefined folderId
        if (!data.hasOwnProperty('folderId') || data.folderId === undefined) {
          batch.update(doc.ref, {
            folderId: null, // Explicitly set to null for inbox notes
            createdBy: userId, // Ensure createdBy field is set
            updatedAt: new Date()
          });
          updateCount++;
        }
      }

      // Process notes with createdBy field
      for (const doc of notesSnapshotCreatedBy.docs) {
        const data = doc.data();
        
        // Check if note doesn't have folderId field or has undefined folderId
        if (!data.hasOwnProperty('folderId') || data.folderId === undefined) {
          batch.update(doc.ref, {
            folderId: null, // Explicitly set to null for inbox notes
            userId: userId, // Ensure userId field is set for backward compatibility
            updatedAt: new Date()
          });
          updateCount++;
        }
      }

      if (updateCount > 0) {
        await batch.commit();
        console.log(`FolderService: Migrated ${updateCount} notes to include folderId field`);
      } else {
        console.log('FolderService: No notes needed migration');
      }

      return true;
    } catch (error) {
      console.error('Error migrating notes:', error);
      return false;
    }
  }

  /**
   * OPTIMIZED: Enhanced get notes in folder with retry logic and better performance
   */
  async getNotesInFolder(
    folderId: string | null, // null for inbox
    userId: string,
    limit: number = 50,
    lastNote?: Note
  ): Promise<Note[]> {
    try {
      console.log('FolderService: Starting getNotesInFolder operation for folder:', folderId);
      
      // OPTIMIZED: Input validation
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }
      
      if (limit <= 0 || limit > 1000) {
        throw new Error('Limit must be between 1 and 1000');
      }

      let query = firestore()
        .collection('notes')
        .where('createdBy', '==', userId);

      // Filter by folder
      if (folderId === null) {
        // Inbox - notes without folder
        query = query.where('folderId', '==', null);
      } else {
        // Verify folder exists and user has access
        const folder = await this.withRetry(async () => {
          return await this.getFolderById(folderId, userId);
        }, 'verifyFolderAccess');
        
        if (!folder) {
          throw new Error('Folder not found or access denied');
        }
        
        query = query.where('folderId', '==', folderId);
      }

      // OPTIMIZED: Execute query with retry logic
      const snapshot = await this.withRetry(async () => {
        return await query.get();
      }, 'getNotesInFolder');

      let notes = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt.toDate(),
            updatedAt: data.updatedAt.toDate(),
          };
        }) as Note[];

      // OPTIMIZED: Filter archived notes and sort efficiently
      notes = notes
        .filter((note: Note) => !note.isArchived)
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // OPTIMIZED: Apply pagination efficiently
      if (lastNote) {
        const lastNoteIndex = notes.findIndex(note => note.id === lastNote.id);
        if (lastNoteIndex >= 0) {
          notes = notes.slice(lastNoteIndex + 1);
        }
      }

      // Apply limit
      const result = notes.slice(0, limit);
      
      console.log(`FolderService: Retrieved ${result.length} notes from folder:`, folderId);
      return result;
    } catch (error) {
      console.error('FolderService: Error fetching notes in folder:', error);
      return [];
    }
  }

  // OPTIMIZED: Enhanced helper methods with retry logic and better validation

  private async getFolderByName(name: string, userId: string): Promise<Folder | null> {
    try {
      // OPTIMIZED: Input validation
      if (!name || name.trim().length === 0) {
        return null;
      }
      
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }

      const snapshot = await this.withRetry(async () => {
        return await firestore()
          .collection('folders')
          .where('createdBy', '==', userId)
          .where('name', '==', name.trim())
          .where('isArchived', '==', false)
          .limit(1)
          .get();
      }, 'getFolderByName');

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return {
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      } as Folder;
    } catch (error) {
      console.error('FolderService: Error fetching folder by name:', error);
      return null;
    }
  }

  private async getNextFolderOrder(userId: string): Promise<number> {
    try {
      // OPTIMIZED: Input validation
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }

      const snapshot = await this.withRetry(async () => {
        return await firestore()
          .collection('folders')
          .where('createdBy', '==', userId)
          .get();
      }, 'getNextFolderOrder');

      if (snapshot.empty) {
        return 1;
      }

      // OPTIMIZED: Find the highest order efficiently
      let highestOrder = 0;
      snapshot.docs.forEach(doc => {
        const order = doc.data().order || 0;
        if (order > highestOrder) {
          highestOrder = order;
        }
      });

      return highestOrder + 1;
    } catch (error) {
      console.error('FolderService: Error getting next folder order:', error);
      return Date.now(); // Fallback to timestamp
    }
  }

  private async logFolderAnalytics(
    folderId: string,
    action: string,
    userId: string
  ): Promise<void> {
    try {
      // OPTIMIZED: Input validation
      if (!folderId || !action || !userId) {
        console.warn('FolderService: Invalid analytics parameters, skipping');
        return;
      }

      // OPTIMIZED: Analytics logging with retry but don't fail operations
      await this.withRetry(async () => {
        await firestore().collection('analytics').add({
          type: 'folder_action',
          folderId,
          action,
          userId,
          timestamp: new Date(),
          platform: 'mobile',
          version: '1.0.0', // Could be dynamic
        });
      }, 'logFolderAnalytics', 2, 5000); // Shorter timeout for analytics
      
      console.log(`FolderService: Analytics logged - ${action} for folder:`, folderId);
    } catch (error) {
      // Don't throw errors for analytics failures
      console.warn('FolderService: Failed to log folder analytics:', error);
    }
  }

  // OPTIMIZED: Get comprehensive folder statistics with retry logic
  async getFolderStats(folderId: string, userId: string): Promise<FolderStats | null> {
    try {
      console.log('FolderService: Starting getFolderStats operation:', folderId);
      
      // OPTIMIZED: Input validation
      if (!folderId || folderId.trim().length === 0) {
        throw new Error('Folder ID is required');
      }
      
      if (!userId || userId.trim().length === 0) {
        throw new Error('User ID is required');
      }

      const folder = await this.withRetry(async () => {
        return await this.getFolderById(folderId, userId);
      }, 'getFolderForStats');
      
      if (!folder) {
        return null;
      }

      const notesSnapshot = await this.withRetry(async () => {
        return await firestore()
          .collection('notes')
          .where('folderId', '==', folderId)
          .where('createdBy', '==', userId)
          .where('isArchived', '==', false)
          .get();
      }, 'getNotesForStats');

      const notes = notesSnapshot.docs.map(doc => doc.data());
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const stats: FolderStats = {
        totalNotes: notes.length,
        recentNotes: notes.filter(note => note.createdAt.toDate() > sevenDaysAgo).length,
        totalSize: notes.reduce((sum, note) => sum + (note.size || 0), 0),
        lastActivity: notes.length > 0 
          ? new Date(Math.max(...notes.map(note => note.updatedAt.toDate().getTime())))
          : folder.createdAt,
      };

      console.log('FolderService: Folder stats calculated:', stats);
      return stats;
    } catch (error) {
      console.error('FolderService: Error fetching folder stats:', error);
      return null;
    }
  }

  /**
   * Bulk folder operations
   */
  async performBulkOperation(
    operation: BulkFolderOperation,
    userId: string
  ): Promise<boolean> {
    try {
      const batch = firestore().batch();
      const now = new Date();

      for (const folderId of operation.folderIds) {
        // Verify ownership
        const folder = await this.getFolderById(folderId, userId);
        if (!folder || folder.isDefault) {
          continue; // Skip folders we can't modify
        }

        const folderRef = firestore().collection('folders').doc(folderId);

        switch (operation.operation) {
          case 'archive':
            batch.update(folderRef, { isArchived: true, updatedAt: now });
            break;
          case 'unarchive':
            batch.update(folderRef, { isArchived: false, updatedAt: now });
            break;
          case 'delete':
            // Move notes to target folder or inbox
            if (folder.noteCount > 0) {
              const notesSnapshot = await firestore()
                .collection('notes')
                .where('folderId', '==', folderId)
                .get();
              
              notesSnapshot.docs.forEach(noteDoc => {
                batch.update(noteDoc.ref, {
                  folderId: operation.targetFolderId || null,
                  updatedAt: now,
                });
              });

              // Update target folder count
              if (operation.targetFolderId) {
                const targetRef = firestore().collection('folders').doc(operation.targetFolderId);
                batch.update(targetRef, {
                  noteCount: firestore.FieldValue.increment(folder.noteCount),
                  updatedAt: now,
                });
              }
            }
            batch.delete(folderRef);
            break;
          case 'move':
            if (operation.targetFolderId) {
              batch.update(folderRef, { 
                parentId: operation.targetFolderId, 
                updatedAt: now 
              });
            }
            break;
        }
      }

      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error performing bulk operation:', error);
      return false;
    }
  }

  /**
   * Search folders and notes across all folders
   */
  async searchFoldersAndNotes(
    query: string,
    userId: string,
    limit: number = 20
  ): Promise<{ folders: Folder[]; notes: Note[] }> {
    try {
      const searchTerm = query.toLowerCase().trim();
      
      if (!searchTerm) {
        return { folders: [], notes: [] };
      }

      // Search folders
      const foldersSnapshot = await firestore()
        .collection('folders')
        .where('createdBy', '==', userId)
        .where('isArchived', '==', false)
        .get();

      const folders = foldersSnapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        }) as Folder)
        .filter(folder => 
          folder.name.toLowerCase().includes(searchTerm) ||
          folder.description?.toLowerCase().includes(searchTerm)
        );

      // Search notes (simplified - in production you'd use full-text search)
      const notesSnapshot = await firestore()
        .collection('notes')
        .where('createdBy', '==', userId)
        .where('isArchived', '==', false)
        .orderBy('updatedAt', 'desc')
        .limit(limit * 2) // Get more notes to filter
        .get();

      const notes = notesSnapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        }) as Note)
        .filter(note => 
          note.title.toLowerCase().includes(searchTerm) ||
          note.content.toLowerCase().includes(searchTerm)
        )
        .slice(0, limit);

      return { folders, notes };
    } catch (error) {
      console.error('Error searching folders and notes:', error);
      return { folders: [], notes: [] };
    }
  }
}
