// Voice Input Component - Real-time speech-to-text interface
// Provides intuitive voice recording with visual feedback

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import {
  IconButton,
  Surface,
  Text,
  useTheme,
  ActivityIndicator,
  Button,
  Modal,
  Portal,
} from 'react-native-paper';
import VoiceToTextServiceInstance, {
  VoiceTranscriptionResult,
  VoiceSessionMetrics,
  VoiceSettings,
} from '../../services/VoiceToTextService';

const { width: screenWidth } = Dimensions.get('window');

interface VoiceInputProps {
  onTranscription: (text: string, isFinal: boolean) => void;
  onError?: (error: string) => void;
  onSessionComplete?: (metrics: VoiceSessionMetrics) => void;
  disabled?: boolean;
  settings?: Partial<VoiceSettings>;
}

interface VoiceInputState {
  isListening: boolean;
  isInitializing: boolean;
  currentText: string;
  volume: number;
  sessionDuration: number;
  wordCount: number;
  showSettings: boolean;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscription,
  onError,
  onSessionComplete,
  disabled = false,
  settings = {},
}) => {
  const theme = useTheme();
  const voiceService = VoiceToTextServiceInstance;

  // State management
  const [state, setState] = useState<VoiceInputState>({
    isListening: false,
    isInitializing: false,
    currentText: '',
    volume: 0,
    sessionDuration: 0,
    wordCount: 0,
    showSettings: false,
  });

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const volumeAnim = useRef(new Animated.Value(0)).current;
  const micIconAnim = useRef(new Animated.Value(0)).current;
  const durationTimer = useRef<NodeJS.Timeout | null>(null);

  // Update service settings when props change
  useEffect(() => {
    if (Object.keys(settings).length > 0) {
      voiceService.updateSettings(settings);
    }
  }, [settings]);

  // Session duration tracking
  useEffect(() => {
    if (state.isListening) {
      durationTimer.current = setInterval(() => {
        setState(prev => ({
          ...prev,
          sessionDuration: prev.sessionDuration + 1,
        }));
      }, 1000);
      (durationTimer.current as any)?.unref?.();
    } else {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
        durationTimer.current = null;
      }
    }

    return () => {
      if (durationTimer.current) {
        clearInterval(durationTimer.current);
      }
    };
  }, [state.isListening]);

  // Microphone pulse animation
  useEffect(() => {
    if (state.isListening) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();

      // Mic icon rotation
      Animated.timing(micIconAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      return () => {
        pulse.stop();
      };
    } else {
      pulseAnim.setValue(1);
      Animated.timing(micIconAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [state.isListening]);

  // Volume animation
  useEffect(() => {
    Animated.timing(volumeAnim, {
      toValue: state.volume,
      duration: 100,
      useNativeDriver: false,
    }).start();
  }, [state.volume]);

  // Voice event handlers
  const handleVoiceResult = (result: VoiceTranscriptionResult) => {
    console.log('Voice result received:', result);
    
    setState(prev => ({
      ...prev,
      currentText: result.text,
      wordCount: result.text.split(' ').filter((word: string) => word.length > 0).length,
    }));

    onTranscription(result.text, result.isFinal);
    // Analytics handled internally by voice service
  };

  const handleVoiceError = (error: string) => {
    console.error('Voice error:', error);
    setState(prev => ({ ...prev, isListening: false, isInitializing: false }));
    onError?.(error);
    
    Alert.alert(
      'Voice Recognition Error',
      error,
      [{ text: 'OK', onPress: () => {} }]
    );

    // Analytics handled internally by voice service
  };

  const handleVoiceComplete = (metrics: VoiceSessionMetrics) => {
    console.log('Voice session completed:', metrics);
    setState(prev => ({
      ...prev,
      isListening: false,
      currentText: '',
      sessionDuration: 0,
      wordCount: 0,
    }));

    onSessionComplete?.(metrics);

    // Analytics handled internally by voice service
  };

  const handleVolumeChange = (volume: number) => {
    setState(prev => ({ ...prev, volume }));
  };

  // Start voice recognition
  const startListening = async () => {
    if (disabled || state.isListening) return;

    setState(prev => ({ ...prev, isInitializing: true }));

    try {
      await voiceService.startListening(
        handleVoiceResult,
        handleVoiceError,
        handleVoiceComplete,
        handleVolumeChange
      );

      setState(prev => ({
        ...prev,
        isListening: true,
        isInitializing: false,
        currentText: '',
        sessionDuration: 0,
        wordCount: 0,
      }));

      // Analytics handled internally by voice service
    } catch (error) {
      setState(prev => ({ ...prev, isInitializing: false }));
      handleVoiceError('Voice service initialization failed');
    }
  };

  // Stop voice recognition
  const stopListening = async () => {
    if (!state.isListening) return;

    try {
      await voiceService.stopListening();
    } catch (error) {
      console.error('Error stopping voice recognition:', error);
    }
  };

  // Cancel voice recognition
  const cancelListening = async () => {
    if (!state.isListening) return;

    try {
      await voiceService.cancelListening();
      setState(prev => ({
        ...prev,
        isListening: false,
        currentText: '',
        sessionDuration: 0,
        wordCount: 0,
      }));

      // Analytics handled internally by voice service
    } catch (error) {
      console.error('Error canceling voice recognition:', error);
    }
  };

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get microphone icon based on state
  const getMicIcon = (): string => {
    if (state.isInitializing) return 'microphone-outline';
    if (state.isListening) return 'microphone';
    return 'microphone-outline';
  };

  // Get status text
  const getStatusText = (): string => {
    if (state.isInitializing) return 'Initializing...';
    if (state.isListening) return 'Listening...';
    return 'Tap to start';
  };

  // Open settings modal
  const openSettings = () => {
    setState(prev => ({ ...prev, showSettings: true }));
  };

  // Close settings modal
  const closeSettings = () => {
    setState(prev => ({ ...prev, showSettings: false }));
  };

  return (
    <View style={styles.container}>
      {/* Main Voice Button */}
      <Surface
        style={[
          styles.voiceButton,
          {
            backgroundColor: state.isListening 
              ? theme.colors.error 
              : theme.colors.primary,
          },
        ]}
        elevation={state.isListening ? 5 : 4}
      >
        <Animated.View
          style={[
            styles.voiceButtonInner,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        >
          {state.isInitializing ? (
            <ActivityIndicator size="large" color="white" />
          ) : (
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: micIconAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '10deg'],
                    }),
                  },
                ],
              }}
            >
              <IconButton
                icon={getMicIcon()}
                size={32}
                iconColor="white"
                onPress={state.isListening ? stopListening : startListening}
                disabled={disabled || state.isInitializing}
              />
            </Animated.View>
          )}
        </Animated.View>

        {/* Volume Indicator */}
        {state.isListening && (
          <Animated.View
            style={[
              styles.volumeIndicator,
              {
                backgroundColor: theme.colors.primary,
                opacity: volumeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
                transform: [
                  {
                    scale: volumeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.3],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </Surface>

      {/* Status and Info */}
      <View style={styles.statusContainer}>
        <Text
          variant="bodyMedium"
          style={[styles.statusText, { color: theme.colors.onSurface }]}
        >
          {getStatusText()}
        </Text>

        {state.isListening && (
          <View style={styles.sessionInfo}>
            <Text
              variant="bodySmall"
              style={[styles.sessionText, { color: theme.colors.onSurfaceVariant }]}
            >
              {formatDuration(state.sessionDuration)} • {state.wordCount} words
            </Text>
            
            {state.currentText.length > 0 && (
              <Text
                variant="bodySmall"
                style={[styles.currentText, { color: theme.colors.primary }]}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                "{state.currentText}"
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      {state.isListening && (
        <View style={styles.actionButtons}>
          <Button
            mode="outlined"
            onPress={cancelListening}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={stopListening}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
          >
            Done
          </Button>
        </View>
      )}

      {/* Settings Button */}
      {!state.isListening && (
        <IconButton
          icon="cog"
          size={20}
          iconColor={theme.colors.onSurfaceVariant}
          onPress={openSettings}
          style={styles.settingsButton}
        />
      )}

      {/* Settings Modal */}
      <Portal>
        <Modal
          visible={state.showSettings}
          onDismiss={closeSettings}
          contentContainerStyle={[
            styles.settingsModal,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <Text variant="headlineSmall" style={styles.settingsTitle}>
            Voice Settings
          </Text>
          
          <Text variant="bodyMedium" style={[styles.settingsInfo, { color: theme.colors.onSurfaceVariant }]}>
            Voice recognition settings will be available in the production version.
            Current mode: Mock Development Mode
          </Text>

          <Button mode="contained" onPress={closeSettings} style={styles.settingsCloseButton}>
            Close
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  voiceButtonInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeIndicator: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'transparent',
    opacity: 0.3,
  },
  statusContainer: {
    alignItems: 'center',
    marginTop: 12,
    minHeight: 60,
  },
  statusText: {
    fontWeight: '600',
    marginBottom: 4,
  },
  sessionInfo: {
    alignItems: 'center',
    maxWidth: screenWidth * 0.8,
  },
  sessionText: {
    marginBottom: 4,
  },
  currentText: {
    textAlign: 'center',
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  actionButton: {
    minWidth: 80,
  },
  actionButtonContent: {
    paddingHorizontal: 8,
  },
  settingsButton: {
    position: 'absolute',
    right: -40,
    top: 20,
  },
  settingsModal: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  settingsTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  settingsInfo: {
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  settingsCloseButton: {
    marginTop: 8,
  },
});

export default VoiceInput;
