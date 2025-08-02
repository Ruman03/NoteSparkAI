// Image Quality Analysis Service
// Provides real-time feedback on document scan quality

interface QualityMetrics {
  lighting: number;        // 0-1, brightness and contrast quality
  focus: number;          // 0-1, sharpness and clarity
  rotation: number;       // 0-1, document orientation alignment
  textDensity: number;    // 0-1, amount of readable text detected
  overall: number;        // 0-1, combined quality score
}

interface QualityFeedback {
  score: QualityMetrics;
  suggestions: string[];
  status: 'excellent' | 'good' | 'fair' | 'poor';
  canCapture: boolean;
}

interface LightingAnalysis {
  brightness: number;
  contrast: number;
  evenness: number;
  shadows: boolean;
  glare: boolean;
}

interface FocusAnalysis {
  sharpness: number;
  blur: number;
  edgeDefinition: number;
}

interface DocumentAnalysis {
  corners: Array<{ x: number; y: number }>;
  rotation: number;
  perspective: number;
  bounds: { x: number; y: number; width: number; height: number };
}

export class ImageQualityService {
  private static instance: ImageQualityService;

  public static getInstance(): ImageQualityService {
    if (!ImageQualityService.instance) {
      ImageQualityService.instance = new ImageQualityService();
    }
    return ImageQualityService.instance;
  }

  // Analyze lighting conditions
  public analyzeLighting(imageData: any): LightingAnalysis {
    // In a real implementation, this would analyze pixel data
    // For now, we'll simulate realistic lighting analysis
    
    const simulatedBrightness = Math.random() * 0.4 + 0.5; // 0.5-0.9
    const simulatedContrast = Math.random() * 0.3 + 0.6;   // 0.6-0.9
    const simulatedEvenness = Math.random() * 0.2 + 0.7;   // 0.7-0.9
    
    return {
      brightness: simulatedBrightness,
      contrast: simulatedContrast,
      evenness: simulatedEvenness,
      shadows: simulatedBrightness < 0.6,
      glare: simulatedBrightness > 0.85,
    };
  }

  // Analyze focus and sharpness
  public analyzeFocus(imageData: any): FocusAnalysis {
    // Simulate focus analysis based on edge detection
    const simulatedSharpness = Math.random() * 0.3 + 0.6;   // 0.6-0.9
    const simulatedBlur = 1 - simulatedSharpness;
    const simulatedEdgeDefinition = Math.random() * 0.2 + 0.7; // 0.7-0.9
    
    return {
      sharpness: simulatedSharpness,
      blur: simulatedBlur,
      edgeDefinition: simulatedEdgeDefinition,
    };
  }

  // Analyze document positioning and rotation
  public analyzeDocumentPosition(imageData: any): DocumentAnalysis {
    // Simulate document detection and corner analysis
    const rotation = (Math.random() - 0.5) * 20; // -10 to +10 degrees
    const perspective = Math.random() * 0.3 + 0.7; // 0.7-1.0
    
    return {
      corners: [
        { x: 0.1, y: 0.1 },
        { x: 0.9, y: 0.1 },
        { x: 0.9, y: 0.9 },
        { x: 0.1, y: 0.9 },
      ],
      rotation: Math.abs(rotation),
      perspective,
      bounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
    };
  }

  // Analyze text density and readability
  public analyzeTextDensity(imageData: any): number {
    // Simulate text detection analysis
    return Math.random() * 0.4 + 0.6; // 0.6-1.0
  }

  // Comprehensive quality analysis
  public analyzeQuality(imageData: any): QualityFeedback {
    const lighting = this.analyzeLighting(imageData);
    const focus = this.analyzeFocus(imageData);
    const document = this.analyzeDocumentPosition(imageData);
    const textDensity = this.analyzeTextDensity(imageData);

    // Calculate individual metrics
    const lightingScore = (lighting.brightness + lighting.contrast + lighting.evenness) / 3;
    const focusScore = (focus.sharpness + focus.edgeDefinition) / 2;
    const rotationScore = Math.max(0, 1 - (document.rotation / 15)); // Penalize rotation > 15°
    const textScore = textDensity;

    // Calculate overall score with weighted averages
    const overall = (
      lightingScore * 0.3 +
      focusScore * 0.3 +
      rotationScore * 0.2 +
      textScore * 0.2
    );

    const metrics: QualityMetrics = {
      lighting: lightingScore,
      focus: focusScore,
      rotation: rotationScore,
      textDensity: textScore,
      overall,
    };

    // Generate suggestions based on analysis
    const suggestions = this.generateSuggestions(lighting, focus, document, textDensity);

    // Determine status and capture readiness
    let status: 'excellent' | 'good' | 'fair' | 'poor';
    let canCapture: boolean;

    if (overall >= 0.85) {
      status = 'excellent';
      canCapture = true;
    } else if (overall >= 0.7) {
      status = 'good';
      canCapture = true;
    } else if (overall >= 0.5) {
      status = 'fair';
      canCapture = true;
    } else {
      status = 'poor';
      canCapture = false;
    }

    return {
      score: metrics,
      suggestions,
      status,
      canCapture,
    };
  }

