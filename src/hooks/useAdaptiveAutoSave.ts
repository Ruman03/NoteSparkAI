import { useState, useCallback, useRef, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Optional analytics - will be added when Firebase Analytics is installed
const logAnalyticsEvent = async (eventName: string, parameters: any) => {
  try {
    // TODO: Add Firebase Analytics when package is installed
    // await analytics().logEvent(eventName, parameters);
    console.log('Analytics Event:', eventName, parameters);
  } catch (error) {
    console.warn('Analytics logging failed:', error);
  }
};

interface UserEditingPattern {
  averageEditingSpeed: number; // words per minute
  sessionLength: number; // seconds
  editingStyle: 'burst' | 'continuous' | 'mixed';
  savePreference: 'frequent' | 'moderate' | 'minimal';
  lastUpdated: Date;
  sessionCount: number;
}

interface AutoSaveSettings {
  frequency: 'realtime' | 'conservative' | 'manual' | 'adaptive';
  lastSaveTime: Date | null;
  hasUnsavedChanges: boolean;
  userPattern: UserEditingPattern | null;
  currentInterval: number;
}

interface SaveTriggerResult {
  shouldSave: boolean;
  reason: 'manual' | 'interval' | 'threshold' | 'pattern' | 'none';
  nextSaveIn?: number; // milliseconds
}

const DEFAULT_INTERVALS = {
  realtime: { interval: 2000, changeThreshold: 5 },
  conservative: { interval: 10000, changeThreshold: 50 },
  manual: { interval: 0, changeThreshold: Infinity },
  adaptive: { interval: 5000, changeThreshold: 20 } // Default before learning
};

export const useAdaptiveAutoSave = (
  content: string, 
  noteId: string,
  onSave: (content: string, noteId: string) => Promise<void>
) => {
  const [saveSettings, setSaveSettings] = useState<AutoSaveSettings>({
    frequency: 'adaptive',
    lastSaveTime: null,
    hasUnsavedChanges: false,
    userPattern: null,
    currentInterval: DEFAULT_INTERVALS.adaptive.interval
  });

  const lastContentRef = useRef<string>('');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<Date>(new Date());
  const editingSessionRef = useRef<{
    wordCount: number;
    startTime: Date;
    keystrokes: number;
    pauseCount: number;
  }>({
    wordCount: 0,
    startTime: new Date(),
    keystrokes: 0,
    pauseCount: 0
  });

  // Load user editing pattern from storage
  const loadUserPattern = useCallback(async (): Promise<UserEditingPattern | null> => {
    try {
      const patternData = await AsyncStorage.getItem(`editing_pattern_${noteId}`);
      if (patternData) {
        const pattern = JSON.parse(patternData);
        return {
          ...pattern,
          lastUpdated: new Date(pattern.lastUpdated)
        };
      }
    } catch (error) {
      console.warn('Failed to load user editing pattern:', error);
    }
    return null;
  }, [noteId]);

  // Save user editing pattern to storage
  const saveUserPattern = useCallback(async (pattern: UserEditingPattern) => {
    try {
      await AsyncStorage.setItem(`editing_pattern_${noteId}`, JSON.stringify(pattern));
      
      // Track pattern changes for analytics
      await logAnalyticsEvent('editing_pattern_updated', {
        noteId,
        editingStyle: pattern.editingStyle,
        averageSpeed: pattern.averageEditingSpeed,
        sessionCount: pattern.sessionCount
      });
    } catch (error) {
      console.warn('Failed to save user editing pattern:', error);
    }
  }, [noteId]);

  // Analyze current editing session to update user pattern
  const analyzeCurrentSession = useCallback((): Partial<UserEditingPattern> => {
    const currentTime = new Date();
    const sessionDuration = (currentTime.getTime() - sessionStartRef.current.getTime()) / 1000;
    const currentWordCount = content.split(/\s+/).filter(word => word.length > 0).length;
    const wordsAdded = Math.max(0, currentWordCount - editingSessionRef.current.wordCount);
    
    const editingSpeed = sessionDuration > 0 ? (wordsAdded / sessionDuration) * 60 : 0; // WPM
    
    // Determine editing style based on patterns
    let editingStyle: 'burst' | 'continuous' | 'mixed' = 'mixed';
    if (editingSessionRef.current.pauseCount > sessionDuration / 30) {
      editingStyle = 'burst'; // Many pauses indicate burst editing
    } else if (editingSessionRef.current.pauseCount < sessionDuration / 120) {
      editingStyle = 'continuous'; // Few pauses indicate continuous editing
    }

    return {
      averageEditingSpeed: editingSpeed,
      sessionLength: sessionDuration,
      editingStyle,
      lastUpdated: currentTime
    };
  }, [content]);

  // Calculate adaptive save interval based on user pattern
  const calculateAdaptiveInterval = useCallback((pattern: UserEditingPattern | null): number => {
    if (!pattern) return DEFAULT_INTERVALS.adaptive.interval;

    let baseInterval = DEFAULT_INTERVALS.adaptive.interval;

    // Adjust based on editing style
    switch (pattern.editingStyle) {
      case 'burst':
        baseInterval = 3000; // Shorter interval for burst editing
        break;
      case 'continuous':
        baseInterval = 8000; // Longer interval for continuous editing
        break;
      case 'mixed':
        baseInterval = 5000; // Balanced interval for mixed editing
        break;
    }

    // Adjust based on editing speed
    if (pattern.averageEditingSpeed > 40) {
      baseInterval *= 0.8; // Faster typists get more frequent saves
    } else if (pattern.averageEditingSpeed < 20) {
      baseInterval *= 1.2; // Slower typists get less frequent saves
    }

    // Adjust based on save preference (learned from user behavior)
    switch (pattern.savePreference) {
      case 'frequent':
        baseInterval *= 0.7;
        break;
      case 'minimal':
        baseInterval *= 1.5;
        break;
      default: // moderate
        break;
    }

    return Math.max(2000, Math.min(15000, baseInterval)); // Clamp between 2-15 seconds
  }, []);

  // Determine if content should be saved
  const shouldSaveContent = useCallback((
    currentContent: string,
    pattern: UserEditingPattern | null
  ): SaveTriggerResult => {
    const hasChanges = currentContent !== lastContentRef.current;
    const timeSinceLastSave = saveSettings.lastSaveTime 
      ? Date.now() - saveSettings.lastSaveTime.getTime()
      : Infinity;

    // Manual save mode - never auto-save
    if (saveSettings.frequency === 'manual') {
      return { shouldSave: false, reason: 'none' };
    }

    if (!hasChanges) {
      return { shouldSave: false, reason: 'none' };
    }

    const currentWordCount = currentContent.split(/\s+/).filter(word => word.length > 0).length;
    const lastWordCount = lastContentRef.current.split(/\s+/).filter(word => word.length > 0).length;
    const wordsChanged = Math.abs(currentWordCount - lastWordCount);

    const settings = DEFAULT_INTERVALS[saveSettings.frequency];
    const adaptiveInterval = saveSettings.frequency === 'adaptive' 
      ? calculateAdaptiveInterval(pattern)
      : settings.interval;

    // Check word threshold
    if (wordsChanged >= settings.changeThreshold) {
      return { shouldSave: true, reason: 'threshold' };
    }

    // Check time interval
    if (timeSinceLastSave >= adaptiveInterval) {
      return { shouldSave: true, reason: 'interval' };
    }

    // Check pattern-based triggers (for adaptive mode)
    if (saveSettings.frequency === 'adaptive' && pattern) {
      // Save more frequently during burst editing sessions
      if (pattern.editingStyle === 'burst' && wordsChanged >= 10) {
        return { shouldSave: true, reason: 'pattern' };
      }
    }

    const nextSaveIn = adaptiveInterval - timeSinceLastSave;
    return { shouldSave: false, reason: 'none', nextSaveIn: Math.max(0, nextSaveIn) };
  }, [saveSettings, calculateAdaptiveInterval]);

  // Trigger save operation
  const triggerSave = useCallback(async (forceManual = false): Promise<boolean> => {
    try {
      const pattern = await loadUserPattern();
      const saveDecision = shouldSaveContent(content, pattern);

      if (forceManual || saveDecision.shouldSave) {
        // Update editing session data
        editingSessionRef.current.wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

        // Perform the save
        await onSave(content, noteId);
        
        // Update save settings
        const saveTime = new Date();
        setSaveSettings(prev => ({
          ...prev,
          lastSaveTime: saveTime,
          hasUnsavedChanges: false
        }));

        // Update last saved content
        lastContentRef.current = content;

        // Learn from user behavior if manual save
        if (forceManual && pattern) {
          const timeSinceLastSave = saveSettings.lastSaveTime 
            ? saveTime.getTime() - saveSettings.lastSaveTime.getTime()
            : 0;

          // Adjust save preference based on manual save timing
          let newPreference = pattern.savePreference;
          if (timeSinceLastSave < 5000) {
            newPreference = 'frequent';
          } else if (timeSinceLastSave > 20000) {
            newPreference = 'minimal';
          }

          const updatedPattern: UserEditingPattern = {
            ...pattern,
            savePreference: newPreference,
            sessionCount: pattern.sessionCount + 1
          };

          await saveUserPattern(updatedPattern);
          setSaveSettings(prev => ({ ...prev, userPattern: updatedPattern }));
        }

        // Track save analytics
        await logAnalyticsEvent('auto_save_triggered', {
          noteId,
          saveReason: forceManual ? 'manual' : saveDecision.reason,
          wordCount: editingSessionRef.current.wordCount,
          frequency: saveSettings.frequency
        });

        return true;
      }

      return false;
    } catch (error) {
      console.error('Auto-save failed:', error);
      
      // Track save failures
      await logAnalyticsEvent('auto_save_failed', {
        noteId,
        error: error instanceof Error ? error.message : 'Unknown error',
        frequency: saveSettings.frequency
      });

      return false;
    }
  }, [content, noteId, onSave]); // Simplified dependencies

  // Debounced auto-save function with stable dependencies
  const debouncedAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Access current save settings directly to avoid dependency issues
    const currentFrequency = saveSettings.frequency;
    if (currentFrequency === 'manual') {
      return; // Don't auto-save in manual mode
    }

    const pattern = saveSettings.userPattern;
    const adaptiveInterval = currentFrequency === 'adaptive' 
      ? calculateAdaptiveInterval(pattern)
      : DEFAULT_INTERVALS[currentFrequency].interval;

    const debounceDelay = Math.min(2000, adaptiveInterval / 3); // Debounce for 1/3 of interval

    saveTimeoutRef.current = setTimeout(() => {
      triggerSave(false);
    }, debounceDelay);
  }, [calculateAdaptiveInterval, triggerSave]); // Stable dependencies only

  // Update auto-save frequency
  const updateSaveFrequency = useCallback(async (frequency: AutoSaveSettings['frequency']) => {
    setSaveSettings(prev => ({ 
      ...prev, 
      frequency,
      currentInterval: frequency === 'adaptive' 
        ? calculateAdaptiveInterval(prev.userPattern)
        : DEFAULT_INTERVALS[frequency].interval
    }));

    // Track frequency changes
    await logAnalyticsEvent('save_frequency_changed', {
      noteId,
      oldFrequency: saveSettings.frequency,
      newFrequency: frequency
    });
  }, [noteId, saveSettings.frequency, calculateAdaptiveInterval]);

  // Initialize user pattern on mount
  useEffect(() => {
    const initializePattern = async () => {
      const pattern = await loadUserPattern();
      if (pattern) {
        setSaveSettings(prev => ({ 
          ...prev, 
          userPattern: pattern,
          currentInterval: calculateAdaptiveInterval(pattern)
        }));
      }
    };

    initializePattern();
  }, []); // Run only once on mount

  // Trigger auto-save when content changes
  useEffect(() => {
    const hasChanges = content !== lastContentRef.current;
    
    // Update unsaved changes state
    setSaveSettings(prev => ({ ...prev, hasUnsavedChanges: hasChanges }));

    // Only trigger auto-save if content actually changed and not in manual mode
    if (hasChanges) {
      lastContentRef.current = content; // Update the ref immediately
      
      // Check current frequency mode and trigger save if appropriate
      if (saveSettings.frequency !== 'manual') {
        debouncedAutoSave();
      }
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content]); // Only depend on content changes

  // Update editing session data when content changes
  useEffect(() => {
    if (content !== lastContentRef.current) {
      editingSessionRef.current.keystrokes += 1;
      
      // Detect pauses (no changes for 5+ seconds)
      const now = Date.now();
      if (now - editingSessionRef.current.startTime.getTime() > 5000) {
        editingSessionRef.current.pauseCount += 1;
        editingSessionRef.current.startTime = new Date();
      }
    }
  }, [content]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Save final editing pattern
      const sessionData = analyzeCurrentSession();
      if (sessionData.sessionLength && sessionData.sessionLength > 30) { // Only save meaningful sessions
        const finalPattern: UserEditingPattern = {
          averageEditingSpeed: sessionData.averageEditingSpeed || 30,
          sessionLength: sessionData.sessionLength || 300,
          editingStyle: sessionData.editingStyle || 'mixed',
          savePreference: saveSettings.userPattern?.savePreference || 'moderate',
          lastUpdated: new Date(),
          sessionCount: (saveSettings.userPattern?.sessionCount || 0) + 1
        };
        saveUserPattern(finalPattern);
      }
    };
  }, [analyzeCurrentSession, saveSettings.userPattern, saveUserPattern]);

  return {
    saveSettings,
    triggerSave: () => triggerSave(true), // Manual save
    hasUnsavedChanges: saveSettings.hasUnsavedChanges,
    updateSaveFrequency,
    getCurrentInterval: () => saveSettings.currentInterval,
    getNextSaveTime: () => {
      if (!saveSettings.lastSaveTime || saveSettings.frequency === 'manual') return null;
      return new Date(saveSettings.lastSaveTime.getTime() + saveSettings.currentInterval);
    }
  };
};
