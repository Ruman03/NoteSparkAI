import ImageCropPicker, { ImageOrVideo } from 'react-native-image-crop-picker';
import { Alert, Platform } from 'react-native';

export interface CropOptions {
  width?: number;
  height?: number;
  freeStyleCropEnabled?: boolean;
  showCropGuidelines?: boolean;
  cropperTitle?: string;
}

export interface CropResult {
  path: string;
  width: number;
  height: number;
  size: number;
}

class ImageCroppingService {
  private static instance: ImageCroppingService;

  private constructor() {}

  public static getInstance(): ImageCroppingService {
    if (!ImageCroppingService.instance) {
      ImageCroppingService.instance = new ImageCroppingService();
    }
    return ImageCroppingService.instance;
  }

  /**
   * Open image cropper for the captured photo
   */
  public async cropImageForTextExtraction(imagePath: string, options: CropOptions = {}): Promise<CropResult | null> {
    try {
      console.log('ImageCroppingService: Starting crop for image:', imagePath);

      const defaultOptions = {
        width: 800,
        height: 600,
        freeStyleCropEnabled: true,
        showCropGuidelines: true,
        cropperTitle: 'Select Text Area to Scan',
        ...options,
      };

      // Open the cropper
      const croppedImage: ImageOrVideo = await ImageCropPicker.openCropper({
        path: imagePath,
        width: defaultOptions.width,
        height: defaultOptions.height,
        cropping: true,
        cropperToolbarTitle: defaultOptions.cropperTitle,
        showCropGuidelines: defaultOptions.showCropGuidelines,
        freeStyleCropEnabled: defaultOptions.freeStyleCropEnabled,
        mediaType: 'photo',
        includeBase64: false,
        compressImageMaxWidth: 1200,
        compressImageMaxHeight: 1200,
        compressImageQuality: 0.8,
        enableRotationGesture: true,
        avoidEmptySpaceAroundImage: true,
        cropperStatusBarColor: '#000000',
        cropperToolbarColor: '#000000',
        cropperActiveWidgetColor: '#2196F3',
        cropperToolbarWidgetColor: '#FFFFFF',
        hideBottomControls: false,
        cropperCircleOverlay: false,
      });

      if (!croppedImage || !croppedImage.path) {
        console.log('ImageCroppingService: User cancelled cropping');
        return null;
      }

      const result: CropResult = {
        path: croppedImage.path,
        width: croppedImage.width,
        height: croppedImage.height,
        size: croppedImage.size || 0,
      };

      console.log('ImageCroppingService: Cropping successful');
      console.log('ImageCroppingService: Cropped image dimensions:', `${result.width}x${result.height}`);
      console.log('ImageCroppingService: Cropped image size:', `${(result.size / 1024).toFixed(2)}KB`);

      return result;
    } catch (error: any) {
      console.error('ImageCroppingService: Cropping failed:', error);

      // Handle user cancellation gracefully
      if (error.code === 'E_PICKER_CANCELLED' || error.message?.includes('cancelled')) {
        console.log('ImageCroppingService: User cancelled cropping operation');
        return null;
      }

      // Show error for other failures
      Alert.alert(
        'Cropping Error',
        'Failed to crop the image. Please try again.',
        [{ text: 'OK' }]
      );

      return null;
    }
  }

  /**
   * Quick crop with predefined settings optimized for text extraction
   */
  public async quickCropForText(imagePath: string): Promise<CropResult | null> {
    return this.cropImageForTextExtraction(imagePath, {
      width: 1000,
      height: 800,
      freeStyleCropEnabled: true,
      showCropGuidelines: true,
      cropperTitle: '📄 Select Document Area',
    });
  }

  /**
   * Check if image cropping is available on this platform
   */
  public isAvailable(): boolean {
    try {
      return !!ImageCropPicker;
    } catch (error) {
      console.error('ImageCroppingService: Library not available:', error);
      return false;
    }
  }

  /**
   * Clean up temporary cropped images
   */
  public async cleanupTempImages(imagePaths: string[]): Promise<void> {
    try {
      for (const path of imagePaths) {
        try {
          await ImageCropPicker.cleanSingle(path);
        } catch (cleanupError) {
          console.warn('ImageCroppingService: Failed to cleanup image:', path, cleanupError);
        }
      }
    } catch (error) {
      console.error('ImageCroppingService: Cleanup error:', error);
    }
  }
}

export default ImageCroppingService;
