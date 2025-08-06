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

  /**
   * Create a new folder with validation and default settings
   */
  async createFolder(
    request: CreateFolderRequest,
    userId: string
  ): Promise<Folder> {
    try {
      // Validate folder name
      if (!request.name.trim()) {
        throw new Error('Folder name cannot be empty');
      }

      // Check for duplicate names
      const existingFolder = await this.getFolderByName(request.name.trim(), userId);
      if (existingFolder) {
        throw new Error('A folder with this name already exists');
      }

      const folderRef = firestore().collection('folders').doc();
      const now = new Date();
      
      // Get next order number
      const nextOrder = await this.getNextFolderOrder(userId);

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

      await folderRef.set(folder);

      // Log analytics
      await this.logFolderAnalytics(folder.id, 'created', userId);

      return folder;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to create folder');
    }
  }

  /**
   * Get all folders for a user with optional filtering
   */
  async getUserFolders(
    userId: string, 
    filter?: FolderFilter
  ): Promise<Folder[]> {
    try {
      let query = firestore()
        .collection('folders')
        .where('createdBy', '==', userId)
        .where('isArchived', '==', false);

      // Apply filters
      if (filter?.color) {
        query = query.where('color', '==', filter.color);
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

      // Apply sorting
      const sortBy = filter?.sortBy || 'order';
      const sortOrder = filter?.sortOrder || 'asc';
      query = query.orderBy(sortBy, sortOrder);

      const snapshot = await query.get();
      let folders = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        createdAt: doc.data().createdAt.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Folder[];

      // Apply text search filter (client-side for flexibility)
      if (filter?.searchQuery) {
        const searchTerm = filter.searchQuery.toLowerCase();
        folders = folders.filter(folder => 
          folder.name.toLowerCase().includes(searchTerm) ||
          folder.description?.toLowerCase().includes(searchTerm)
        );
      }

      return folders;
    } catch (error) {
      console.error('Error fetching user folders:', error);
      return [];
    }
  }

  /**
   * Get folder by ID with full details
   */
  async getFolderById(folderId: string, userId: string): Promise<Folder | null> {
    try {
      const doc = await firestore()
        .collection('folders')
        .doc(folderId)
        .get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data()!;
      
      // Verify ownership
      if (data.createdBy !== userId) {
        throw new Error('Access denied');
      }

      return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
      } as Folder;
    } catch (error) {
      console.error('Error fetching folder by ID:', error);
      return null;
    }
  }

  /**
   * Update folder properties
   */
  async updateFolder(
    folderId: string,
    updates: UpdateFolderRequest,
    userId: string
  ): Promise<boolean> {
    try {
      // Verify ownership first
      const folder = await this.getFolderById(folderId, userId);
      if (!folder) {
        throw new Error('Folder not found or access denied');
      }

      // Validate name if being updated
      if (updates.name !== undefined) {
        if (!updates.name.trim()) {
          throw new Error('Folder name cannot be empty');
        }

        // Check for duplicate names (excluding current folder)
        const existingFolder = await this.getFolderByName(updates.name.trim(), userId);
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

      await firestore()
        .collection('folders')
        .doc(folderId)
        .update(updateData);

      // Log analytics
      await this.logFolderAnalytics(folderId, 'updated', userId);

      return true;
    } catch (error) {
      console.error('Error updating folder:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to update folder');
    }
  }

  /**
   * Move notes to a folder with batch operations
   */
  async moveNotesToFolder(
    request: MoveNotesRequest,
    userId: string
  ): Promise<boolean> {
    try {
      if (request.noteIds.length === 0) {
        return true;
      }

      const batch = firestore().batch();
      const now = new Date();

      // Verify folder ownership if moving to a folder
      if (request.targetFolderId) {
        const targetFolder = await this.getFolderById(request.targetFolderId, userId);
        if (!targetFolder) {
          throw new Error('Target folder not found or access denied');
        }
      }

      // Get current notes to determine source folders
      const sourcefolderCounts: Record<string, number> = {};
      
      for (const noteId of request.noteIds) {
        // Verify note ownership
        const noteDoc = await firestore().collection('notes').doc(noteId).get();
        if (!noteDoc.exists || noteDoc.data()?.createdBy !== userId) {
          throw new Error(`Note ${noteId} not found or access denied`);
        }

        const currentFolderId = noteDoc.data()?.folderId;
        if (currentFolderId) {
          sourcefolderCounts[currentFolderId] = (sourcefolderCounts[currentFolderId] || 0) + 1;
        }

        // Update note's folder reference
        const noteRef = firestore().collection('notes').doc(noteId);
        batch.update(noteRef, {
          folderId: request.targetFolderId,
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
          noteCount: firestore.FieldValue.increment(request.noteIds.length),
          updatedAt: now,
        });
      }

      await batch.commit();

      // Log analytics
      if (request.targetFolderId) {
        await this.logFolderAnalytics(request.targetFolderId, 'notes_added', userId);
      }

      return true;
    } catch (error) {
      console.error('Error moving notes to folder:', error);
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
   * Get notes in a specific folder with pagination
   */
  async getNotesInFolder(
    folderId: string | null, // null for inbox
    userId: string,
    limit: number = 50,
    lastNote?: Note
  ): Promise<Note[]> {
    try {
      let query = firestore()
        .collection('notes')
        .where('createdBy', '==', userId);

      // Filter by folder
      if (folderId === null) {
        // Inbox - notes without folder
        query = query.where('folderId', '==', null);
      } else {
        query = query.where('folderId', '==', folderId);
      }

      // Get all matching notes and filter on client side to avoid complex index
      const snapshot = await query.get();

      let notes = snapshot.docs
        .map(doc => ({
          ...doc.data(),
          id: doc.id,
          createdAt: doc.data().createdAt.toDate(),
          updatedAt: doc.data().updatedAt.toDate(),
        })) as Note[];

      // Filter archived notes on client side
      notes = notes.filter((note: Note) => !note.isArchived);

      // Sort by updated date (newest first) on client side
      notes.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

      // Apply pagination on client side
      if (lastNote) {
        const lastNoteIndex = notes.findIndex(note => note.id === lastNote.id);
        if (lastNoteIndex >= 0) {
          notes = notes.slice(lastNoteIndex + 1);
        }
      }

      // Apply limit
      return notes.slice(0, limit);
    } catch (error) {
      console.error('Error fetching notes in folder:', error);
      return [];
    }
  }

  /**
   * Get folder statistics
   */
  async getFolderStats(folderId: string, userId: string): Promise<FolderStats | null> {
    try {
      const folder = await this.getFolderById(folderId, userId);
      if (!folder) {
        return null;
      }

      const notesSnapshot = await firestore()
        .collection('notes')
        .where('folderId', '==', folderId)
        .where('createdBy', '==', userId)
        .where('isArchived', '==', false)
        .get();

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

      return stats;
    } catch (error) {
      console.error('Error fetching folder stats:', error);
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

  // Private helper methods

  private async getFolderByName(name: string, userId: string): Promise<Folder | null> {
    try {
      const snapshot = await firestore()
        .collection('folders')
        .where('createdBy', '==', userId)
        .where('name', '==', name)
        .where('isArchived', '==', false)
        .limit(1)
        .get();

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
      console.error('Error fetching folder by name:', error);
      return null;
    }
  }

  private async getNextFolderOrder(userId: string): Promise<number> {
    try {
      // Use a simpler query without compound index requirement
      const snapshot = await firestore()
        .collection('folders')
        .where('createdBy', '==', userId)
        .get();

      if (snapshot.empty) {
        return 1;
      }

      // Find the highest order on the client side to avoid index requirements
      let highestOrder = 0;
      snapshot.docs.forEach(doc => {
        const order = doc.data().order || 0;
        if (order > highestOrder) {
          highestOrder = order;
        }
      });

      return highestOrder + 1;
    } catch (error) {
      console.error('Error getting next folder order:', error);
      return Date.now(); // Fallback to timestamp
    }
  }

  private async logFolderAnalytics(
    folderId: string,
    action: string,
    userId: string
  ): Promise<void> {
    try {
      // Simple analytics logging - could be enhanced with dedicated analytics service
      await firestore().collection('analytics').add({
        type: 'folder_action',
        folderId,
        action,
        userId,
        timestamp: new Date(),
        platform: 'mobile',
      });
    } catch (error) {
      // Don't throw errors for analytics failures
      console.warn('Failed to log folder analytics:', error);
    }
  }
}
