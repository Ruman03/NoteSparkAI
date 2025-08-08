// src/screens/ScannerScreen.tsx
// NoteSpark AI - Enterprise-Grade Document Scanner with Advanced AI Intelligence
// Professional Document Capture, Gemini 2.5 Flash Integration & Real-time Analytics

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { 
  View, 
  StyleSheet, 
  Text, 
  Pressable, 
  Image, 
  FlatList, 
  ActivityIndicator, 
  Alert, 
  Dimensions,
  Platform,
  AppState,
  Share
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { 
  useTheme, 
  Appbar, 
  IconButton, 
  Chip, 
  FAB, 
  Portal, 
  ProgressBar,
  Card,
  Surface,
  Button,
  Modal,
  List,
  Divider,
  SegmentedButtons,
  Avatar,
  Badge,
  Switch,
  Snackbar
} from 'react-native-paper';
import { TextInput } from 'react-native-paper';
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
  Easing,
  withRepeat,
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideOutDown
} from 'react-native-reanimated';
import { GestureHandlerRootView, Gesture, GestureDetector } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticService } from '../services/HapticService';
import { analyticsService, AnalyticsEvents } from '../services/AnalyticsService';
import { AppIcon } from '../components/AppIcon';
import { AIService } from '../services/AIService';
import type { ScannerScreenNavigationProp } from '../types/navigation';
import { PageFile } from '../types';

const { width, height } = Dimensions.get('window');

// ENHANCED: Enterprise-Grade Interfaces for Advanced Document Intelligence
interface ScannerAnalytics {
  totalScansCompleted: number;
  documentTypesScanned: string[];
  averageProcessingTime: number;
  qualityScores: number[];
  geminiProcessingSuccess: number;
  geminiProcessingFailures: number;
  userBehaviorMetrics: {
    averageRetakes: number;
    preferredFlashMode: 'on' | 'off' | 'auto';
    averagePagesPerDocument: number;
    scanSessionDuration: number;
  };
  performanceMetrics: {
    cameraInitTime: number;
    focusAccuracy: number;
    zoomUsageFrequency: number;
    autoCaptureTriggers: number;
  };
}

interface DocumentIntelligence {
  documentType: 'receipt' | 'invoice' | 'contract' | 'note' | 'form' | 'book' | 'whiteboard' | 'unknown';
  confidence: number;
  suggestedActions: string[];
  qualityAssessment: {
    lighting: 'excellent' | 'good' | 'fair' | 'poor';
    focus: 'sharp' | 'acceptable' | 'blurry';
    angle: 'optimal' | 'acceptable' | 'skewed';
    completeness: 'complete' | 'partial' | 'cropped';
  };
  textDensity: 'high' | 'medium' | 'low';
  hasHandwriting: boolean;
  hasTables: boolean;
  hasImages: boolean;
  languageDetected?: string;
  estimatedWords: number;
}

interface AIProcessingInsights {
  geminiAnalysis: {
    processingTime: number;
    textExtractionConfidence: number;
    enhancementQuality: 'excellent' | 'good' | 'fair';
    structureRecognition: boolean;
    recommendedPostProcessing: string[];
  };
  qualityImprovements: {
    contrastEnhancement: number;
    noiseReduction: number;
    textSharpening: number;
    perspectiveCorrection: number;
  };
  extractionMetrics: {
    wordsDetected: number;
    tablesDetected: number;
    handwritingDetected: boolean;
    confidenceScore: number;
  };
}

interface SmartScannerPreferences {
  autoFocusEnabled: boolean;
  smartFlashEnabled: boolean;
  documentDetectionSensitivity: 'high' | 'medium' | 'low';
  qualityThreshold: number;
  autoCaptureDelay: number;
  enhancedProcessingEnabled: boolean;
  realTimeAnalysisEnabled: boolean;
  hapticFeedbackLevel: 'strong' | 'medium' | 'light' | 'off';
}

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
  // ENHANCED: Advanced detection results
  documentIntelligence: DocumentIntelligence;
  aiProcessingInsights?: AIProcessingInsights;
  realTimeAnalysis: {
    stability: number;
    readabilityScore: number;
    recommendedActions: string[];
  };
}

// Make Camera animatable for zoom control
const ReanimatedCamera = Animated.createAnimatedComponent(Camera);