  // Generate actionable suggestions for improvement
  private generateSuggestions(
    lighting: LightingAnalysis,
    focus: FocusAnalysis,
    document: DocumentAnalysis,
    textDensity: number
  ): string[] {
    const suggestions: string[] = [];

    // Lighting suggestions
    if (lighting.brightness < 0.6) {
      suggestions.push('📱 Move to better lighting or turn on flash');
    }
    if (lighting.shadows) {
      suggestions.push('☀️ Avoid shadows on the document');
    }
    if (lighting.glare) {
      suggestions.push('✨ Reduce glare by changing angle');
    }
    if (lighting.contrast < 0.6) {
      suggestions.push('🔆 Increase contrast for better text clarity');
    }

    // Focus suggestions
    if (focus.sharpness < 0.7) {
      suggestions.push('📸 Tap to focus on the document');
    }
    if (focus.blur > 0.4) {
      suggestions.push('🎯 Hold steady and wait for focus');
    }

    // Document positioning suggestions
    if (document.rotation > 10) {
      suggestions.push('🔄 Rotate device to align with document');
    }
    if (document.perspective < 0.8) {
      suggestions.push('📐 Position camera directly above document');
    }

    // Text density suggestions
    if (textDensity < 0.7) {
      suggestions.push('📄 Ensure document fills most of the frame');
    }

    // Default encouragement
    if (suggestions.length === 0) {
      suggestions.push('✅ Perfect! Ready to capture');
    }

    return suggestions;
  }

  // Real-time quality monitoring for tutorial
  public startQualityMonitoring(
    onQualityUpdate: (feedback: QualityFeedback) => void,
    intervalMs: number = 1000
  ): () => void {
    const interval = setInterval(() => {
      // Simulate camera frame analysis
      const mockImageData = {}; // In real implementation, this would be camera frame data
      const feedback = this.analyzeQuality(mockImageData);
      onQualityUpdate(feedback);
    }, intervalMs);

    return () => clearInterval(interval);
  }

  // Check if current quality meets minimum standards
  public meetsQualityStandards(feedback: QualityFeedback, strict: boolean = false): boolean {
    const threshold = strict ? 0.8 : 0.6;
    return feedback.score.overall >= threshold && feedback.canCapture;
  }

  // Get quality status color for UI
  public getStatusColor(status: 'excellent' | 'good' | 'fair' | 'poor'): string {
    switch (status) {
      case 'excellent':
        return '#4CAF50'; // Green
      case 'good':
        return '#8BC34A'; // Light Green
      case 'fair':
        return '#FF9800'; // Orange
      case 'poor':
        return '#F44336'; // Red
      default:
        return '#9E9E9E'; // Gray
    }
  }

  // Get quality description for users
  public getStatusDescription(status: 'excellent' | 'good' | 'fair' | 'poor'): string {
    switch (status) {
      case 'excellent':
        return 'Perfect quality - Ready to scan!';
      case 'good':
        return 'Good quality - Safe to capture';
      case 'fair':
        return 'Fair quality - Consider improvements';
      case 'poor':
        return 'Poor quality - Adjustments needed';
      default:
        return 'Analyzing...';
    }
  }

  // Calculate improvement score from previous analysis
  public calculateImprovement(
    previous: QualityFeedback,
    current: QualityFeedback
  ): {
    improved: boolean;
    improvementScore: number;
    bestImprovement: keyof QualityMetrics;
  } {
    const prevScore = previous.score.overall;
    const currScore = current.score.overall;
    const improvement = currScore - prevScore;

    // Find which metric improved the most
    const improvements: Record<keyof QualityMetrics, number> = {
      lighting: current.score.lighting - previous.score.lighting,
      focus: current.score.focus - previous.score.focus,
      rotation: current.score.rotation - previous.score.rotation,
      textDensity: current.score.textDensity - previous.score.textDensity,
      overall: improvement,
    };

    const bestImprovement = Object.entries(improvements)
      .filter(([key]) => key !== 'overall')
      .reduce((best, [key, value]) => 
        value > improvements[best] ? key as keyof QualityMetrics : best,
        'lighting' as keyof QualityMetrics
      );

    return {
      improved: improvement > 0.05, // Significant improvement threshold
      improvementScore: improvement,
      bestImprovement,
    };
  }
}

export type { QualityMetrics, QualityFeedback, LightingAnalysis, FocusAnalysis, DocumentAnalysis };
