import { Alert } from 'react-native';
import Config from 'react-native-config';
import RNFS from 'react-native-fs';

export interface VisionResult {
  text: string;
  confidence: number;
  blocks: TextBlock[];
}

export interface TextBlock {
  text: string;
  boundingBox: BoundingBox;
  confidence: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

class VisionService {
  private static instance: VisionService;
  private apiKey: string;
  private baseUrl: string = 'https://vision.googleapis.com/v1';

  private constructor() {
    this.apiKey = Config.GOOGLE_CLOUD_VISION_API_KEY || '';
    if (!this.apiKey) {
      console.warn('VisionService: Google Cloud Vision API key not configured');
    }
  }

  public static getInstance(): VisionService {
    if (!VisionService.instance) {
      VisionService.instance = new VisionService();
    }
    return VisionService.instance;
  }

  /**
   * Extract text from image using Google Cloud Vision API
   */
  public async extractTextFromImage(imageUri: string): Promise<VisionResult | null> {
    try {
      if (!this.apiKey) {
        throw new Error('Google Cloud Vision API key not configured');
      }

      console.log('VisionService: Starting text extraction for image:', imageUri);

      // Convert image to base64
      const imageBase64 = await this.convertImageToBase64(imageUri);
      
      // Prepare request payload
      const requestBody = {
        requests: [
          {
            image: {
              content: imageBase64,
            },
            features: [
              {
                type: 'TEXT_DETECTION',
                maxResults: 1,
              },
            ],
            imageContext: {
              languageHints: ['en', 'es', 'fr', 'de'], // Add language hints for better accuracy
            },
          },
        ],
      };

      // Make API request with AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(
        `${this.baseUrl}/images:annotate?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('VisionService: API error response:', errorText);
        throw new Error(`Google Cloud Vision API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('VisionService: API response received');

      // Check for errors in response
      if (result.responses?.[0]?.error) {
        const error = result.responses[0].error;
        console.error('VisionService: API returned error:', error);
        throw new Error(`Vision API error: ${error.message}`);
      }

      // Extract text annotations
      const textAnnotations = result.responses?.[0]?.textAnnotations;
      if (!textAnnotations || textAnnotations.length === 0) {
        console.log('VisionService: No text detected in image');
        return null;
      }

      // The first annotation contains the full text
      const fullTextAnnotation = textAnnotations[0];
      const extractedText = fullTextAnnotation.description || '';

      // Calculate confidence (average of all annotations)
      const totalConfidence = textAnnotations.reduce(
        (sum: number, annotation: any) => sum + (annotation.confidence || 0.9),
        0
      );
      const averageConfidence = totalConfidence / textAnnotations.length;

      // Extract individual text blocks for advanced processing
      const blocks: TextBlock[] = textAnnotations.slice(1).map((annotation: any) => {
        const vertices = annotation.boundingPoly?.vertices || [];
        const boundingBox = this.calculateBoundingBox(vertices);
        
        return {
          text: annotation.description || '',
          boundingBox,
          confidence: annotation.confidence || 0.9,
        };
      });

      const visionResult: VisionResult = {
        text: extractedText.trim(),
        confidence: averageConfidence,
        blocks,
      };

      console.log('VisionService: Text extraction successful, length:', extractedText.length);
      console.log('VisionService: Confidence score:', averageConfidence);

      return visionResult;
    } catch (error) {
      console.error('VisionService: Text extraction failed:', error);
      return null;
    }
  }

  /**
   * Convert image file to base64 string
   */
  private async convertImageToBase64(imageUri: string): Promise<string> {
    try {
      // Remove file:// prefix if present
      const cleanUri = imageUri.replace('file://', '');
      
      // Read file as base64
      const base64String = await RNFS.readFile(cleanUri, 'base64');
      return base64String;
    } catch (error) {
      console.error('VisionService: Failed to convert image to base64:', error);
      throw new Error('Failed to process image file');
    }
  }

  /**
   * Calculate bounding box from vertices
   */
  private calculateBoundingBox(vertices: any[]): BoundingBox {
    if (vertices.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const xCoords = vertices.map((v: any) => v.x || 0);
    const yCoords = vertices.map((v: any) => v.y || 0);

    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Check if Vision API is properly configured
   */
  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get API configuration status for debugging
   */
  public getStatus(): { configured: boolean; hasApiKey: boolean } {
    return {
      configured: this.isConfigured(),
      hasApiKey: !!this.apiKey,
    };
  }
}

export default VisionService;
