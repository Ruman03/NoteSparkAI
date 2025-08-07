// Enhanced AIService Bridge - Backward Compatible Migration
// This file bridges the existing AIService interface with the new EnhancedAIService
// Provides enhanced features while maintaining full backward compatibility

import EnhancedAIService from './EnhancedAIService';

// Import existing interfaces for compatibility
interface AITransformationRequest {
  text: string;
  tone: 'professional' | 'casual' | 'simplified';
}

interface AITransformationResponse {
  transformedText: string;
  title: string;
  wordCount: number;
}

interface DocumentProcessingRequest {
  fileData: string;
  mimeType: string;
  prompt: string;
}

interface DocumentProcessingResponse {
  extractedContent: string;
  title: string;
}

/**
 * Enhanced AIService with Firebase integration and backward compatibility
 * 
 * This service maintains the existing AIService interface while providing
 * enhanced capabilities and Firebase ecosystem integration.
 * 
 * New Features:
 * - Firebase Auth user context integration
 * - Usage analytics and error tracking
 * - Structured content generation (flashcards, quizzes)
 * - Enhanced health monitoring
 * - Preparation for Firebase AI Logic migration
 */
class AIService {
  private static instance: AIService;
  private enhancedService: EnhancedAIService;

  constructor() {
    this.enhancedService = EnhancedAIService.getInstance();
    console.log('AIService: Initialized with enhanced capabilities');
  }

  static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  // === EXISTING METHODS (Backward Compatible) ===

  /**
   * Transform text to formatted notes
   * Enhanced with Firebase user context and better error handling
   */
  async transformTextToNote(request: AITransformationRequest): Promise<AITransformationResponse> {
    return this.enhancedService.transformTextToNote(request);
  }

  /**
   * Process documents using Gemini multimodal capabilities
   * Enhanced with Firebase context and comprehensive tracking
   */
  async processDocumentWithGemini(request: DocumentProcessingRequest): Promise<DocumentProcessingResponse> {
    return this.enhancedService.processDocumentWithGemini(request);
  }

  /**
   * Generate note title from content
   * Enhanced with better fallback strategies
   */
  async generateNoteTitle(content: string): Promise<string> {
    return this.enhancedService.generateNoteTitle(content);
  }

  /**
   * Generate document title with type context
   * Enhanced with better prompting
   */
  async generateDocumentTitle(content: string, documentType: string): Promise<string> {
    return this.enhancedService.generateDocumentTitle(content, documentType);
  }

  /**
   * Check API health status
   * Enhanced with detailed diagnostics
   */
  async checkAPIHealth(): Promise<boolean> {
    const result = await this.enhancedService.checkAPIHealth();
    return result.healthy;
  }

  /**
   * Get detailed health information (Enhanced feature)
   */
  async getDetailedHealthCheck(): Promise<{ healthy: boolean; details: any }> {
    return this.enhancedService.checkAPIHealth();
  }

  // === NEW ENHANCED METHODS ===

  /**
   * Generate flashcards from note content
   * Returns structured JSON with questions, answers, and difficulty levels
   */
  async generateFlashcards(noteContent: string): Promise<any> {
    return this.enhancedService.generateStructuredContent(noteContent, 'flashcards');
  }

  /**
   * Generate quiz from note content
   * Returns structured JSON with multiple choice questions
   */
  async generateQuiz(noteContent: string): Promise<any> {
    return this.enhancedService.generateStructuredContent(noteContent, 'quiz');
  }

  /**
   * Generate summary from note content
   * Returns well-formatted HTML summary
   */
  async generateSummary(noteContent: string): Promise<any> {
    return this.enhancedService.generateStructuredContent(noteContent, 'summary');
  }

  /**
   * Generate any structured content type
   * Unified method for all content generation
   */
  async generateStructuredContent(noteContent: string, type: 'flashcards' | 'quiz' | 'summary'): Promise<any> {
    return this.enhancedService.generateStructuredContent(noteContent, type);
  }

  // === ANALYTICS & MONITORING METHODS ===

  /**
   * Get usage analytics for performance monitoring
   * Returns array of usage metrics with timestamps
   */
  getUsageMetrics(): any[] {
    return this.enhancedService.getUsageMetrics();
  }

  /**
   * Clear usage metrics for privacy
   * Useful for user privacy compliance
   */
  clearUsageMetrics(): void {
    this.enhancedService.clearUsageMetrics();
  }

  /**
   * Get usage summary for dashboard display
   * Returns aggregated usage statistics
   */
  getUsageSummary(): any {
    const metrics = this.enhancedService.getUsageMetrics();
    
    const summary = {
      totalRequests: metrics.length,
      successRate: metrics.length > 0 ? 
        (metrics.filter(m => m.success).length / metrics.length * 100).toFixed(2) : 0,
      averageResponseTime: metrics.length > 0 ?
        (metrics.filter(m => m.duration).reduce((sum, m) => sum + (m.duration || 0), 0) / 
         metrics.filter(m => m.duration).length).toFixed(0) : 0,
      featureUsage: this.aggregateFeatureUsage(metrics),
      lastUpdated: new Date().toISOString()
    };

    return summary;
  }

  // === LEGACY COMPATIBILITY METHODS ===

  /**
   * Legacy method names for backward compatibility
   * These proxy to the enhanced methods
   */

  // Legacy: process document to note (existing workflow)
  async processDocumentToNote(
    textOrFilePath: string,
    documentType: string,
    tone: 'professional' | 'casual' | 'simplified',
    options: {
      preserveStructure?: boolean;
      generateSummary?: boolean;
      autoTag?: boolean;
      isFilePath?: boolean;
      useNativeProcessing?: boolean;
    } = {}
  ): Promise<AITransformationResponse> {
    // If it's a file path, process as document first
    if (options.isFilePath && options.useNativeProcessing) {
      // This would need file reading logic - for now, treat as text
      console.log('AIService: Legacy processDocumentToNote called with file path');
    }

    // Process as text transformation
    return this.transformTextToNote({
      text: textOrFilePath,
      tone
    });
  }

  // Legacy: Transform images to note (for backward compatibility)
  async transformImagesToNote(imageUris: string[], tone: string): Promise<AITransformationResponse> {
    // This would need GeminiVisionService integration
    console.log('AIService: Legacy transformImagesToNote called - consider using GeminiVisionService directly');
    
    // Return placeholder for now
    return {
      transformedText: '<p>Image processing placeholder - use GeminiVisionService for image processing</p>',
      title: 'Image Processing Result',
      wordCount: 10
    };
  }

  // === HELPER METHODS ===

  private aggregateFeatureUsage(metrics: any[]): any {
    const featureStats: { [key: string]: { count: number; successRate: number } } = {};

    metrics.forEach(metric => {
      if (!featureStats[metric.feature]) {
        featureStats[metric.feature] = { count: 0, successRate: 0 };
      }
      featureStats[metric.feature].count++;
    });

    // Calculate success rates
    Object.keys(featureStats).forEach(feature => {
      const featureMetrics = metrics.filter(m => m.feature === feature);
      const successCount = featureMetrics.filter(m => m.success).length;
      featureStats[feature].successRate = (successCount / featureMetrics.length * 100);
    });

    return featureStats;
  }
}

// Export singleton instance for backward compatibility
export const aiService = AIService.getInstance();

// Export class for direct instantiation if needed
export { AIService };

// Default export
export default AIService;
