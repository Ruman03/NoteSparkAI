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
  ScrollView,
  Modal,
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
  Chip,
  Switch,
  Divider,
} from 'react-native-paper';
import { useCameraDevice, Camera, useCameraPermission, CameraProps } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import textRecognition from '@react-native-ml-kit/text-recognition';
import { ScannerScreenNavigationProp } from '../types/navigation';
import { ScannedPage, ScanMode, PageProcessingProgress } from '../types';
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
import VisionService, { VisionResult } from '../services/VisionService';
import ImageCroppingService, { CropResult } from '../services/ImageCroppingService';
import ScannerTutorial from '../components/tutorial/ScannerTutorial';
import PageThumbnailGallery from '../components/PageThumbnailGallery';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AIService } from '../services/AIService';

// Make Camera animatable for zoom control
Reanimated.addWhitelistedNativeProps({
  zoom: true,
});
const ReanimatedCamera = Reanimated.createAnimatedComponent(Camera);

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const ScannerScreen: React.FC = () => {
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const theme = useTheme();
  const { hasPermission, requestPermission } = useCameraPermission();
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [extractedText, setExtractedText] = useState<string>('');
  const [showResults, setShowResults] = useState<boolean>(false);
  const [flashMode, setFlashMode] = useState<'auto' | 'on' | 'off'>('auto');
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [ocrConfidence, setOcrConfidence] = useState<number>(0);
  const [ocrMethod, setOcrMethod] = useState<'Google Cloud Vision' | 'ML Kit' | 'Unknown'>('Unknown');
  const [showCropOption, setShowCropOption] = useState<boolean>(false);
  const [capturedImagePath, setCapturedImagePath] = useState<string>('');
  
  // Multi-page scanning state
  const [scanMode, setScanMode] = useState<ScanMode>({ type: 'single' });
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  const [isMultiPageMode, setIsMultiPageMode] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<PageProcessingProgress>({
    currentPage: 0,
    totalPages: 0,
    isProcessing: false,
    processedPages: 0,
  });
  const [showGallery, setShowGallery] = useState<boolean>(false);
  
  // Tutorial state
  const [showTutorial, setShowTutorial] = useState<boolean>(false);
  const [isTutorialCompleted, setIsTutorialCompleted] = useState<boolean>(false);
  
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

  // Check if tutorial should be shown
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem('@notespark_scanner_tutorial_completed');
        const tutorialCompleted = completed === 'true';
        setIsTutorialCompleted(tutorialCompleted);
        
        // Show tutorial if not completed and user has camera permission
        if (!tutorialCompleted && hasPermission) {
          setShowTutorial(true);
        }
      } catch (error) {
        console.log('Error checking tutorial status:', error);
        // Default to showing tutorial if we can't determine status
        if (hasPermission) {
          setShowTutorial(true);
        }
      }
    };

    checkTutorialStatus();
  }, [hasPermission]);

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
      
      if (isMultiPageMode) {
        // Add to multi-page collection but offer crop option first
        setCapturedImagePath(photoPath);
        setShowCropOption(true);
        setIsProcessing(false);
      } else {
        // Single page mode - existing behavior
        setCapturedImagePath(photoPath);
        setShowCropOption(true);
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Capture error:', error);
      hapticService.error();
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
      setIsProcessing(false);
    }
  };

  // Multi-page scanning functions
  const toggleScanMode = () => {
    const newMode = !isMultiPageMode;
    setIsMultiPageMode(newMode);
    setScanMode({ type: newMode ? 'multi' : 'single' });
    
    // Reset state when changing modes
    if (!newMode) {
      setScannedPages([]);
      setShowGallery(false);
      setProcessingProgress({
        currentPage: 0,
        totalPages: 0,
        isProcessing: false,
        processedPages: 0,
      });
    }
    
    hapticService.light();
    console.log(`Scanner mode changed to: ${newMode ? 'multi-page' : 'single-page'}`);
  };

  const processAllPages = async () => {
    if (scannedPages.length === 0) {
      Alert.alert('No Pages', 'Please capture at least one page before processing.');
      return;
    }

    const imageUris = scannedPages.map(page => page.imageUri);
    console.log(`Processing ${imageUris.length} pages...`);
    
    // Navigate to tone selection with multi-page data
    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('ToneSelection', {
        imageUris: imageUris,
        isMultiPage: true,
      });
    }
  };

  const deletePage = (pageId: string) => {
    const updatedPages = scannedPages.filter(page => page.id !== pageId);
    setScannedPages(updatedPages);
    
    // Hide gallery if no pages left
    if (updatedPages.length <= 1) {
      setShowGallery(false);
    }
    
    hapticService.medium();
    console.log(`Deleted page ${pageId}, remaining pages: ${updatedPages.length}`);
  };

  const reorderPages = (pages: ScannedPage[]) => {
    setScannedPages(pages);
    hapticService.light();
  };

  const previewPage = (page: ScannedPage) => {
    // This could open a full-screen preview modal
    console.log('Preview page:', page.id);
    hapticService.light();
  };

  const addAnotherPage = () => {
    // Simply continue in multi-page mode
    setShowGallery(false);
    hapticService.light();
  };

  const processCapturedImage = async (imagePath: string, skipCrop: boolean = false) => {
    setIsProcessing(true);
    setShowCropOption(false);
    
    try {
      let finalImagePath = imagePath;
      
      // If user wants to crop, open cropper
      if (!skipCrop) {
        const croppingService = ImageCroppingService.getInstance();
        const cropResult = await croppingService.quickCropForText(imagePath);
        
        if (cropResult) {
          finalImagePath = cropResult.path;
          console.log('Image cropped successfully:', finalImagePath);
        } else {
          // User cancelled cropping, use original image
          console.log('User cancelled cropping, using original image');
        }
      }
      
      if (isMultiPageMode) {
        // Add to multi-page collection
        const newPage: ScannedPage = {
          id: `page_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          imageUri: finalImagePath,
          timestamp: new Date(),
          isProcessed: false,
        };
        
        const updatedPages = [...scannedPages, newPage];
        setScannedPages(updatedPages);
        
        // Show gallery if we have multiple pages
        if (updatedPages.length > 1) {
          setShowGallery(true);
        }
        
        setIsProcessing(false);
        hapticService.success();
        
        console.log(`Multi-page: Added page ${updatedPages.length}, total pages: ${updatedPages.length}`);
      } else {
        // Single page mode - Process with OCR
        await processImageWithEnhancedOCR(finalImagePath);
      }
      
    } catch (error) {
      console.error('Image processing error:', error);
      hapticService.error();
      Alert.alert('Error', 'Failed to process image. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const processImageWithEnhancedOCR = async (imagePath: string) => {
    try {
      let extractedText = '';
      let confidence = 0;
      let method: 'Google Cloud Vision' | 'ML Kit' = 'ML Kit';

      // Try Google Cloud Vision first (highest accuracy)
      const visionService = VisionService.getInstance();
      if (visionService.isConfigured()) {
        console.log('Attempting OCR with Google Cloud Vision...');
        const visionResult = await visionService.extractTextFromImage(imagePath);
        
        if (visionResult && visionResult.text && visionResult.text.trim().length > 5) {
          extractedText = visionResult.text;
          confidence = visionResult.confidence;
          method = 'Google Cloud Vision';
          console.log('Google Cloud Vision OCR successful, confidence:', confidence);
        } else {
          console.log('Google Cloud Vision returned insufficient text, trying ML Kit...');
        }
      } else {
        console.log('Google Cloud Vision not configured, using ML Kit...');
      }

      // Fallback to ML Kit if Cloud Vision failed or not configured
      if (!extractedText || extractedText.trim().length < 5) {
        console.log('Using ML Kit for OCR...');
        const ocrResult = await textRecognition.recognize(imagePath);
        
        if (ocrResult && ocrResult.text && ocrResult.text.trim()) {
          extractedText = ocrResult.text;
          confidence = 0.8; // ML Kit doesn't provide confidence, assume 80%
          method = 'ML Kit';
          console.log('ML Kit OCR successful');
        }
      }

      if (extractedText && extractedText.trim()) {
        hapticService.success();
        setExtractedText(extractedText);
        setOcrConfidence(confidence);
        setOcrMethod(method);
        setShowResults(true);
      } else {
        hapticService.error();
        Alert.alert(
          'No Text Found',
          'Could not detect any text in the document. Please ensure the document is well-lit and clearly visible, or try cropping the image to focus on the text area.',
          [
            { text: 'Try Again', onPress: () => retryCapture() },
            { text: 'Crop & Retry', onPress: () => processCapturedImage(capturedImagePath, false) }
          ]
        );
      }
    } catch (error) {
      console.error('Enhanced OCR Error:', error);
      hapticService.error();
      Alert.alert(
        'Processing Error',
        'Failed to extract text from the image. Please try again.',
        [{ text: 'Try Again', onPress: () => retryCapture() }]
      );
    }
  };

  const processWithAI = () => {
    if (!extractedText.trim()) {
      Alert.alert('Error', 'No text available to process');
      return;
    }

    const parentNavigation = navigation.getParent();
    if (parentNavigation) {
      parentNavigation.navigate('ToneSelection', { extractedText });
    }
  };

  const retryCapture = () => {
    setShowResults(false);
    setShowCropOption(false);
    setExtractedText('');
    setCapturedImagePath('');
    setOcrConfidence(0);
    setOcrMethod('Unknown');
    
    // Reset multi-page state
    setScannedPages([]);
    setShowGallery(false);
    setIsMultiPageMode(false);
    setScanMode({ type: 'single' });
    setProcessingProgress({
      currentPage: 0,
      totalPages: 0,
      isProcessing: false,
      processedPages: 0,
    });
    
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

  // Tutorial handlers
  const handleTutorialComplete = async () => {
    try {
      await AsyncStorage.setItem('@notespark_scanner_tutorial_completed', 'true');
      setIsTutorialCompleted(true);
      setShowTutorial(false);
    } catch (error) {
      console.log('Error saving tutorial completion:', error);
      // Still close tutorial even if we can't save the state
      setShowTutorial(false);
    }
  };

  const handleTutorialSkip = async () => {
    try {
      await AsyncStorage.setItem('@notespark_scanner_tutorial_completed', 'true');
      setIsTutorialCompleted(true);
      setShowTutorial(false);
    } catch (error) {
      console.log('Error saving tutorial skip:', error);
      setShowTutorial(false);
    }
  };

  const showTutorialAgain = () => {
    setShowTutorial(true);
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
          {/* OCR Method and Confidence Indicators */}
          <View style={styles.ocrInfoContainer}>
            <Chip 
              icon="robot-industrial" 
              style={[styles.ocrChip, { backgroundColor: ocrMethod === 'Google Cloud Vision' ? theme.colors.primaryContainer : theme.colors.surfaceVariant }]}
              textStyle={{ color: theme.colors.onSurface, fontSize: 12 }}
            >
              {ocrMethod}
            </Chip>
            <Chip 
              icon="gauge" 
              style={[styles.confidenceChip, { backgroundColor: theme.colors.surfaceVariant }]}
              textStyle={{ color: theme.colors.onSurface, fontSize: 12 }}
            >
              {Math.round(ocrConfidence * 100)}% accuracy
            </Chip>
          </View>

          <Card style={[styles.textCard, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Card.Content style={styles.textCardContent}>
              <Text style={[styles.textStats, { color: theme.colors.onSurfaceVariant }]}>
                {extractedText.length} characters • {extractedText.split(/\s+/).filter(word => word.length > 0).length} words
              </Text>
              <ScrollView 
                style={styles.textScrollView}
                contentContainerStyle={styles.textScrollContent}
                showsVerticalScrollIndicator={true}
                persistentScrollbar={true}
              >
                <Text 
                  style={[styles.extractedText, { color: theme.colors.onSurface }]}
                  selectable={true}
                >
                  {extractedText}
                </Text>
              </ScrollView>
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

  // Crop option modal - shown after photo capture
  if (showCropOption && capturedImagePath) {
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
              {isMultiPageMode ? `Crop Page ${scannedPages.length + 1}` : 'Crop Photo'}
            </Title>
            <View style={{ width: 48 }} />
          </View>
        </Surface>

        <View style={styles.resultsContent}>
          <Card style={[styles.textCard, { backgroundColor: theme.colors.surface }]} elevation={3}>
            <Card.Content style={styles.textCardContent}>
              {isMultiPageMode && (
                <View style={styles.multiPageInfo}>
                  <Icon name="file-multiple" size={20} color={theme.colors.primary} />
                  <Text style={[styles.multiPageInfoText, { color: theme.colors.primary }]}>
                    Page {scannedPages.length + 1} of multi-page document
                  </Text>
                </View>
              )}
              
              <Text style={[styles.textStats, { color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 16 }]}>
                For better text recognition, you can crop the image to focus only on the text area you want to scan.
              </Text>
              
              <View style={styles.resultsActions}>
                <Button
                  mode="outlined"
                  onPress={() => processCapturedImage(capturedImagePath, true)}
                  style={[styles.actionButton, styles.retryButton]}
                  icon="file-document-outline"
                >
                  {isMultiPageMode ? 'Add Full Image' : 'Use Full Image'}
                </Button>
                <Button
                  mode="contained"
                  onPress={() => processCapturedImage(capturedImagePath, false)}
                  style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                  labelStyle={{ color: theme.colors.onPrimary }}
                  icon="crop"
                >
                  Crop Image
                </Button>
              </View>
            </Card.Content>
          </Card>
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
          <IconButton
            icon="help-circle-outline"
            size={24}
            iconColor="white"
            onPress={showTutorialAgain}
            style={{ opacity: isTutorialCompleted ? 1 : 0.7 }}
          />
        </Surface>

        {/* Scan Mode Toggle */}
        <Surface style={[styles.modeToggleContainer, { backgroundColor: 'rgba(0,0,0,0.3)' }]} elevation={0}>
          <View style={styles.modeToggle}>
            <Text style={[styles.modeLabel, { color: !isMultiPageMode ? 'white' : 'rgba(255,255,255,0.7)' }]}>
              Single Page
            </Text>
            <Switch
              value={isMultiPageMode}
              onValueChange={toggleScanMode}
              thumbColor={isMultiPageMode ? theme.colors.primary : '#f4f3f4'}
              trackColor={{ false: 'rgba(255,255,255,0.3)', true: theme.colors.primaryContainer }}
            />
            <Text style={[styles.modeLabel, { color: isMultiPageMode ? 'white' : 'rgba(255,255,255,0.7)' }]}>
              Multi-Page
            </Text>
          </View>
          
          {/* Page counter for multi-page mode */}
          {isMultiPageMode && scannedPages.length > 0 && (
            <Text style={styles.pageCounter}>
              Page {scannedPages.length + 1} {scannedPages.length > 0 && `(${scannedPages.length} captured)`}
            </Text>
          )}
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
            {isMultiPageMode 
              ? scannedPages.length === 0 
                ? 'Position first page within the frame'
                : `Position page ${scannedPages.length + 1} within the frame`
              : 'Position document within the frame'
            }
          </Text>
        </View>
      </SafeAreaView>

      {/* Capture controls */}
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
          <View style={styles.controlsLayout}>
            {/* Multi-page mode: Additional controls */}
            {isMultiPageMode && scannedPages.length > 0 && (
              <View style={styles.multiPageControls}>
                <Button
                  mode="outlined"
                  onPress={addAnotherPage}
                  style={[styles.multiPageButton, { borderColor: 'rgba(255,255,255,0.8)' }]}
                  labelStyle={{ color: 'white', fontSize: 12 }}
                  icon="plus"
                  compact
                >
                  Add Page
                </Button>
                <Button
                  mode="contained"
                  onPress={processAllPages}
                  style={[styles.multiPageButton, { backgroundColor: theme.colors.primary }]}
                  labelStyle={{ color: theme.colors.onPrimary, fontSize: 12 }}
                  icon="check-all"
                  compact
                >
                  Process All ({scannedPages.length})
                </Button>
              </View>
            )}
            
            {/* Main capture button row */}
            <View style={styles.captureRow}>
              {/* Flash toggle button */}
              <View style={styles.flashButton}>
                <IconButton
                  icon={getFlashIcon()}
                  size={20}
                  iconColor="white"
                  onPress={toggleFlash}
                />
              </View>
              
              {/* Main capture button */}
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
              
              {/* Right spacer to balance layout */}
              <View style={styles.flashButton} />
            </View>
          </View>
        )}
      </View>

      {/* Page thumbnail gallery */}
      {isMultiPageMode && showGallery && scannedPages.length > 0 && (
        <View style={styles.galleryContainer}>
          <PageThumbnailGallery
            pages={scannedPages}
            onDeletePage={deletePage}
            onReorderPages={reorderPages}
            onPreviewPage={previewPage}
            isProcessing={processingProgress.isProcessing}
            currentProcessingPage={processingProgress.currentPage}
          />
        </View>
      )}

      {/* Scanner Tutorial Modal */}
      {showTutorial && (
        <ScannerTutorial
          visible={showTutorial}
          onComplete={handleTutorialComplete}
          onSkip={handleTutorialSkip}
        />
      )}
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
  // Multi-page mode toggle styles
  modeToggleContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  pageCounter: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  // Multi-page info styles
  multiPageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  multiPageInfoText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Enhanced control layout styles
  controlsLayout: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingBottom: 40, // Increased for better spacing
    paddingTop: 20,
  },
  // Multi-page control styles
  multiPageControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15, // Space between controls and capture button
    gap: 12,
  },
  multiPageButton: {
    flex: 1,
    maxWidth: 140,
    borderRadius: 20,
  },
  // Gallery container for thumbnail gallery
  galleryContainer: {
    position: 'absolute',
    bottom: 140, // Position above bottom controls
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  // Perfect centering for main capture button
  captureButton: {
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
  // New styles for enhanced features
  ocrInfoContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  ocrChip: {
    flex: 1,
  },
  confidenceChip: {
    flex: 1,
  },
  textStats: {
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  textScrollView: {
    maxHeight: 300,
    minHeight: 120,
  },
  textScrollContent: {
    paddingVertical: 4,
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
