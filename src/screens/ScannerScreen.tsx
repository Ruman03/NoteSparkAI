import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Pressable, Image, FlatList, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { useTheme, Appbar, IconButton, Chip, FAB, Portal } from 'react-native-paper';
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

// Make Camera animatable for zoom control
const ReanimatedCamera = Animated.createAnimatedComponent(Camera);

// A modern, draggable bottom sheet for reviewing scanned pages
const ReviewSheet = ({ pages, onProcess, onAddPage, onClose, onDeletePage, isVisible, theme }: {
  pages: PageFile[];
  onProcess: () => void;
  onAddPage: () => void;
  onClose: () => void;
  onDeletePage: (index: number) => void;
  isVisible: boolean;
  theme: any;
}) => {
  // Animation for smooth sheet entrance
  const sheetTranslateY = useSharedValue(500); // Start below screen
  const sheetOpacity = useSharedValue(0);
  
  // Handle pan gesture for swipe down to dismiss
  const handlePanGesture = useCallback((translationY: number, velocityY: number) => {
    'worklet';
    
    // If swiping down with sufficient distance or velocity, dismiss
    if (translationY > 100 || velocityY > 500) {
      sheetTranslateY.value = withTiming(500, { duration: 250, easing: Easing.in(Easing.cubic) });
      sheetOpacity.value = withTiming(0, { duration: 200 });
      runOnJS(onClose)();
    } else {
      // Snap back to position
      sheetTranslateY.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) });
      sheetOpacity.value = withTiming(1, { duration: 150 });
    }
  }, [onClose, sheetTranslateY, sheetOpacity]);

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow downward movement
      if (event.translationY > 0) {
        sheetTranslateY.value = event.translationY;
        // Fade out as user drags down
        sheetOpacity.value = Math.max(0.3, 1 - (event.translationY / 300));
      }
    })
    .onEnd((event) => {
      runOnJS(handlePanGesture)(event.translationY, event.velocityY);
    });
  
  // Animate sheet when visibility changes
  React.useEffect(() => {
    if (isVisible) {
      sheetTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      sheetOpacity.value = withTiming(1, { duration: 250 });
    } else {
      sheetTranslateY.value = withTiming(500, { duration: 250, easing: Easing.in(Easing.cubic) });
      sheetOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isVisible, sheetTranslateY, sheetOpacity]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
    opacity: sheetOpacity.value,
  }));

  if (!isVisible) return null;

  return (
    <Portal>
      <View style={StyleSheet.absoluteFillObject}>
        <Pressable style={styles.sheetBackdrop} onPress={onClose} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.sheetContainer, { backgroundColor: theme.colors.surface }, animatedSheetStyle]}>
            <View style={styles.sheetHandleArea}>
              <View style={styles.sheetHandle} />
            </View>
            <Text style={[styles.sheetTitle, { color: theme.colors.onSurface }]}>Review Scans</Text>
          
          <FlatList
            horizontal
            data={pages}
            keyExtractor={(item) => item.path}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailList}
            renderItem={({ item, index }) => (
              <View style={styles.thumbnailContainer}>
                <Image source={{ uri: item.uri }} style={styles.thumbnailImage} />
                <Text style={[styles.thumbnailLabel, { color: theme.colors.onSurface }]}>Page {index + 1}</Text>
                <Pressable 
                  style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
                  onPress={() => onDeletePage(index)}
                >
                  <AppIcon name="close" size={12} color="white" />
                </Pressable>
              </View>
            )}
          />

          <View style={styles.sheetActions}>
            <FAB
              icon="camera-plus-outline"
              label="Add Page"
              style={[styles.sheetFab, { backgroundColor: theme.colors.surfaceVariant }]}
              onPress={onAddPage}
            />
            <FAB
              icon="arrow-right"
              label={`Process ${pages.length} Page(s)`}
              style={[styles.sheetFab, { backgroundColor: theme.colors.primary }]}
              onPress={onProcess}
            />
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
  
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [flash, setFlash] = useState<'on' | 'off'>('off');
  const [scannedPages, setScannedPages] = useState<PageFile[]>([]);
  const [isReviewSheetVisible, setIsReviewSheetVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number>(1);

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

  const takePhoto = useCallback(async () => {
    if (!camera.current || isProcessing) return;
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
      setIsReviewSheetVisible(true); // Automatically open review sheet after a scan
    } catch (e) {
      console.error("Failed to take photo:", e);
    }
  }, [camera, flash, isProcessing, shutterScale]);

  const handleProcess = useCallback(async () => {
    if (scannedPages.length === 0) return;
    setIsProcessing(true);
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessing(false);
    setIsReviewSheetVisible(false);
    
    // Navigate to tone selection with the scanned pages
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      const imageUris = scannedPages.map(page => page.uri);
      parentNavigation.navigate('ToneSelection', {
        imageUris: imageUris,
        isMultiPage: scannedPages.length > 1,
      });
    }
    setScannedPages([]); // Reset for next session

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
  // Review Sheet Styles
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'grey',
    alignSelf: 'center',
    marginBottom: 10,
  },
  sheetHandleArea: {
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  thumbnailList: {
    paddingHorizontal: 8,
  },
  thumbnailContainer: {
    marginHorizontal: 8,
    alignItems: 'center',
    position: 'relative',
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
    top: -6,
    right: -6,
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
