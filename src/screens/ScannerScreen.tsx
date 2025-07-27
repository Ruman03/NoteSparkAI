import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
  Animated,
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
import { useCameraDevice, Camera, useCameraPermission } from 'react-native-vision-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import textRecognition from '@react-native-ml-kit/text-recognition';
import { RootStackParamList } from '../types/navigation';
import Config from 'react-native-config';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('back');
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!hasPermission) {
      requestPermission();
    }
    return () => setIsActive(false);
  }, [hasPermission, requestPermission]);

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

  const capturePhoto = async () => {
    if (!device || !cameraRef.current) {
      Alert.alert('Error', 'Camera device not available');
      return;
    }

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
          setExtractedText(ocrResult.text);
          setShowResults(true);
        } else {
          Alert.alert(
            'No Text Found',
            'Could not detect any text in the document. Please ensure the document is well-lit and clearly visible.',
            [{ text: 'Try Again', onPress: () => {} }]
          );
        }
      } catch (ocrError) {
        console.error('OCR Error:', ocrError);
        Alert.alert(
          'Processing Error',
          'Failed to extract text from the image. Please try again.',
          [{ text: 'Try Again', onPress: () => {} }]
        );
      }
    } catch (error) {
      console.error('Capture error:', error);
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
      
      <Camera
        ref={cameraRef}
        style={styles.camera}
        device={device}
        isActive={isActive}
        photo={true}
      />
      
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
            icon={getFlashIcon()}
            size={24}
            iconColor="white"
            onPress={toggleFlash}
          />
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

        {/* Capture controls */}
        <View style={styles.captureContainer}>
          {isProcessing ? (
            <Surface style={styles.processingContainer} elevation={4}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.processingText, { color: theme.colors.onSurface }]}>
                Extracting text...
              </Text>
            </Surface>
          ) : (
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <FAB
                icon="camera"
                onPress={capturePhoto}
                style={[styles.captureButton, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                size="large"
              />
            </Animated.View>
          )}
        </View>
      </SafeAreaView>
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
  captureContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  processingText: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
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
});

export default ScannerScreen;
