import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
  Alert,
} from 'react-native';
import {
  Modal,
  Surface,
  Text,
  Button,
  IconButton,
  ProgressBar,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  instruction: string;
  component?: React.ReactNode;
  canProgress: boolean;
  requiredAction?: 'tap' | 'focus' | 'quality' | 'crop';
  qualityThreshold?: number;
}

interface ScannerTutorialProps {
  visible: boolean;
  onComplete: () => void;
  onSkip: () => void;
  cameraRef?: any;
  onQualityCheck?: (quality: number) => void;
}

// Tutorial analytics helper
const logTutorialEvent = async (eventName: string, parameters: any) => {
  try {
    // TODO: Add Firebase Analytics when package is installed
    console.log('Tutorial Analytics Event:', eventName, parameters);
  } catch (error) {
    console.warn('Tutorial analytics logging failed:', error);
  }
};

export const ScannerTutorial: React.FC<ScannerTutorialProps> = ({
  visible,
  onComplete,
  onSkip,
  cameraRef,
  onQualityCheck
}) => {
  const theme = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [userInteracted, setUserInteracted] = useState(false);
  const [qualityScore, setQualityScore] = useState(0);
  const [tutorialStartTime] = useState(Date.now());
  const [stepStartTime, setStepStartTime] = useState(Date.now());
  
  // Animation refs
  const slideAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(0.8)).current;

  const tutorialSteps: TutorialStep[] = [
    {
      id: 'welcome',
      title: 'Perfect Document Scanning',
      description: 'Get 95%+ OCR accuracy with our guided process',
      instruction: 'Welcome to NoteSpark AI! Let\'s learn how to capture documents perfectly.',
      canProgress: true,
    },
    {
      id: 'positioning',
      title: 'Position Your Document',
      description: 'Hold steady and tap to focus',
      instruction: 'Place your document in the frame and tap anywhere on the screen to focus the camera.',
      canProgress: userInteracted,
      requiredAction: 'tap',
    },
    {
      id: 'quality',
      title: 'Quality Optimization',
      description: 'Watch for green quality indicators',
      instruction: 'Ensure good lighting and clear focus. Look for the green quality indicator.',
      canProgress: qualityScore > 0.7,
      requiredAction: 'quality',
      qualityThreshold: 0.7,
    },
    {
      id: 'cropping',
      title: 'Precision Cropping',
      description: 'Select text areas for best results',
      instruction: 'After capturing, crop to select just the text area. This improves accuracy by 25%!',
      canProgress: true,
      requiredAction: 'crop',
    },
  ];

  // Pulse animation for interactive elements
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Slide transition animation
  useEffect(() => {
    // Fade out then fade in for smooth transition
    slideAnim.setValue(0);
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [currentStep, slideAnim]);

  // Track step progress
  useEffect(() => {
    setStepStartTime(Date.now());
    logTutorialEvent('tutorial_step_started', {
      stepId: tutorialSteps[currentStep].id,
      stepNumber: currentStep + 1,
      totalSteps: tutorialSteps.length,
    });
  }, [currentStep]);

  // Handle quality score updates
  useEffect(() => {
    if (onQualityCheck && qualityScore > 0) {
      onQualityCheck(qualityScore);
    }
  }, [qualityScore, onQualityCheck]);

  const handleNext = async () => {
    const step = tutorialSteps[currentStep];
    const timeSpent = Date.now() - stepStartTime;

    // Log step completion
    await logTutorialEvent('tutorial_step_completed', {
      stepId: step.id,
      stepNumber: currentStep + 1,
      timeSpent,
      userAction: step.requiredAction || 'navigation',
      qualityAchieved: step.requiredAction === 'quality' ? qualityScore : null,
    });

    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(currentStep + 1);
      // Reset interaction states for next step
      if (tutorialSteps[currentStep + 1].requiredAction === 'tap') {
        setUserInteracted(false);
      }
      if (tutorialSteps[currentStep + 1].requiredAction === 'quality') {
        setQualityScore(0);
      }
    } else {
      handleComplete();
    }
  };

  const handleSkip = async () => {
    await logTutorialEvent('tutorial_skipped', {
      currentStep: currentStep + 1,
      totalSteps: tutorialSteps.length,
      timeSpent: Date.now() - tutorialStartTime,
    });
    onSkip();
  };

  const handleComplete = async () => {
    const totalTime = Date.now() - tutorialStartTime;
    
    try {
      // Mark tutorial as completed
      await AsyncStorage.setItem('scanner_tutorial_completed', 'true');
      await AsyncStorage.setItem('scanner_tutorial_completion_date', new Date().toISOString());

      // Log completion analytics
      await logTutorialEvent('tutorial_completed', {
        totalTime,
        stepsCompleted: tutorialSteps.length,
        userSkipped: false,
        completionRate: 100,
      });

      onComplete();
    } catch (error) {
      console.error('Failed to save tutorial completion:', error);
      onComplete(); // Still complete the tutorial
    }
  };

  // Handle screen interactions based on tutorial step
  const handleScreenTap = () => {
    const step = tutorialSteps[currentStep];
    if (step.requiredAction === 'tap' && !userInteracted) {
      setUserInteracted(true);
      // Simulate camera focus
      if (cameraRef?.current) {
        // Add haptic feedback if available
        try {
          // TODO: Add haptic feedback
        } catch (error) {
          console.warn('Haptic feedback not available');
        }
      }
    }
  };

  // Simulate quality analysis (in real implementation, this would come from camera)
  const simulateQualityCheck = () => {
    if (tutorialSteps[currentStep].requiredAction === 'quality') {
      // Simulate improving quality over time
      const newQuality = Math.min(qualityScore + 0.1, 1.0);
      setQualityScore(newQuality);
    }
  };

  // Auto-simulate quality improvement for tutorial
  useEffect(() => {
    if (tutorialSteps[currentStep].requiredAction === 'quality') {
      const interval = setInterval(simulateQualityCheck, 1000);
      return () => clearInterval(interval);
    }
  }, [currentStep, qualityScore]);

  const currentStepData = tutorialSteps[currentStep];
  const progress = (currentStep + 1) / tutorialSteps.length;

  return (
    <Modal
      visible={visible}
      onDismiss={() => {}} // Prevent dismiss without user action
      contentContainerStyle={styles.modalContainer}
    >
      <SafeAreaView style={styles.container}>
        {/* Header with progress */}
        <Surface style={[styles.header, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.headerContent}>
            <Text variant="headlineSmall" style={styles.headerTitle}>
              Scanner Tutorial
            </Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              Step {currentStep + 1} of {tutorialSteps.length}
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        </Surface>

        {/* Main tutorial content */}
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.stepContainer,
              {
                opacity: slideAnim,
                transform: [
                  {
                    scale: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.95, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Step title and description */}
            <View style={styles.stepHeader}>
              <Text variant="headlineMedium" style={styles.stepTitle}>
                {currentStepData.title}
              </Text>
              <Text variant="bodyLarge" style={[styles.stepDescription, { color: theme.colors.onSurfaceVariant }]}>
                {currentStepData.description}
              </Text>
            </View>

            {/* Interactive area */}
            <View style={styles.interactiveArea}>
              {currentStepData.requiredAction === 'tap' && (
                <Animated.View
                  style={[
                    styles.tapTarget,
                    {
                      transform: [{ scale: pulseAnim }],
                      backgroundColor: userInteracted ? theme.colors.primary : theme.colors.outline,
                    },
                  ]}
                >
                  <IconButton
                    icon={userInteracted ? "check" : "camera-focus"}
                    size={40}
                    iconColor={userInteracted ? theme.colors.onPrimary : theme.colors.onSurface}
                    onPress={handleScreenTap}
                  />
                </Animated.View>
              )}

              {currentStepData.requiredAction === 'quality' && (
                <View style={styles.qualityIndicator}>
                  <ProgressBar
                    progress={qualityScore}
                    color={qualityScore > 0.7 ? theme.colors.primary : theme.colors.error}
                    style={styles.qualityBar}
                  />
                  <Text variant="bodyMedium" style={styles.qualityText}>
                    Quality: {Math.round(qualityScore * 100)}%
                    {qualityScore > 0.7 && " ✓ Perfect!"}
                  </Text>
                </View>
              )}

              {currentStepData.requiredAction === 'crop' && (
                <View style={styles.cropDemo}>
                  <View style={[styles.cropFrame, { borderColor: theme.colors.primary }]}>
                    <Text variant="bodySmall" style={styles.cropText}>
                      Document Area
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* Instruction text */}
            <Text variant="bodyMedium" style={styles.instruction}>
              {currentStepData.instruction}
            </Text>
          </Animated.View>
        </View>

        {/* Navigation controls */}
        <Surface style={[styles.footer, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <Button
            mode="outlined"
            onPress={handleSkip}
            style={styles.skipButton}
          >
            Skip Tutorial
          </Button>
          <Button
            mode="contained"
            onPress={handleNext}
            disabled={!currentStepData.canProgress}
            style={styles.nextButton}
          >
            {currentStep < tutorialSteps.length - 1 ? 'Next' : 'Start Scanning'}
          </Button>
        </Surface>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 24,
    width: '100%',
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'space-between',
    width: '100%',
    position: 'relative',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  stepDescription: {
    textAlign: 'center',
    lineHeight: 24,
  },
  interactiveArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  tapTarget: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  qualityIndicator: {
    width: '80%',
    alignItems: 'center',
  },
  qualityBar: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    marginBottom: 16,
  },
  qualityText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cropDemo: {
    width: 200,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    width: '100%',
    height: '100%',
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropText: {
    opacity: 0.7,
  },
  instruction: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipButton: {
    flex: 0.4,
  },
  nextButton: {
    flex: 0.5,
  },
});

export default ScannerTutorial;
