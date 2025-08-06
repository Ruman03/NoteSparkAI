// src/contexts/FolderContext.tsx
// NoteSpark AI - Folder Organization Context
// Comprehensive state management for folder operations

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { 
  Folder, 
  Note, 
  FolderStats, 
  CreateFolderRequest, 
  UpdateFolderRequest, 
  MoveNotesRequest,
  FolderFilter,
  SYSTEM_FOLDERS,
  FOLDER_COLORS,
  FOLDER_ICONS
} from '../types/folders';
import { FolderService } from '../services/FolderService';
import { useAuth } from './AuthContext';
import { hapticService } from '../services/HapticService';

interface FolderContextValue {
  // State
  folders: Folder[];
  currentFolder: Folder | null;
  isLoading: boolean;
  error: string | null;
  
  // Folders
  createFolder: (request: CreateFolderRequest) => Promise<boolean>;
  updateFolder: (folderId: string, updates: UpdateFolderRequest) => Promise<boolean>;
  deleteFolder: (folderId: string, moveNotesToFolderId?: string) => Promise<boolean>;
  refreshFolders: () => Promise<void>;
  getFolderStats: (folderId: string) => Promise<FolderStats | null>;
  
  // Navigation
  setCurrentFolder: (folder: Folder | null) => void;
  navigateToFolder: (folderId: string | null) => Promise<void>;
  
  // Notes
  moveNotesToFolder: (request: MoveNotesRequest) => Promise<boolean>;
  getNotesInFolder: (folderId: string | null, refresh?: boolean) => Promise<Note[]>;
  getUnorganizedNotes: () => Promise<Note[]>;
  
  // Search and filtering
  searchFoldersAndNotes: (query: string) => Promise<{ folders: Folder[]; notes: Note[] }>;
  filterFolders: (filter: FolderFilter) => Promise<Folder[]>;
  
  // Utilities
  availableColors: readonly string[];
  availableIcons: readonly string[];
  systemFolders: typeof SYSTEM_FOLDERS;
  
  // Cache management
  clearCache: () => void;
  refreshCurrentFolder: () => Promise<void>;
}

const FolderContext = createContext<FolderContextValue | undefined>(undefined);

export const useFolders = (): FolderContextValue => {
  const context = useContext(FolderContext);
  if (!context) {
    throw new Error('useFolders must be used within a FolderProvider');
  }
  return context;
};

interface FolderProviderProps {
  children: React.ReactNode;
}

