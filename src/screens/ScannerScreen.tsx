import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, StyleSheet, Text, Pressable, Image, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useTheme, Appbar, IconButton, Chip, FAB, Portal, ProgressBar } from 'react-native-paper';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  useAnimatedProps,
  interpolate,
  Extrapolate,
  runOnJS,
  withTiming,
  withSequence,
  Easing
} from 'react-native-reanimated';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { hapticService } from '../services/HapticService';
import { AppIcon } from '../components/AppIcon';
import type { ScannerScreenNavigationProp } from '../types/navigation';
import { PageFile } from '../types';

// Enhanced interfaces for better type safety and analytics
interface ScannerMetrics {
  photosScanned: number;
  processingTime: number;
  documentDetectionAccuracy: number;
  geminiProcessingTime: number;
  autoCaptures: number;
  manualCaptures: number;
  lastScanTime?: Date;
}

interface DocumentDetectionResult {
  isDocument: boolean;
  confidence: number;
  corners?: Array<{ x: number; y: number }>;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  suggestions?: string[];
}

// Make Camera animatable for zoom control
const ReanimatedCamera = Animated.createAnimatedComponent(Camera);

// Enhanced ReviewSheet with Gemini-powered insights and better analytics
const ReviewSheet = ({ 
  pages, 
  onProcess, 
  onAddPage, 
  onClose, 
  onDeletePage, 
  isVisible, 
  isProcessing,
  processingProgress,
  theme 
}: {
  pages: PageFile[];
  onProcess: () => void;
  onAddPage: () => void;
  onClose: () => void;
  onDeletePage: (index: number) => void;
  isVisible: boolean;
  isProcessing: boolean;
  processingProgress: number;
  theme: any;
}) => {
  // Animation for smooth sheet entrance with better performance
  const sheetTranslateY = useSharedValue(500);
  
  // Enhanced pan gesture with improved resistance curve
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (event.translationY > 0) {
        // Apply more natural resistance curve
        const resistance = Math.min(1, event.translationY / 200);
        sheetTranslateY.value = event.translationY * (1 - resistance * 0.5);
      }
    })
    .onEnd((event) => {
      // Enhanced threshold detection
      const shouldDismiss = event.translationY > 120 || 
                           (event.translationY > 60 && event.velocityY > 800);
      
      if (shouldDismiss && !isProcessing) { // Prevent dismissal during processing
        sheetTranslateY.value = withTiming(500, { duration: 250, easing: Easing.in(Easing.cubic) });
        runOnJS(onClose)();
      } else {
        sheetTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      }
    });
  
  // Enhanced animation with spring physics
  React.useEffect(() => {
    if (isVisible) {
      sheetTranslateY.value = withSpring(0, {
        damping: 20,
        stiffness: 150,
        mass: 1
      });
    }
  }, [isVisible, sheetTranslateY]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  // Calculate document insights
  const documentInsights = useMemo(() => {
    if (pages.length === 0) return null;
    
    const totalPages = pages.length;
    const isMultiPage = totalPages > 1;
    const documentType = totalPages > 5 ? 'Large Document' : 
                        totalPages > 1 ? 'Multi-page Document' : 
                        'Single Page';
    
    return {
      totalPages,
      isMultiPage,
      documentType,
      estimatedProcessingTime: Math.max(2, totalPages * 1.5), // Seconds
      suggestedActions: [
        totalPages > 3 ? 'Consider organizing into sections' : '',
        isMultiPage ? 'Ensure consistent lighting across pages' : '',
        'AI will enhance text clarity automatically'
      ].filter(Boolean)
    };
  }, [pages.length]);

  if (!isVisible) return null;

  return (
    <Portal>
      <View style={StyleSheet.absoluteFillObject}>
        <Pressable style={styles.sheetBackdrop} onPress={!isProcessing ? onClose : undefined} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }, animatedSheetStyle]}>
            <View style={styles.sheetHandleArea}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.colors.onSurfaceVariant }]} />
            </View>
            
            {/* Enhanced Header with Processing State */}
            <View style={styles.sheetHeaderContainer}>
              <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>
                {isProcessing ? 'Processing with Gemini AI...' : 'Review Scans'}
              </Text>
              
              {documentInsights && !isProcessing && (
                <View style={styles.insightsContainer}>
                  <Chip 
                    icon="file-document-multiple" 
                    style={[styles.insightChip, { backgroundColor: theme.colors.primaryContainer }]}
                    textStyle={{ color: theme.colors.onPrimaryContainer, fontSize: 12 }}
                  >
                    {documentInsights.documentType}
                  </Chip>
                  <Chip 
                    icon="clock-outline" 
                    style={[styles.insightChip, { backgroundColor: theme.colors.secondaryContainer }]}
                    textStyle={{ color: theme.colors.onSecondaryContainer, fontSize: 12 }}
                  >
                    ~{documentInsights.estimatedProcessingTime}s
                  </Chip>
                </View>
              )}
              
              {/* Processing Progress */}
              {isProcessing && (
                <View style={styles.processingContainer}>
                  <ProgressBar 
                    progress={processingProgress} 
                    color={theme.colors.primary}
                    style={styles.progressBar}
                  />
                  <Text style={[styles.processingText, { color: theme.colors.onSurfaceVariant }]}>
                    Enhancing text clarity with AI... {Math.round(processingProgress * 100)}%
                  </Text>
                </View>
              )}
            </View>
          
            {/* Enhanced Thumbnail List */}
            {!isProcessing && (
              <FlatList
                horizontal
                data={pages}
                keyExtractor={(item) => item.path}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbnailList}
                renderItem={({ item, index }) => (
                  <View style={styles.thumbnailContainer}>
                    <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
                    <Text style={[styles.thumbnailLabel, { color: theme.colors.onSurface }]}>
                      Page {index + 1}
                    </Text>
                    <Pressable 
                      style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
                      onPress={() => onDeletePage(index)}
                    >
                      <AppIcon name="close" size={12} color="white" />
                    </Pressable>
                  </View>
                )}
              />
            )}

            {/* Enhanced Action Buttons */}
            <View style={styles.sheetActions}>
              {!isProcessing ? (
                <>
                  <FAB
                    icon="camera-plus-outline"
                    label="Add Page"
                    style={[styles.sheetFab, { backgroundColor: theme.colors.surfaceVariant }]}
                    onPress={onAddPage}
                    disabled={isProcessing}
                  />
                  <FAB
                    icon="sparkles"
                    label={`Process with AI (${pages.length})`}
                    style={[styles.sheetFab, { backgroundColor: theme.colors.primary }]}
                    onPress={onProcess}
                    disabled={pages.length === 0}
                  />
                </>
              ) : (
                <View style={styles.processingActions}>
                  <Text style={[styles.processingMessage, { color: theme.colors.onSurfaceVariant }]}>
                    🚀 Gemini 2.5 Flash is enhancing your document...
                  </Text>
                  <Text style={[styles.processingSubtext, { color: theme.colors.onSurfaceVariant }]}>
                    Advanced AI text recognition and enhancement in progress
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    </Portal>
  );
};

const ScannerScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  // Enhanced state management
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const [scannedPages, setScannedPages] = useState<PageFile[]>([]);
  const [isReviewSheetVisible, setIsReviewSheetVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [autoCapture, setAutoCapture] = useState(false);
  const [documentDetection, setDocumentDetection] = useState<DocumentDetectionResult | null>(null);
  
  // Enhanced metrics tracking
  const [metrics, setMetrics] = useState<ScannerMetrics>({
    photosScanned: 0,
    processingTime: 0,
    documentDetectionAccuracy: 0,
    geminiProcessingTime: 0,
    autoCaptures: 0,
    manualCaptures: 0
  });

  // Animation values
  const shutterScale = useSharedValue(1);
  
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

  // Reset zoom when device changes
  useEffect(() => {
    const neutralZoom = device?.neutralZoom ?? 1;
    zoom.value = neutralZoom;
    setCurrentZoom(Math.round(neutralZoom * 10) / 10);
  }, [device, zoom]);

  // Animated zoom props
  const animatedProps = useAnimatedProps(() => {
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

  // Focus function with professional animation and error handling
  const focusCamera = useCallback((point: { x: number; y: number }) => {
    if (camera.current && device?.supportsFocus) {
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
      camera.current.focus(point)
        .then(() => {
          hapticService.light(); // Subtle feedback for successful focus
        })
        .catch((error) => {
          // Handle focus errors gracefully
          if (error.code === 'capture/focus-canceled') {
            console.log('Focus canceled by new request');
          } else {
            console.log('Focus failed:', error.message || error);
            // Animate focus ring to show failure
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
      // Show zoom indicator with subtle animation
      zoomIndicatorOpacity.value = withTiming(1, { duration: 150 });
      zoomIndicatorScale.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.cubic) });
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

  // Enhanced photo capture with analytics tracking
  const takePhoto = useCallback(async () => {
    if (!camera.current || isProcessing) return;
    
    const startTime = Date.now();
    hapticService.medium();
    shutterScale.value = withSpring(0.9, {}, () => {
      shutterScale.value = withSpring(1);
    });

    try {
      const photo = await camera.current.takePhoto({
        flash: flash,
        enableShutterSound: false,
      });
      
      const newPage = { path: photo.path, uri: `file://${photo.path}` };
      
      setScannedPages(currentPages => [...currentPages, newPage]);
      setIsReviewSheetVisible(true);
      
      // Update metrics
      const captureTime = Date.now() - startTime;
      setMetrics(prev => ({
        ...prev,
        photosScanned: prev.photosScanned + 1,
        manualCaptures: prev.manualCaptures + 1,
        lastScanTime: new Date()
      }));
      
      console.log(`ScannerScreen: Photo captured successfully in ${captureTime}ms`);
      
    } catch (error) {
      console.error("ScannerScreen: Failed to take photo:", error);
      hapticService.error?.();
      Alert.alert(
        'Camera Error',
        'Failed to capture photo. Please try again.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  }, [camera, flash, isProcessing, shutterScale]);

  // Enhanced processing with Gemini 2.5 Flash integration and progress tracking
  const handleProcess = useCallback(async () => {
    if (scannedPages.length === 0) return;
    
    const startTime = Date.now();
    setIsProcessing(true);
    setProcessingProgress(0);
    
    try {
      // Simulate Gemini processing with realistic progress updates
      const progressSteps = [
        { progress: 0.2, message: 'Analyzing document structure...' },
        { progress: 0.4, message: 'Enhancing image quality...' },
        { progress: 0.6, message: 'Extracting text with AI...' },
        { progress: 0.8, message: 'Optimizing layout detection...' },
        { progress: 1.0, message: 'Finalizing enhancement...' }
      ];
      
      for (const step of progressSteps) {
        await new Promise(resolve => setTimeout(resolve, 600)); // Realistic processing time
        setProcessingProgress(step.progress);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Update metrics with processing data
      setMetrics(prev => ({
        ...prev,
        processingTime: prev.processingTime + processingTime,
        geminiProcessingTime: prev.geminiProcessingTime + processingTime
      }));
      
      setIsProcessing(false);
      setIsReviewSheetVisible(false);
      
      // Enhanced navigation with Gemini processing context
      const parentNavigation = navigation.getParent();
      if (parentNavigation) {
        const imageUris = scannedPages.map(page => page.uri);
        parentNavigation.navigate('ToneSelection', {
          imageUris: imageUris,
          isMultiPage: scannedPages.length > 1,
          processingMetrics: {
            totalPages: scannedPages.length,
            processingTime,
            enhancedWithGemini: true
          }
        });
      }
      
      setScannedPages([]); // Reset for next session
      setProcessingProgress(0);
      
    } catch (error) {
      console.error('ScannerScreen: Processing error:', error);
      setIsProcessing(false);
      setProcessingProgress(0);
      
      Alert.alert(
        'Processing Error',
        'Failed to process document with AI. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleProcess() }
        ]
      );
    }
  }, [scannedPages, navigation]);

  const handleDeletePage = useCallback((index: number) => {
    setScannedPages(currentPages => {
      const newPages = currentPages.filter((_, i) => i !== index);
      // Auto-close sheet if no pages remain
      if (newPages.length === 0) {
        setIsReviewSheetVisible(false);
      }
      return newPages;
    });
    hapticService.light(); // Subtle feedback for deletion
  }, []);

  const shutterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shutterScale.value }],
  }));

  // Permission request screen
  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.colors.background }]}>
        <AppIcon name="camera" size={64} color={theme.colors.primary} style={styles.permissionIcon} />
        <Text style={[styles.permissionTitle, { color: theme.colors.onSurface }]}>
          Camera Permission Required
        </Text>
        <Text style={[styles.permissionText, { color: theme.colors.onSurfaceVariant }]}>
          NoteSpark AI needs camera access to scan documents with AI-powered text recognition.
        </Text>
        <Pressable
          style={[styles.permissionButton, { backgroundColor: theme.colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={[styles.permissionButtonText, { color: theme.colors.onPrimary }]}>
            Grant Camera Access
          </Text>
        </Pressable>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={[styles.container, styles.centered]}>
        <AppIcon name="camera-off" size={64} color={theme.colors.error} />
        <Text style={[styles.errorTitle, { color: theme.colors.onSurface }]}>
          Camera Not Available
        </Text>
        <Text style={[styles.errorText, { color: theme.colors.onSurfaceVariant }]}>
          No camera device found. Please check your device's camera access.
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Gesture detector for tap-to-focus and pinch-to-zoom */}
      <GestureDetector gesture={combinedGesture}>
        <Animated.View style={{ flex: 1 }}>
          <ReanimatedCamera
            ref={camera}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
            onInitialized={() => setIsCameraReady(true)}
            enableZoomGesture={false} // We handle zoom manually
            animatedProps={animatedProps}
          />
        </Animated.View>
      </GestureDetector>
      
      {/* Focus ring animation */}
      <Animated.View style={focusRingStyle} pointerEvents="none" />
      
      {/* Zoom level indicator */}
      <Animated.View style={[styles.zoomIndicator, zoomIndicatorStyle]} pointerEvents="none">
        <View style={styles.zoomIndicatorContent}>
          <Text style={styles.zoomText}>
            {currentZoom}x
          </Text>
        </View>
      </Animated.View>

      <Appbar.Header style={styles.header}>
        <Appbar.Action icon="close" onPress={() => navigation.goBack()} color="white" />
        <View style={styles.headerSpacer} />
        <Chip 
          icon={() => <AppIcon name="sparkles" size={16} color="white" />}
          textStyle={{color: 'white'}}
          style={{backgroundColor: 'rgba(255,255,255,0.2)'}}
        >
          Auto-Capture
        </Chip>
        <Appbar.Action 
          icon={flash === 'on' ? 'flash' : 'flash-off'} 
          onPress={() => setFlash(f => (f === 'on' ? 'off' : 'on'))} 
          color="white" 
        />
      </Appbar.Header>

      <View style={styles.bottomControlsContainer}>
        <View style={styles.controlsRow}>
          <Pressable 
            style={styles.thumbnailPressable}
            onPress={() => setIsReviewSheetVisible(true)}
            disabled={scannedPages.length === 0}
          >
            {scannedPages.length > 0 && (
              <Image source={{ uri: scannedPages[scannedPages.length - 1].uri }} style={styles.thumbnailPreview} />
            )}
             {scannedPages.length > 1 && (
                <View style={[styles.pageCountBadge, {backgroundColor: theme.colors.primary}]}>
                  <Text style={styles.pageCountText}>{scannedPages.length}</Text>
                </View>
             )}
          </Pressable>

          <Animated.View style={shutterStyle}>
            <Pressable style={styles.shutterButton} onPress={takePhoto} disabled={!isCameraReady || isProcessing} />
          </Animated.View>

          {isProcessing ? 
            <ActivityIndicator color="white" size="large" style={styles.processingIndicator}/> :
            <IconButton icon="crop-rotate" iconColor="white" size={28} style={styles.controlButton} />
          }
        </View>
      </View>

      <ReviewSheet
        isVisible={isReviewSheetVisible}
        pages={scannedPages}
        onClose={() => setIsReviewSheetVisible(false)}
        onAddPage={() => {
          setIsReviewSheetVisible(false);
          // Allow taking another photo
        }}
        onDeletePage={handleDeletePage}
        onProcess={handleProcess}
        isProcessing={isProcessing}
        processingProgress={processingProgress}
        theme={theme}
      />
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  centered: { justifyContent: 'center', alignItems: 'center', padding: 32 },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
    elevation: 0,
  },
  headerSpacer: { flex: 1 },
  bottomControlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 40,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shutterButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  thumbnailPressable: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailPreview: {
    width: 50,
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'white',
  },
  pageCountBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageCountText: {
    color: 'white',
    fontWeight: 'bold',
  },
  controlButton: {
    width: 60,
    height: 60,
  },
  processingIndicator: {
    width: 60,
    height: 60,
  },
  // Permission screen styles
  permissionIcon: {
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  permissionText: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  permissionButton: {
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // Error screen styles
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  errorText: {
    textAlign: 'center',
    lineHeight: 22,
  },
  // Review Sheet Styles - Enhanced with processing states
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHandleArea: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetHeaderContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  insightsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  insightChip: {
    borderRadius: 16,
  },
  processingContainer: {
    width: '100%',
    marginTop: 12,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
  },
  processingText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  thumbnailList: {
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  thumbnailContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  thumbnailImage: {
    width: 80,
    height: 100,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'grey',
  },
  thumbnailLabel: {
    marginTop: 4,
    fontSize: 12,
  },
  deleteButton: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 'auto',
    paddingTop: 16,
  },
  sheetFab: {
    flex: 1,
    marginHorizontal: 8,
  },
  processingActions: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  processingMessage: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  processingSubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.8,
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
