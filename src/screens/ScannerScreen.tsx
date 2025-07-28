import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
  GestureResponderEvent,
} from 'react-native';
import { 
  Button, 
  Card, 
  Title, 
  Paragraph, 
  ActivityIndicator, 
  useTheme,
  Surface,
  IconButton,
  FAB,
} from 'react-native-paper';
import { useCameraDevice, Camera, useCameraPermission, CameraProps } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import textRecognition from '@react-native-ml-kit/text-recognition';
import { RootStackParamList } from '../types/navigation';
import { hapticService } from '../services/HapticService';
import Config from 'react-native-config';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, { 
  useSharedValue, 
  useAnimatedProps, 
  interpolate,
  Extrapolate,
  runOnJS,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';

// Make Camera animatable for zoom control
Reanimated.addWhitelistedNativeProps({
  zoom: true,
});
const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

type ScannerScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;

const ScannerScreen: React.FC = () => {
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const theme = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [currentZoom, setCurrentZoom] = useState<number>(1); // State for zoom display
  
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Zoom functionality
  const zoom = useSharedValue(device?.neutralZoom ?? 1);
  const zoomOffset = useSharedValue(0);

  // Focus ring animation states
  const focusRingScale = useSharedValue(0);
  const focusRingOpacity = useSharedValue(0);
  const focusRingX = useSharedValue(0);
  const focusRingY = useSharedValue(0);

  // Zoom level indicator animation
  const zoomIndicatorOpacity = useSharedValue(0);
  const zoomIndicatorScale = useSharedValue(0.8);

  // Animated zoom props
  const animatedProps = useAnimatedProps<CameraProps>(() => {
    const minZoom = device?.minZoom ?? 1;
    const maxZoom = Math.min(device?.maxZoom ?? 10, 10); // Clamp max zoom to reasonable value
    const clampedZoom = Math.max(Math.min(zoom.value, maxZoom), minZoom);
    
    return {
      zoom: clampedZoom,
    };
  }, [device?.minZoom, device?.maxZoom, zoom]);

  // Focus ring animated style
  const focusRingStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute' as const,
      left: focusRingX.value - 40, // Center the 80px ring
      top: focusRingY.value - 40,
      width: 80,
      height: 80,
      borderRadius: 40,
      borderWidth: 2,
      borderColor: '#FFFFFF',
      backgroundColor: 'transparent',
      transform: [{ scale: focusRingScale.value }],
      opacity: focusRingOpacity.value,
      zIndex: 1000,
    };
  });

  // Zoom indicator animated style
  const zoomIndicatorStyle = useAnimatedStyle(() => {
    return {
      opacity: zoomIndicatorOpacity.value,
      transform: [{ scale: zoomIndicatorScale.value }],
    };
  });

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
    return () => setIsActive(false);
  }, [hasPermission, requestPermission]);

  // Reset zoom when device changes
  useEffect(() => {
    const neutralZoom = device?.neutralZoom ?? 1;
    zoom.value = neutralZoom;
    setCurrentZoom(Math.round(neutralZoom * 10) / 10);
  }, [device, zoom]);

  const animateCapture = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Focus function with professional animation and error handling
  const focusCamera = useCallback((point: { x: number; y: number }) => {
    if (cameraRef.current && device?.supportsFocus) {
      // Set focus ring position
      focusRingX.value = point.x;
      focusRingY.value = point.y;
      
      // Animate focus ring appearance
      focusRingScale.value = withSequence(
        withTiming(1.2, { duration: 150, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 150, easing: Easing.inOut(Easing.cubic) })
      );
      focusRingOpacity.value = withSequence(
        withTiming(1, { duration: 150 }),
        withTiming(0.8, { duration: 300 }),
        withTiming(0, { duration: 500 })
      );

      // Attempt focus
      cameraRef.current.focus(point)
        .then(() => {
          hapticService.light(); // Subtle feedback for successful focus
        })
        .catch((error) => {
          // Handle focus errors gracefully
          if (error.code === 'capture/focus-canceled') {
            // Focus was canceled by another focus request - this is normal
            console.log('Focus canceled by new request');
          } else {
            console.log('Focus failed:', error.message || error);
            // Animate focus ring to show failure (red tint)
            focusRingOpacity.value = withSequence(
              withTiming(0.9, { duration: 100 }),
              withTiming(0, { duration: 400 })
            );
          }
        });
    }
  }, [device?.supportsFocus, focusRingX, focusRingY, focusRingScale, focusRingOpacity]);

  // Tap gesture for focus
  const tapGesture = Gesture.Tap()
    .onEnd((event) => {
      runOnJS(focusCamera)({
        x: event.x,
        y: event.y,
      });
    });

  // Pinch gesture for zoom with professional zoom indicator
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      zoomOffset.value = zoom.value;
      // Show zoom indicator
      zoomIndicatorOpacity.value = withTiming(1, { duration: 200 });
      zoomIndicatorScale.value = withSpring(1, { damping: 15, stiffness: 300 });
    })
    .onUpdate((event) => {
      const minZoom = device?.minZoom ?? 1;
      const maxZoom = Math.min(device?.maxZoom ?? 10, 10);
      
      const z = zoomOffset.value * event.scale;
      zoom.value = interpolate(
        z,
        [1, 10],
        [minZoom, maxZoom],
        Extrapolate.CLAMP,
      );
      
      // Update React state for zoom display
      runOnJS(setCurrentZoom)(Math.round(zoom.value * 10) / 10);
    })
    .onEnd(() => {
      // Hide zoom indicator after a delay
      zoomIndicatorOpacity.value = withSequence(
        withTiming(1, { duration: 100 }),
        withTiming(0, { duration: 800 })
      );
      zoomIndicatorScale.value = withTiming(0.8, { duration: 800 });
    });

  // Combined gesture
  const combinedGesture = Gesture.Simultaneous(tapGesture, pinchGesture);

  const capturePhoto = async () => {
    if (!device || !cameraRef.current) {
      Alert.alert('Error', 'Camera device not available');
      return;
    }

    hapticService.medium();
    setIsProcessing(true);
    animateCapture();
    
    try {
      const photoOptions: any = {};
      
      if (device.hasFlash) {
        photoOptions.flash = flashMode;
      }
      
      const photo = await cameraRef.current.takePhoto(photoOptions);
      console.log('Photo captured:', photo.path);

      const photoPath = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      
      try {
        const ocrResult = await textRecognition.recognize(photoPath);
        
        if (ocrResult && ocrResult.text && ocrResult.text.trim()) {
          hapticService.success();
          setExtractedText(ocrResult.text);
          setShowResults(true);
        } else {
          hapticService.error();
          Alert.alert(
            'No Text Found',
            'Could not detect any text in the document. Please ensure the document is well-lit and clearly visible.',
            [{ text: 'Try Again', onPress: () => {} }]
          );
        }
      } catch (ocrError) {
        console.error('OCR Error:', ocrError);
        hapticService.error();
        Alert.alert(
          'Processing Error',
          'Failed to extract text from the image. Please try again.',
          [{ text: 'Try Again', onPress: () => {} }]
        );
      }
    } catch (error) {
      console.error('Capture error:', error);
      hapticService.error();
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processWithAI = () => {
    if (!extractedText.trim()) {
      Alert.alert('Error', 'No text available to process');
      return;
    }

    navigation.navigate('ToneSelection', { extractedText });
  };

  const retryCapture = () => {
    setShowResults(false);
    setExtractedText('');
    setIsActive(true);
  };

  const toggleFlash = () => {
    const modes: ('auto' | 'on' | 'off')[] = ['auto', 'on', 'off'];
    const currentIndex = modes.indexOf(flashMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setFlashMode(modes[nextIndex]);
  };

  const getFlashIcon = () => {
    switch (flashMode) {
      case 'on': return 'flash';
      case 'off': return 'flash-off';  
      case 'auto': return 'flash-auto';
      default: return 'flash-auto';
    }
  };

  // Permission request screen
  if (!hasPermission) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.permissionContainer}>
          <Surface style={[styles.permissionCard, { backgroundColor: theme.colors.surface }]} elevation={4}>
            <Icon name="camera" size={64} color={theme.colors.primary} style={styles.permissionIcon} />
            <Title style={[styles.permissionTitle, { color: theme.colors.onSurface }]}>
              Camera Permission Required
            </Title>
            <Paragraph style={[styles.permissionText, { color: theme.colors.onSurfaceVariant }]}>
              NoteSpark AI needs camera access to scan and digitize your documents with AI-powered text recognition.
            </Paragraph>
            <Button
              mode="contained"
              onPress={requestPermission}
              style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary }}
            >
              Grant Camera Access
            </Button>
          </Surface>
        </View>
      </SafeAreaView>
    );
  }

  // No camera device available
  if (!device) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.errorContainer}>
          <Icon name="camera-off" size={64} color={theme.colors.error} />
          <Title style={[styles.errorTitle, { color: theme.colors.onSurface }]}>
            Camera Not Available
          </Title>
          <Paragraph style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
            No camera device found. Please check your device's camera access.
          </Paragraph>
        </View>
      </SafeAreaView>
    );
  }

  // Results screen
  if (showResults && extractedText) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Surface style={[styles.resultsHeader, { backgroundColor: theme.colors.surface }]} elevation={2}>
          <View style={styles.resultsHeaderContent}>
            <IconButton
              icon="arrow-left"
              size={24}
              iconColor={theme.colors.onSurface}
              onPress={retryCapture}
            />
            <Title style={[styles.resultsTitle, { color: theme.colors.onSurface }]}>
              Extracted Text
            </Title>
            {/* Spacer for balanced layout */}
            <View style={{ width: 48 }} />
          </View>
        </Surface>

        <View style={styles.resultsContent}>
          <Card style={[styles.textCard, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Card.Content style={styles.textCardContent}>
              <Text style={[styles.extractedText, { color: theme.colors.onSurface }]}>
                {extractedText}
              </Text>
            </Card.Content>
          </Card>

          <View style={styles.resultsActions}>
            <Button
              mode="outlined"
              onPress={retryCapture}
              style={[styles.actionButton, styles.retryButton]}
              icon="camera-retake"
            >
              Scan Again
            </Button>
            <Button
              mode="contained"
              onPress={processWithAI}
              style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
              labelStyle={{ color: theme.colors.onPrimary }}
              icon="robot"
            >
              Process with AI
            </Button>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Camera screen
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Gesture detector for tap-to-focus and pinch-to-zoom */}
      <GestureDetector gesture={combinedGesture}>
        <ReanimatedCamera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={isActive}
          photo={true}
          enableZoomGesture={false} // We handle zoom manually
          animatedProps={animatedProps}
        />
      </GestureDetector>
      
      {/* Focus ring animation */}
      <Reanimated.View style={focusRingStyle} pointerEvents="none" />
      
      {/* Zoom level indicator */}
      <Reanimated.View style={[styles.zoomIndicator, zoomIndicatorStyle]} pointerEvents="none">
        <View style={styles.zoomIndicatorContent}>
          <Text style={styles.zoomText}>
            {currentZoom}x
          </Text>
        </View>
      </Reanimated.View>
      
      {/* Header with controls */}
      <SafeAreaView style={styles.cameraOverlay}>
        <Surface style={[styles.cameraHeader, { backgroundColor: 'rgba(0,0,0,0.3)' }]} elevation={0}>
          <IconButton
            icon="arrow-left"
            size={24}
            iconColor="white"
            onPress={() => navigation.goBack()}
          />
          <Title style={styles.cameraTitle}>Scan Document</Title>
          {/* Spacer for balanced layout */}
          <View style={{ width: 48 }} />
        </Surface>

        {/* Document frame overlay */}
        <View style={styles.frameContainer}>
          <View style={styles.documentFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
          <Text style={styles.instructionText}>
            Position document within the frame
          </Text>
        </View>
      </SafeAreaView>

      {/* Capture controls - Perfect centering with absolute positioning */}
      <View style={styles.bottomControlsContainer}>
        {isProcessing ? (
          <View style={styles.processingOverlay}>
            <Surface style={styles.processingContainer} elevation={4}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.processingText, { color: theme.colors.onSurface }]}>
                Processing document...
              </Text>
            </Surface>
          </View>
        ) : (
          <>
            <Animated.View style={[styles.captureButton, { 
              backgroundColor: theme.colors.primary,
              transform: [{ scale: scaleAnim }] 
            }]}>
              <IconButton
                icon="camera"
                size={32}
                iconColor={theme.colors.onPrimary}
                onPress={capturePhoto}
                style={{ margin: 0 }}
              />
            </Animated.View>
            
            {/* Flash toggle button positioned to the right */}
            <View style={styles.flashButton}>
              <IconButton
                icon={getFlashIcon()}
                size={20}
                iconColor="white"
                onPress={toggleFlash}
              />
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cameraTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  frameContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  documentFrame: {
    width: screenWidth * 0.8,
    height: screenHeight * 0.5,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: 'white',
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  instructionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  // Bottom controls container - acts as the bottom bar
  bottomControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  // Perfect centering for main capture button
  captureButton: {
    position: 'absolute',
    left: '50%',
    marginLeft: -35, // Half of width (70/2) to center perfectly
    bottom: 25,
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  // Flash button positioned to the side
  flashButton: {
    position: 'absolute',
    right: 30,
    bottom: 40,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.95)',
    minWidth: 200,
    justifyContent: 'center',
  },
  processingText: {
    marginLeft: 16,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  // Permission screen styles
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionCard: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  permissionIcon: {
    marginBottom: 24,
    alignSelf: 'center',
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  permissionText: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    borderRadius: 24,
    paddingHorizontal: 16,
  },
  // Error screen styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
    fontWeight: 'bold',
  },
  errorText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  // Results screen styles
  resultsHeader: {
    paddingVertical: 8,
  },
  resultsHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  resultsTitle: {
    fontWeight: 'bold',
  },
  resultsContent: {
    flex: 1,
    padding: 16,
  },
  textCard: {
    flex: 1,
    marginBottom: 16,
    borderRadius: 16,
  },
  textCardContent: {
    padding: 20,
  },
  extractedText: {
    fontSize: 16,
    lineHeight: 24,
  },
  resultsActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 24,
  },
  retryButton: {
    borderWidth: 1.5,
  },
  // Focus and zoom animation styles
  zoomIndicator: {
    position: 'absolute',
    top: 80, // Position below status bar and header
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  zoomIndicatorContent: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  zoomText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ScannerScreen;