export const FolderProvider: React.FC<FolderProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const folderService = FolderService.getInstance();
  
  // State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [currentFolder, setCurrentFolderState] = useState<Folder | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Cache for notes by folder
  const [notesCache, setNotesCache] = useState<Record<string, Note[]>>({});
  const [statsCache, setStatsCache] = useState<Record<string, FolderStats>>({});

  // Initialize folders on mount and user change
  useEffect(() => {
    if (user?.uid) {
      initializeFolderSystem();
    } else {
      // Clear state when user logs out
      setFolders([]);
      setCurrentFolderState(null);
      setNotesCache({});
      setStatsCache({});
    }
  }, [user?.uid]);

  // Initialize folder system with migration
  const initializeFolderSystem = useCallback(async () => {
    if (!user?.uid) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Run migration for existing notes
      console.log('FolderContext: Running note migration...');
      await folderService.migrateExistingNotes(user.uid);
      
      // Load folders
      await refreshFolders();
    } catch (error) {
      console.error('Error initializing folder system:', error);
      handleError(error, 'Failed to initialize folder system');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid]);

  // Error handling helper
  const handleError = useCallback((error: unknown, defaultMessage: string) => {
    const message = error instanceof Error ? error.message : defaultMessage;
    setError(message);
    console.error(defaultMessage, error);
    hapticService.error();
    return false;
  }, []);

  // Success handling helper
  const handleSuccess = useCallback((message?: string) => {
    setError(null);
    if (message) {
      // Could show success toast here
      console.log(message);
    }
    hapticService.success();
    return true;
  }, []);

  // Refresh all folders
  const refreshFolders = useCallback(async () => {
    if (!user?.uid) return;

    try {
      setIsLoading(true);
      setError(null);
      
      const userFolders = await folderService.getUserFolders(user.uid);
      setFolders(userFolders);
      
      // Clear caches to ensure fresh data
      setNotesCache({});
      setStatsCache({});
      
    } catch (error) {
      handleError(error, 'Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, folderService, handleError]);

  // Create new folder
  const createFolder = useCallback(async (request: CreateFolderRequest): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      setIsLoading(true);
      hapticService.medium();
      
      const newFolder = await folderService.createFolder(request, user.uid);
      
      // Add to local state
      setFolders(prev => [...prev, newFolder].sort((a, b) => a.order - b.order));
      
      return handleSuccess('Folder created successfully');
    } catch (error) {
      return handleError(error, 'Failed to create folder');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, folderService, handleError, handleSuccess]);

  // Update folder
  const updateFolder = useCallback(async (
    folderId: string, 
    updates: UpdateFolderRequest
  ): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      setIsLoading(true);
      hapticService.light();
      
      const success = await folderService.updateFolder(folderId, updates, user.uid);
      
      if (success) {
        // Update local state
        setFolders(prev => prev.map(folder => 
          folder.id === folderId 
            ? { ...folder, ...updates, updatedAt: new Date() }
            : folder
        ));
        
        // Update current folder if it's the one being updated
        if (currentFolder?.id === folderId) {
          setCurrentFolderState(prev => prev ? { ...prev, ...updates } : null);
        }
        
        return handleSuccess('Folder updated successfully');
      }
      
      return false;
    } catch (error) {
      return handleError(error, 'Failed to update folder');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, folderService, currentFolder?.id, handleError, handleSuccess]);

  // Delete folder
  const deleteFolder = useCallback(async (
    folderId: string, 
    moveNotesToFolderId?: string
  ): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      setIsLoading(true);
      hapticService.heavy();
      
      const success = await folderService.deleteFolder(folderId, user.uid, moveNotesToFolderId);
      
      if (success) {
        // Remove from local state
        setFolders(prev => prev.filter(folder => folder.id !== folderId));
        
        // Clear current folder if it was deleted
        if (currentFolder?.id === folderId) {
          setCurrentFolderState(null);
        }
        
        // Clear caches
        setNotesCache(prev => {
          const { [folderId]: removed, ...rest } = prev;
          return rest;
        });
        setStatsCache(prev => {
          const { [folderId]: removed, ...rest } = prev;
          return rest;
        });
        
        return handleSuccess('Folder deleted successfully');
      }
      
      return false;
    } catch (error) {
      return handleError(error, 'Failed to delete folder');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, folderService, currentFolder?.id, handleError, handleSuccess]);

  // Set current folder
  const setCurrentFolder = useCallback((folder: Folder | null) => {
    setCurrentFolderState(folder);
    hapticService.light();
  }, []);

  // Navigate to folder and load its contents
  const navigateToFolder = useCallback(async (folderId: string | null) => {
    if (!user?.uid) return;

    try {
      let folder: Folder | null = null;
      
      if (folderId) {
        folder = await folderService.getFolderById(folderId, user.uid);
        if (!folder) {
          throw new Error('Folder not found');
        }
      }
      
      setCurrentFolder(folder);
      
      // Pre-load notes for the folder
      await getNotesInFolder(folderId, true);
      
    } catch (error) {
      handleError(error, 'Failed to navigate to folder');
    }
  }, [user?.uid, folderService, setCurrentFolder, handleError]);

  // Move notes to folder
  const moveNotesToFolder = useCallback(async (request: MoveNotesRequest): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      setIsLoading(true);
      hapticService.medium();
      
      const success = await folderService.moveNotesToFolder(request, user.uid);
      
      if (success) {
        // Clear notes cache to force refresh
        setNotesCache({});
        
        // Update folder note counts
        await refreshFolders();
        
        return handleSuccess(`Moved ${request.noteIds.length} note(s) successfully`);
      }
      
      return false;
    } catch (error) {
      return handleError(error, 'Failed to move notes');
    } finally {
      setIsLoading(false);
    }
  }, [user?.uid, folderService, refreshFolders, handleError, handleSuccess]);

  // Get notes in folder with caching
  const getNotesInFolder = useCallback(async (
    folderId: string | null, 
    refresh: boolean = false
  ): Promise<Note[]> => {
    if (!user?.uid) return [];

    const cacheKey = folderId || 'inbox';
    
    // Return cached data if available and not refreshing
    if (!refresh && notesCache[cacheKey]) {
      return notesCache[cacheKey];
    }

    try {
      const notes = await folderService.getNotesInFolder(folderId, user.uid);
      
      // Cache the results
      setNotesCache(prev => ({
        ...prev,
        [cacheKey]: notes,
      }));
      
      return notes;
    } catch (error) {
      handleError(error, 'Failed to load notes');
      return [];
    }
  }, [user?.uid, folderService, notesCache, handleError]);

  // Get unorganized notes (notes without folders)
  const getUnorganizedNotes = useCallback(async (): Promise<Note[]> => {
    if (!user?.uid) return [];

    try {
      const notes = await folderService.getUnorganizedNotes(user.uid);
      return notes;
    } catch (error) {
      handleError(error, 'Failed to load unorganized notes');
      return [];
    }
  }, [user?.uid, folderService, handleError]);

  // Get folder statistics
  const getFolderStats = useCallback(async (folderId: string): Promise<FolderStats | null> => {
    if (!user?.uid) return null;

    // Return cached stats if available
    if (statsCache[folderId]) {
      return statsCache[folderId];
    }

    try {
      const stats = await folderService.getFolderStats(folderId, user.uid);
      
      if (stats) {
        // Cache the results
        setStatsCache(prev => ({
          ...prev,
          [folderId]: stats,
        }));
      }
      
      return stats;
    } catch (error) {
      handleError(error, 'Failed to load folder statistics');
      return null;
    }
  }, [user?.uid, folderService, statsCache, handleError]);

  // Search folders and notes
  const searchFoldersAndNotes = useCallback(async (query: string) => {
    if (!user?.uid) return { folders: [], notes: [] };

    try {
      const results = await folderService.searchFoldersAndNotes(query, user.uid);
      return results;
    } catch (error) {
      handleError(error, 'Search failed');
      return { folders: [], notes: [] };
    }
  }, [user?.uid, folderService, handleError]);

  // Filter folders
  const filterFolders = useCallback(async (filter: FolderFilter): Promise<Folder[]> => {
    if (!user?.uid) return [];

    try {
      const filteredFolders = await folderService.getUserFolders(user.uid, filter);
      return filteredFolders;
    } catch (error) {
      handleError(error, 'Failed to filter folders');
      return [];
    }
  }, [user?.uid, folderService, handleError]);

  // Clear all caches
  const clearCache = useCallback(() => {
    setNotesCache({});
    setStatsCache({});
    setError(null);
  }, []);

  // Refresh current folder
  const refreshCurrentFolder = useCallback(async () => {
    if (currentFolder?.id) {
      await navigateToFolder(currentFolder.id);
    } else {
      await getNotesInFolder(null, true); // Refresh inbox
    }
  }, [currentFolder?.id, navigateToFolder, getNotesInFolder]);

  const contextValue: FolderContextValue = {
    // State
    folders,
    currentFolder,
    isLoading,
    error,
    
    // Folders
    createFolder,
    updateFolder,
    deleteFolder,
    refreshFolders,
    getFolderStats,
    
    // Navigation
    setCurrentFolder,
    navigateToFolder,
    
    // Notes
    moveNotesToFolder,
    getNotesInFolder,
    getUnorganizedNotes,
    
    // Search and filtering
    searchFoldersAndNotes,
    filterFolders,
    
    // Utilities
    availableColors: FOLDER_COLORS,
    availableIcons: FOLDER_ICONS,
    systemFolders: SYSTEM_FOLDERS,
    
    // Cache management
    clearCache,
    refreshCurrentFolder,
  };

  return (
    <FolderContext.Provider value={contextValue}>
      {children}
    </FolderContext.Provider>
  );
};