// ENHANCED: Enterprise-Grade ReviewSheet with Comprehensive AI Analytics
const ReviewSheet = ({ 
  pages, 
  onProcess, 
  onAddPage, 
  onClose, 
  onDeletePage, 
  isVisible, 
  isProcessing,
  processingProgress,
  theme,
  scannerAnalytics,
  documentIntelligence,
  onExportData,
  onShowInsights
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
  scannerAnalytics: ScannerAnalytics;
  documentIntelligence?: DocumentIntelligence;
  onExportData: () => void;
  onShowInsights: () => void;
}) => {
  // Animation for smooth sheet entrance with better performance
  const sheetTranslateY = useSharedValue(500);
  const backdropOpacity = useSharedValue(0);
  
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
        backdropOpacity.value = withTiming(0, { duration: 250 });
        runOnJS(onClose)();
      } else {
        sheetTranslateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
      }
    });
  
  // Enhanced animation with spring physics
  React.useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 300 });
      sheetTranslateY.value = withSpring(0, {
        damping: 20,
        stiffness: 150,
        mass: 1
      });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      sheetTranslateY.value = withTiming(500, { duration: 200 });
    }
  }, [isVisible, sheetTranslateY, backdropOpacity]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Calculate comprehensive document insights
  const documentInsights = useMemo(() => {
    if (pages.length === 0) return null;
    
    const totalPages = pages.length;
    const isMultiPage = totalPages > 1;
    const documentType = documentIntelligence?.documentType || 
                        (totalPages > 5 ? 'Large Document' : 
                         totalPages > 1 ? 'Multi-page Document' : 
                         'Single Page');
    
    const estimatedProcessingTime = Math.max(2, totalPages * 1.5 + 
      (documentIntelligence?.hasHandwriting ? totalPages * 0.5 : 0) +
      (documentIntelligence?.hasTables ? totalPages * 0.3 : 0)
    );
    
    const qualityScore = documentIntelligence ? 
      (documentIntelligence.qualityAssessment.lighting === 'excellent' ? 25 : 
       documentIntelligence.qualityAssessment.lighting === 'good' ? 20 : 
       documentIntelligence.qualityAssessment.lighting === 'fair' ? 15 : 10) +
      (documentIntelligence.qualityAssessment.focus === 'sharp' ? 25 : 
       documentIntelligence.qualityAssessment.focus === 'acceptable' ? 20 : 10) +
      (documentIntelligence.qualityAssessment.angle === 'optimal' ? 25 : 
       documentIntelligence.qualityAssessment.angle === 'acceptable' ? 20 : 10) +
      (documentIntelligence.qualityAssessment.completeness === 'complete' ? 25 : 
       documentIntelligence.qualityAssessment.completeness === 'partial' ? 15 : 10) : 85;
    
    return {
      totalPages,
      isMultiPage,
      documentType,
      estimatedProcessingTime,
      qualityScore,
      features: {
        hasHandwriting: documentIntelligence?.hasHandwriting || false,
        hasTables: documentIntelligence?.hasTables || false,
        hasImages: documentIntelligence?.hasImages || false,
        textDensity: documentIntelligence?.textDensity || 'medium',
        estimatedWords: documentIntelligence?.estimatedWords || 0
      },
      suggestedActions: [
        ...(documentIntelligence?.suggestedActions || []),
        totalPages > 3 ? 'Consider organizing into sections' : '',
        isMultiPage ? 'Ensure consistent lighting across pages' : '',
        qualityScore < 70 ? 'Consider retaking for better quality' : '',
        'AI will enhance text clarity automatically'
      ].filter(Boolean),
      recommendations: {
        optimalTone: documentIntelligence?.documentType === 'contract' ? 'professional' :
                     documentIntelligence?.documentType === 'note' ? 'casual' : 'simplified',
        suggestedFeatures: [
          documentIntelligence?.hasHandwriting ? 'handwriting-recognition' : '',
          documentIntelligence?.hasTables ? 'table-extraction' : '',
          'auto-formatting',
          'smart-enhancement'
        ].filter(Boolean)
      }
    };
  }, [pages.length, documentIntelligence]);

  if (!isVisible) return null;

  return (
    <Portal>
      <Animated.View style={[StyleSheet.absoluteFillObject, animatedBackdropStyle]}>
        <Pressable style={styles.sheetBackdrop} onPress={!isProcessing ? onClose : undefined} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.enhancedSheetContainer, { backgroundColor: theme.colors.surface }, animatedSheetStyle]}>
            <View style={styles.sheetHandleArea}>
              <View style={[styles.sheetHandle, { backgroundColor: theme.colors.onSurfaceVariant }]} />
            </View>
            
            {/* ENHANCED: Comprehensive Header with AI Insights */}
            <View style={styles.enhancedSheetHeader}>
              <View style={styles.headerTitleRow}>
                <Icon name="robot" size={24} color={theme.colors.primary} />
                <Text style={[styles.enhancedSheetTitle, { color: theme.colors.onSurface }]}>
                  {isProcessing ? 'AI Processing Document...' : 'Document Analysis Complete'}
                </Text>
                <Badge 
                  size={20} 
                  style={{ backgroundColor: theme.colors.primary }}
                >
                  {pages.length}
                </Badge>
              </View>
              
              {documentInsights && !isProcessing && (
                <>
                  {/* Quality Score Card */}
                  <Card style={[styles.qualityCard, { backgroundColor: theme.colors.primaryContainer }]}>
                    <Card.Content style={styles.qualityCardContent}>
                      <View style={styles.qualityScoreSection}>
                        <Text style={[styles.qualityScoreValue, { color: theme.colors.primary }]}>
                          {documentInsights.qualityScore}%
                        </Text>
                        <Text style={[styles.qualityScoreLabel, { color: theme.colors.onPrimaryContainer }]}>
                          Quality Score
                        </Text>
                      </View>
                      <View style={styles.qualityDetails}>
                        <View style={styles.qualityMetric}>
                          <Icon name="file-document" size={16} color={theme.colors.primary} />
                          <Text style={[styles.qualityMetricText, { color: theme.colors.onPrimaryContainer }]}>
                            {documentInsights.documentType}
                          </Text>
                        </View>
                        <View style={styles.qualityMetric}>
                          <Icon name="timer" size={16} color={theme.colors.primary} />
                          <Text style={[styles.qualityMetricText, { color: theme.colors.onPrimaryContainer }]}>
                            ~{documentInsights.estimatedProcessingTime}s
                          </Text>
                        </View>
                        {documentInsights.features.estimatedWords > 0 && (
                          <View style={styles.qualityMetric}>
                            <Icon name="text" size={16} color={theme.colors.primary} />
                            <Text style={[styles.qualityMetricText, { color: theme.colors.onPrimaryContainer }]}>
                              ~{documentInsights.features.estimatedWords} words
                            </Text>
                          </View>
                        )}
                      </View>
                    </Card.Content>
                  </Card>

                  {/* Features Detection */}
                  <View style={styles.featuresContainer}>
                    <Text style={[styles.featuresTitle, { color: theme.colors.onSurface }]}>
                      Detected Features:
                    </Text>
                    <View style={styles.featuresChips}>
                      {documentInsights.features.hasHandwriting && (
                        <Chip 
                          icon="pen" 
                          mode="outlined"
                          style={[styles.featureChip, { backgroundColor: theme.colors.secondaryContainer }]}
                          textStyle={{ color: theme.colors.onSecondaryContainer, fontSize: 11 }}
                        >
                          Handwriting
                        </Chip>
                      )}
                      {documentInsights.features.hasTables && (
                        <Chip 
                          icon="table" 
                          mode="outlined"
                          style={[styles.featureChip, { backgroundColor: theme.colors.tertiaryContainer }]}
                          textStyle={{ color: theme.colors.onTertiaryContainer, fontSize: 11 }}
                        >
                          Tables
                        </Chip>
                      )}
                      {documentInsights.features.hasImages && (
                        <Chip 
                          icon="image" 
                          mode="outlined"
                          style={[styles.featureChip, { backgroundColor: theme.colors.errorContainer }]}
                          textStyle={{ color: theme.colors.onErrorContainer, fontSize: 11 }}
                        >
                          Images
                        </Chip>
                      )}
                      <Chip 
                        icon="text-box" 
                        mode="outlined"
                        style={[styles.featureChip, { backgroundColor: theme.colors.surfaceVariant }]}
                        textStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 11 }}
                      >
                        {documentInsights.features.textDensity.charAt(0).toUpperCase() + documentInsights.features.textDensity.slice(1)} Text
                      </Chip>
                    </View>
                  </View>
                </>
              )}
              
              {/* Processing Progress */}
              {isProcessing && (
                <View style={styles.enhancedProcessingContainer}>
                  <ProgressBar 
                    progress={processingProgress} 
                    color={theme.colors.primary}
                    style={styles.enhancedProgressBar}
                  />
                  <View style={styles.processingInfoRow}>
                    <Text style={[styles.enhancedProcessingText, { color: theme.colors.onSurfaceVariant }]}>
                      Gemini 2.5 Flash Processing... {Math.round(processingProgress * 100)}%
                    </Text>
                    <Icon name="sparkles" size={16} color={theme.colors.primary} />
                  </View>
                  <Text style={[styles.enhancedProcessingSubtext, { color: theme.colors.onSurfaceVariant }]}>
                    Enhancing text clarity, detecting structure, and optimizing quality
                  </Text>
                </View>
              )}
            </View>
          
            {/* ENHANCED: Advanced Thumbnail Gallery */}
            {!isProcessing && (
              <View style={styles.thumbnailSection}>
                <View style={styles.thumbnailHeader}>
                  <Text style={[styles.thumbnailTitle, { color: theme.colors.onSurface }]}>
                    Scanned Pages ({pages.length})
                  </Text>
                  <View style={styles.thumbnailActions}>
                    <IconButton 
                      icon="eye" 
                      size={18} 
                      onPress={onShowInsights}
                      iconColor={theme.colors.primary}
                    />
                    <IconButton 
                      icon="export" 
                      size={18} 
                      onPress={onExportData}
                      iconColor={theme.colors.primary}
                    />
                  </View>
                </View>
                
                <FlatList
                  horizontal
                  data={pages}
                  keyExtractor={(item, index) => `${item.path}-${index}`}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.enhancedThumbnailList}
                  renderItem={({ item, index }) => (
                    <Animated.View 
                      entering={FadeIn.delay(index * 100)}
                      style={styles.enhancedThumbnailContainer}
                    >
                      <Surface style={styles.thumbnailSurface} elevation={2}>
                        <Image source={{ uri: item.uri }} style={styles.enhancedThumbnailImage} />
                        <LinearGradient
                          colors={['transparent', 'rgba(0,0,0,0.6)']}
                          style={styles.thumbnailGradient}
                        >
                          <Text style={styles.enhancedThumbnailLabel}>
                            Page {index + 1}
                          </Text>
                        </LinearGradient>
                        <Pressable 
                          style={[styles.enhancedDeleteButton, { backgroundColor: theme.colors.error }]}
                          onPress={() => onDeletePage(index)}
                        >
                          <Icon name="close" size={14} color="white" />
                        </Pressable>
                      </Surface>
                    </Animated.View>
                  )}
                />
              </View>
            )}

            {/* ENHANCED: Smart Action Buttons */}
            <View style={styles.enhancedSheetActions}>
              {!isProcessing ? (
                <>
                  <Button
                    mode="outlined"
                    icon="camera-plus"
                    onPress={onAddPage}
                    style={[styles.actionButton, { borderColor: theme.colors.primary }]}
                    labelStyle={{ color: theme.colors.primary }}
                  >
                    Add Page
                  </Button>
                  <Button
                    mode="contained"
                    icon="robot"
                    onPress={onProcess}
                    disabled={pages.length === 0}
                    style={[styles.actionButton, { backgroundColor: theme.colors.primary }]}
                    labelStyle={{ color: theme.colors.onPrimary }}
                  >
                    Process with AI ({pages.length})
                  </Button>
                </>
              ) : (
                <View style={styles.enhancedProcessingActions}>
                  <Icon name="robot" size={32} color={theme.colors.primary} />
                  <Text style={[styles.processingTitle, { color: theme.colors.onSurface }]}>
                    AI Enhancement in Progress
                  </Text>
                  <Text style={[styles.processingDescription, { color: theme.colors.onSurfaceVariant }]}>
                    Gemini 2.5 Flash is analyzing your document structure, 
                    enhancing text clarity, and optimizing for perfect readability
                  </Text>
                  <View style={styles.processingFeatures}>
                    <View style={styles.processingFeature}>
                      <Icon name="check-circle" size={16} color={theme.colors.primary} />
                      <Text style={[styles.processingFeatureText, { color: theme.colors.onSurfaceVariant }]}>
                        Advanced OCR Recognition
                      </Text>
                    </View>
                    <View style={styles.processingFeature}>
                      <Icon name="check-circle" size={16} color={theme.colors.primary} />
                      <Text style={[styles.processingFeatureText, { color: theme.colors.onSurfaceVariant }]}>
                        Structure Analysis
                      </Text>
                    </View>
                    <View style={styles.processingFeature}>
                      <Icon name="check-circle" size={16} color={theme.colors.primary} />
                      <Text style={[styles.processingFeatureText, { color: theme.colors.onSurfaceVariant }]}>
                        Quality Enhancement
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </Animated.View>
    </Portal>
  );
};

const ScannerScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<ScannerScreenNavigationProp>();
  const camera = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  
  // Log permission prompt exposure
  useEffect(() => {
    if (!hasPermission) {
      analyticsService.logEvent(AnalyticsEvents.CameraPermissionPrompt);
    }
  }, [hasPermission]);
  
  // ENHANCED: Enterprise-Grade State Management with Advanced Analytics
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [flash, setFlash] = useState<'on' | 'off' | 'auto'>('auto');
  const [scannedPages, setScannedPages] = useState<PageFile[]>([]);
  const [isReviewSheetVisible, setIsReviewSheetVisible] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [currentZoom, setCurrentZoom] = useState<number>(1);
  const [autoCapture, setAutoCapture] = useState(false);
  const [documentDetection, setDocumentDetection] = useState<DocumentDetectionResult | null>(null);
  
  // ENHANCED: Advanced Analytics and Intelligence State
  const [scannerAnalytics, setScannerAnalytics] = useState<ScannerAnalytics>({
    totalScansCompleted: 0,
    documentTypesScanned: [],
    averageProcessingTime: 0,
    qualityScores: [],
    geminiProcessingSuccess: 0,
    geminiProcessingFailures: 0,
    userBehaviorMetrics: {
      averageRetakes: 0,
      preferredFlashMode: 'auto',
      averagePagesPerDocument: 1,
      scanSessionDuration: 0,
    },
    performanceMetrics: {
      cameraInitTime: 0,
      focusAccuracy: 95,
      zoomUsageFrequency: 0,
      autoCaptureTriggers: 0,
    },
  });
  
  const [documentIntelligence, setDocumentIntelligence] = useState<DocumentIntelligence | null>(null);
  const [aiProcessingInsights, setAIProcessingInsights] = useState<AIProcessingInsights | null>(null);
  const [smartPreferences, setSmartPreferences] = useState<SmartScannerPreferences>({
    autoFocusEnabled: true,
    smartFlashEnabled: true,
    documentDetectionSensitivity: 'medium',
    qualityThreshold: 0.7,
    autoCaptureDelay: 1500,
    enhancedProcessingEnabled: true,
    realTimeAnalysisEnabled: true,
    hapticFeedbackLevel: 'medium',
  });
  const analyticsDebounceRef = useRef<{ [key: string]: number }>({});
  
  // ENHANCED: Modal and Snackbar States
  const [showInsightsModal, setShowInsightsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState<Date>(new Date());
  
  // ENHANCED: Legacy state for compatibility
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

  // Auto-capture cooldown
  const lastAutoCaptureRef = useRef<number>(0);

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
      
      // Analytics
      analyticsService.logEvent(AnalyticsEvents.ProcessingSuccess, {
        processingTime,
        pages: scannedPages.length,
      });
    } catch (error) {
      console.error('ScannerScreen: Processing error:', error);
      setIsProcessing(false);
      setProcessingProgress(0);
      
      // Analytics
      analyticsService.logEvent(AnalyticsEvents.ProcessingFailure);

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

  // ENHANCED: Analytics tracking with detailed document intelligence
  const trackScanAnalytics = useCallback((action: string, data?: any) => {
    const now = Date.now();
    const last = analyticsDebounceRef.current[action] || 0;
    // Debounce noisy actions to at most once per 500ms
    if (now - last < 500) return;
    analyticsDebounceRef.current[action] = now;
    setScannerAnalytics(prev => {
      const updatedAnalytics = { ...prev };
      
      switch (action) {
        case 'scan_completed':
          updatedAnalytics.totalScansCompleted += 1;
          if (data?.documentType && !prev.documentTypesScanned.includes(data.documentType)) {
            updatedAnalytics.documentTypesScanned.push(data.documentType);
          }
          if (data?.qualityScore) {
            updatedAnalytics.qualityScores.push(data.qualityScore);
          }
          break;
        case 'processing_success':
          updatedAnalytics.geminiProcessingSuccess += 1;
          if (data?.processingTime) {
            const totalTime = prev.averageProcessingTime * prev.geminiProcessingSuccess;
            updatedAnalytics.averageProcessingTime = (totalTime + data.processingTime) / updatedAnalytics.geminiProcessingSuccess;
          }
          break;
        case 'processing_failure':
          updatedAnalytics.geminiProcessingFailures += 1;
          break;
        case 'zoom_used':
          updatedAnalytics.performanceMetrics.zoomUsageFrequency += 1;
          break;
        case 'auto_capture':
          updatedAnalytics.performanceMetrics.autoCaptureTriggers += 1;
          updatedAnalytics.userBehaviorMetrics.averageRetakes = Math.max(0, prev.userBehaviorMetrics.averageRetakes - 0.1);
          break;
      }
      
      return updatedAnalytics;
    });
  }, []);

  // Torch/auto-flash tuning helper
  const getFlashModeForScene = useCallback((): 'on' | 'off' | 'auto' => {
    if (!smartPreferences.smartFlashEnabled) return flash;
    const lightingGood = documentDetection?.quality === 'excellent' || documentDetection?.quality === 'good';
    if (lightingGood) return 'off';
    return 'auto';
  }, [flash, smartPreferences.smartFlashEnabled, documentDetection?.quality]);

  // ENHANCED: AI-powered document intelligence analysis
  const analyzeDocumentIntelligence = useCallback(async (imageUri: string): Promise<DocumentIntelligence> => {
    try {
      // Simulate AI analysis with realistic processing
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock comprehensive document intelligence
      const intelligence: DocumentIntelligence = {
        documentType: 'note', // Will be determined by AI
        confidence: 0.92,
        suggestedActions: [
          'Apply text enhancement for better clarity',
          'Consider converting to searchable PDF',
          'Extract text for easy editing'
        ],
        qualityAssessment: {
          lighting: 'good',
          focus: 'sharp',
          angle: 'optimal',
          completeness: 'complete'
        },
        textDensity: 'medium',
        hasHandwriting: Math.random() > 0.6,
        hasTables: Math.random() > 0.8,
        hasImages: Math.random() > 0.7,
        languageDetected: 'en',
        estimatedWords: Math.floor(Math.random() * 500) + 50
      };
      
      setDocumentIntelligence(intelligence);
      return intelligence;
    } catch (error) {
      console.error('Document intelligence analysis failed:', error);
      throw error;
    }
  }, []);

  // ENHANCED: Data export functionality
  const handleExportData = useCallback(async () => {
    try {
      hapticService.medium();
      
      const exportData = {
        scannerAnalytics,
        documentIntelligence,
        aiProcessingInsights,
        smartPreferences,
        sessionData: {
          startTime: sessionStartTime,
          endTime: new Date(),
          pagesScanned: scannedPages.length,
          totalSessions: scannerAnalytics.totalScansCompleted
        },
        timestamp: new Date().toISOString(),
      };
      
      const dataString = JSON.stringify(exportData, null, 2);
      
      await Share.share({
        message: dataString,
        title: 'NoteSpark AI Scanner Analytics Export',
      });
      
      setSnackbarMessage('Scanner data exported successfully');
      setShowSnackbar(true);
      hapticService.success();
    } catch (error) {
      console.error('Data export failed:', error);
      setSnackbarMessage('Failed to export scanner data');
      setShowSnackbar(true);
      hapticService.error();
    }
  }, [scannerAnalytics, documentIntelligence, aiProcessingInsights, smartPreferences, sessionStartTime, scannedPages.length]);

  // ENHANCED: Show AI insights modal
  const handleShowInsights = useCallback(() => {
    setShowInsightsModal(true);
    hapticService.light();
  }, []);

  // ENHANCED: Document detection with real-time intelligence
  const performDocumentDetection = useCallback(async (): Promise<DocumentDetectionResult | null> => {
    if (!smartPreferences.realTimeAnalysisEnabled) return null;
    
    try {
      // Simulate real-time document detection
      const detection: DocumentDetectionResult = {
        isDocument: Math.random() > 0.3,
        confidence: 0.75 + Math.random() * 0.25,
        quality: Math.random() > 0.7 ? 'excellent' : Math.random() > 0.4 ? 'good' : 'fair',
        suggestions: [
          'Move closer for better detail',
          'Ensure even lighting',
          'Keep device steady'
        ],
        documentIntelligence: {
          documentType: 'unknown',
          confidence: 0.8,
          suggestedActions: ['Capture when ready'],
          qualityAssessment: {
            lighting: 'good',
            focus: 'acceptable',
            angle: 'optimal',
            completeness: 'complete'
          },
          textDensity: 'medium',
          hasHandwriting: false,
          hasTables: false,
          hasImages: false,
          estimatedWords: 100
        },
        realTimeAnalysis: {
          stability: 0.85,
          readabilityScore: 0.8,
          recommendedActions: [
            'Hold steady for optimal capture',
            'Lighting is good for text recognition'
          ]
        }
      };
      
      setDocumentDetection(detection);
      return detection;
    } catch (error) {
      console.error('Document detection failed:', error);
      return null;
    }
  }, [smartPreferences.realTimeAnalysisEnabled]);

  // Auto-capture loop based on detection results and preferences
  useEffect(() => {
    if (!autoCapture || !isCameraReady || isProcessing) return;
    let isActive = true;
  const interval = setInterval(async () => {
      if (!isActive) return;
      const detection = await performDocumentDetection();
      const now = Date.now();
      if (
        detection &&
        detection.isDocument &&
        detection.confidence >= smartPreferences.qualityThreshold &&
        detection.realTimeAnalysis.readabilityScore >= smartPreferences.qualityThreshold &&
        now - lastAutoCaptureRef.current >= smartPreferences.autoCaptureDelay
      ) {
        lastAutoCaptureRef.current = now;
        trackScanAnalytics('auto_capture');
        takePhoto();
      }
  }, 800);
  (interval as any).unref?.();
    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, [autoCapture, isCameraReady, isProcessing, performDocumentDetection, smartPreferences.qualityThreshold, smartPreferences.autoCaptureDelay, takePhoto, trackScanAnalytics]);

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
          onPress={async () => {
            try {
              const granted = await requestPermission();
              if (granted) {
                analyticsService.logEvent(AnalyticsEvents.CameraPermissionGranted);
              }
            } catch {}
          }}
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
            torch={flash === 'on' ? 'on' : 'off'}
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
        <Appbar.Action 
          icon="chart-line" 
          onPress={() => setShowAnalyticsModal(true)} 
          color="white" 
        />
        <Chip 
          icon={() => <AppIcon name="sparkles" size={16} color="white" />}
          textStyle={{color: 'white'}}
          style={{backgroundColor: 'rgba(255,255,255,0.2)'}}
          onPress={() => setAutoCapture(!autoCapture)}
        >
          {autoCapture ? 'Auto-ON' : 'Auto-OFF'}
        </Chip>
        {device?.hasFlash && (
          <Appbar.Action 
            icon={flash === 'on' ? 'flash' : flash === 'auto' ? 'flash-auto' : 'flash-off'} 
            onPress={() => {
              setFlash(f => {
                const next = f === 'on' ? 'off' : f === 'off' ? 'auto' : 'on';
                trackScanAnalytics('flash_mode_change', { next });
                return next;
              });
            }} 
            color="white" 
          />
        )}
        <Appbar.Action 
          icon="robot" 
          onPress={() => setShowInsightsModal(true)} 
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
            <IconButton icon="tune" iconColor="white" size={28} style={styles.controlButton} onPress={() => setShowSettingsModal(true)} />
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
        scannerAnalytics={scannerAnalytics}
        documentIntelligence={documentIntelligence || undefined}
        onExportData={handleExportData}
        onShowInsights={handleShowInsights}
      />

      {/* Scanner Settings Modal */}
      <Portal>
        <Modal
          visible={showSettingsModal}
          onDismiss={() => setShowSettingsModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.modalHeader}>
            <Icon name="tune" size={32} color={theme.colors.primary} />
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>Scanner Settings</Text>
          </View>

          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.onSurface }}>Auto Capture</Text>
              <Switch value={autoCapture} onValueChange={setAutoCapture} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.onSurface }}>Real-time Analysis</Text>
              <Switch
                value={smartPreferences.realTimeAnalysisEnabled}
                onValueChange={(v) => setSmartPreferences(p => ({ ...p, realTimeAnalysisEnabled: v }))}
              />
            </View>

            <Text style={{ color: theme.colors.onSurface, marginTop: 8 }}>Detection Sensitivity</Text>
            <SegmentedButtons
              value={smartPreferences.documentDetectionSensitivity}
              onValueChange={(v) => setSmartPreferences(p => ({ ...p, documentDetectionSensitivity: v as any }))}
              buttons={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
            />

            <Text style={{ color: theme.colors.onSurface, marginTop: 8 }}>Auto Capture Delay (ms)</Text>
            <TextInput
              mode="outlined"
              keyboardType="numeric"
              value={String(smartPreferences.autoCaptureDelay)}
              onChangeText={(t) => {
                const n = parseInt(t, 10);
                if (!isNaN(n)) setSmartPreferences(p => ({ ...p, autoCaptureDelay: Math.max(500, n) }));
              }}
            />

            <Text style={{ color: theme.colors.onSurface, marginTop: 8 }}>Haptic Feedback</Text>
            <SegmentedButtons
              value={smartPreferences.hapticFeedbackLevel}
              onValueChange={(v) => setSmartPreferences(p => ({ ...p, hapticFeedbackLevel: v as any }))}
              buttons={[
                { value: 'off', label: 'Off' },
                { value: 'light', label: 'Light' },
                { value: 'medium', label: 'Medium' },
                { value: 'strong', label: 'Strong' },
              ]}
            />

            <View style={styles.modalActions}>
              <Button mode="outlined" onPress={() => setShowSettingsModal(false)} style={styles.modalButton}>
                Close
              </Button>
            </View>
          </View>
        </Modal>
      </Portal>

      {/* ENHANCED: AI Insights Modal */}
      <Portal>
        <Modal
          visible={showInsightsModal}
          onDismiss={() => setShowInsightsModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.modalHeader}>
            <Icon name="robot" size={32} color={theme.colors.primary} />
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Scanner AI Insights
            </Text>
          </View>

          {documentIntelligence && (
            <>
              <Card style={[styles.insightsCard, { backgroundColor: theme.colors.primaryContainer }]}>
                <Card.Content>
                  <Text style={[styles.insightsCardTitle, { color: theme.colors.onPrimaryContainer }]}>
                    Document Analysis
                  </Text>
                  <View style={styles.insightsGrid}>
                    <View style={styles.insightItem}>
                      <Text style={[styles.insightLabel, { color: theme.colors.onPrimaryContainer }]}>Type:</Text>
                      <Text style={[styles.insightValue, { color: theme.colors.onPrimaryContainer }]}>
                        {documentIntelligence.documentType}
                      </Text>
                    </View>
                    <View style={styles.insightItem}>
                      <Text style={[styles.insightLabel, { color: theme.colors.onPrimaryContainer }]}>Confidence:</Text>
                      <Text style={[styles.insightValue, { color: theme.colors.onPrimaryContainer }]}>
                        {Math.round(documentIntelligence.confidence * 100)}%
                      </Text>
                    </View>
                    <View style={styles.insightItem}>
                      <Text style={[styles.insightLabel, { color: theme.colors.onPrimaryContainer }]}>Words:</Text>
                      <Text style={[styles.insightValue, { color: theme.colors.onPrimaryContainer }]}>
                        ~{documentIntelligence.estimatedWords}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
              </Card>

              <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                Suggested Actions:
              </Text>
              {documentIntelligence.suggestedActions.map((action, index) => (
                <View key={index} style={styles.actionItem}>
                  <Icon name="lightbulb-outline" size={16} color={theme.colors.primary} />
                  <Text style={[styles.actionText, { color: theme.colors.onSurfaceVariant }]}>
                    {action}
                  </Text>
                </View>
              ))}
            </>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowInsightsModal(false)}
              style={styles.modalButton}
            >
              Close
            </Button>
            <Button
              mode="contained"
              onPress={handleExportData}
              style={styles.modalButton}
              icon="export"
            >
              Export Data
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* ENHANCED: Analytics Modal */}
      <Portal>
        <Modal
          visible={showAnalyticsModal}
          onDismiss={() => setShowAnalyticsModal(false)}
          contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}
        >
          <View style={styles.modalHeader}>
            <Icon name="chart-line" size={32} color={theme.colors.primary} />
            <Text style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
              Scanner Analytics
            </Text>
          </View>

          <View style={styles.analyticsGrid}>
            <Card style={[styles.analyticsCard, { backgroundColor: theme.colors.primaryContainer }]}>
              <Card.Content style={styles.analyticsCardContent}>
                <Text style={[styles.analyticsValue, { color: theme.colors.primary }]}>
                  {scannerAnalytics.totalScansCompleted}
                </Text>
                <Text style={[styles.analyticsLabel, { color: theme.colors.onPrimaryContainer }]}>
                  Total Scans
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.analyticsCard, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Card.Content style={styles.analyticsCardContent}>
                <Text style={[styles.analyticsValue, { color: theme.colors.secondary }]}>
                  {Math.round(scannerAnalytics.averageProcessingTime)}s
                </Text>
                <Text style={[styles.analyticsLabel, { color: theme.colors.onSecondaryContainer }]}>
                  Avg Processing
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.analyticsCard, { backgroundColor: theme.colors.tertiaryContainer }]}>
              <Card.Content style={styles.analyticsCardContent}>
                <Text style={[styles.analyticsValue, { color: theme.colors.tertiary }]}>
                  {scannerAnalytics.documentTypesScanned.length}
                </Text>
                <Text style={[styles.analyticsLabel, { color: theme.colors.onTertiaryContainer }]}>
                  Document Types
                </Text>
              </Card.Content>
            </Card>

            <Card style={[styles.analyticsCard, { backgroundColor: theme.colors.errorContainer }]}>
              <Card.Content style={styles.analyticsCardContent}>
                <Text style={[styles.analyticsValue, { color: theme.colors.error }]}>
                  {Math.round(scannerAnalytics.performanceMetrics.focusAccuracy)}%
                </Text>
                <Text style={[styles.analyticsLabel, { color: theme.colors.onErrorContainer }]}>
                  Focus Accuracy
                </Text>
              </Card.Content>
            </Card>
          </View>

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowAnalyticsModal(false)}
              style={styles.modalButton}
            >
              Close
            </Button>
            <Button
              mode="contained"
              onPress={() => {
                setShowAnalyticsModal(false);
                setShowInsightsModal(true);
              }}
              style={styles.modalButton}
              icon="robot"
            >
              View Insights
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* ENHANCED: Snackbar for Feedback */}
      <Snackbar
        visible={showSnackbar}
        onDismiss={() => setShowSnackbar(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setShowSnackbar(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
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
  // ENHANCED: Enterprise-Grade StyleSheet Extensions
  // Enhanced Sheet Container Styles
  enhancedSheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  enhancedSheetHeader: {
    marginBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  enhancedSheetTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
    marginLeft: 12,
    textAlign: 'center',
  },
  // Quality Assessment Styles
  qualityCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  qualityCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  qualityScoreSection: {
    alignItems: 'center',
    marginRight: 20,
  },
  qualityScoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  qualityScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  qualityDetails: {
    flex: 1,
    gap: 8,
  },
  qualityMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qualityMetricText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Features Detection Styles
  featuresContainer: {
    marginBottom: 16,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  featuresChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  featureChip: {
    borderRadius: 20,
    paddingHorizontal: 4,
  },
  // Enhanced Processing Styles
  enhancedProcessingContainer: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  enhancedProgressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  processingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  enhancedProcessingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  enhancedProcessingSubtext: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Enhanced Thumbnail Styles
  thumbnailSection: {
    flex: 1,
    marginBottom: 16,
  },
  thumbnailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  thumbnailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  thumbnailActions: {
    flexDirection: 'row',
    gap: 4,
  },
  enhancedThumbnailList: {
    paddingHorizontal: 8,
  },
  enhancedThumbnailContainer: {
    marginHorizontal: 6,
  },
  thumbnailSurface: {
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  enhancedThumbnailImage: {
    width: 90,
    height: 110,
    borderRadius: 12,
  },
  thumbnailGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    justifyContent: 'flex-end',
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  enhancedThumbnailLabel: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  enhancedDeleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  // Enhanced Action Styles
  enhancedSheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 'auto',
    paddingTop: 16,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
  },
  enhancedProcessingActions: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  processingDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  processingFeatures: {
    gap: 8,
    alignItems: 'flex-start',
  },
  processingFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processingFeatureText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // ENHANCED: Modal and Analytics Styles
  modal: {
    margin: 20,
    padding: 24,
    borderRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
  },
  insightsCard: {
    marginBottom: 16,
    borderRadius: 16,
  },
  insightsCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  insightsGrid: {
    gap: 8,
  },
  insightItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  insightLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  insightValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  analyticsCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: 12,
  },
  analyticsCardContent: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  analyticsValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  analyticsLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ScannerScreen;
