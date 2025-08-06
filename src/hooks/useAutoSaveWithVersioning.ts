// src/hooks/useAutoSaveWithVersioning.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { VersionHistoryService } from '../services/VersionHistoryService';

interface AutoSaveOptions {
  autoSaveInterval?: number; // minutes
  versionInterval?: number; // minutes
  minChangesForVersion?: number; // minimum character changes
  enabled?: boolean;
}

export const useAutoSaveWithVersioning = (
  noteId: string,
  title: string,
  content: string,
  userId: string,
  options: AutoSaveOptions = {}
) => {
  const {
    autoSaveInterval = 2, // Save every 2 minutes
    versionInterval = 15, // Create version every 15 minutes
    minChangesForVersion = 50, // Minimum 50 characters changed
    enabled = true,
  } = options;

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [lastVersioned, setLastVersioned] = useState<Date | null>(null);
  
  const versionService = VersionHistoryService.getInstance();
  const lastContentRef = useRef(content);
  const lastVersionContentRef = useRef(content);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const versionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Regular auto-save (updates main document)
  const performAutoSave = useCallback(async () => {
    if (!enabled || !noteId || !userId) return;

    try {
      setIsSaving(true);
      
      // Update main document (integrate with your existing NoteService)
      await updateMainNote(noteId, title, content);
      
      setLastSaved(new Date());
      lastContentRef.current = content;
      
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [noteId, title, content, userId, enabled]);

  // Version creation (creates snapshot in versions collection)
  const createVersion = useCallback(async () => {
    if (!enabled || !noteId || !userId) return;

    const changesSinceLastVersion = Math.abs(
      content.length - lastVersionContentRef.current.length
    );

    // Only create version if significant changes occurred
    if (changesSinceLastVersion < minChangesForVersion) {
      return;
    }

    try {
      await versionService.saveVersion(
        noteId,
        title,
        content,
        userId,
        true // isAutoSave
      );
      
      setLastVersioned(new Date());
      lastVersionContentRef.current = content;
      
    } catch (error) {
      console.error('Version creation failed:', error);
    }
  }, [noteId, title, content, userId, enabled, minChangesForVersion, versionService]);

  // Setup auto-save timer
  useEffect(() => {
    if (!enabled || content === lastContentRef.current) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer
    autoSaveTimerRef.current = setTimeout(
      performAutoSave,
      autoSaveInterval * 60 * 1000
    );

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, enabled, autoSaveInterval, performAutoSave]);

  // Setup version creation timer
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timer
    if (versionTimerRef.current) {
      clearTimeout(versionTimerRef.current);
    }

    // Set new timer
    versionTimerRef.current = setTimeout(
      createVersion,
      versionInterval * 60 * 1000
    );

    return () => {
      if (versionTimerRef.current) {
        clearTimeout(versionTimerRef.current);
      }
    };
  }, [content, enabled, versionInterval, createVersion]);

  // Manual save function (also creates version)
  const manualSave = useCallback(async () => {
    await performAutoSave();
    await createVersion();
  }, [performAutoSave, createVersion]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      if (versionTimerRef.current) {
        clearTimeout(versionTimerRef.current);
      }
    };
  }, []);

  return {
    isSaving,
    lastSaved,
    lastVersioned,
    manualSave,
  };
};

// Helper function - integrate with your existing note service
async function updateMainNote(noteId: string, title: string, content: string) {
  // This should call your existing NoteService.updateNote() method
  // Example:
  // await NoteService.getInstance().updateNote(noteId, { title, content });
  
  // For now, we'll implement a basic Firestore update
  const firestore = require('@react-native-firebase/firestore').default;
  await firestore().collection('notes').doc(noteId).update({
    title,
    content,
    updatedAt: new Date(),
  });
}
