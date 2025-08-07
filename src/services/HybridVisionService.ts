// NoteSpark AI - Fast OCR-Focused Vision Service
// Cost-Effective & Fast Approach: Google Cloud Vision OCR + Basic HTML Formatting
// Eliminates expensive Gemini text processing while maintaining quality
// Optional Gemini multimodal fallback for complex cases when explicitly enabled

import { GenerativeModel } from '@google/generative-ai';
import VisionService, { VisionResult } from './VisionService';
import { GeminiVisionService, GeminiVisionResult } from './GeminiVisionService';

// Enhanced interfaces for hybrid processing
interface HybridProcessingOptions {
  preferOCR?: boolean; // Default: true (cost-effective)
  useMultimodalFallback?: boolean; // Default: true
  qualityThreshold?: number; // Default: 0.7
  complexityDetection?: boolean; // Default: true
  enhanceHandwriting?: boolean; // Default: false (OCR first, then Gemini if needed)
  preserveLayout?: boolean; // Default: true
  extractTables?: boolean; // Default: true
}

interface HybridResult {
  text: string;
  formattedNote: string;
  noteTitle: string;
  confidence: number;
  processingMethod: 'ocr_only' | 'gemini_multimodal' | 'hybrid_fallback';
  costEstimate: 'low' | 'medium' | 'high';
  processingTime: number;
  metadata: {
    textLength: number;
    hasTablesDetected: boolean;
    hasHandwritingDetected: boolean;
    documentType: string;
    pageCount: number;
    ocrConfidence?: number;
    geminiUsed: boolean;
    fallbackReason?: string;
  };
}

interface ProcessingCosts {
  ocrCost: number; // Estimated cost for OCR processing
  geminiTextCost: number; // Estimated cost for text processing
  geminiMultimodalCost: number; // Estimated cost for multimodal processing
  totalCost: number;
  method: string;
}

// Cost estimation constants (per 1000 units)
const COST_ESTIMATES = {
  GOOGLE_VISION_OCR: 1.50, // $1.50 per 1000 images
  GEMINI_TEXT_INPUT: 0.00015, // $0.15 per 1M tokens
  GEMINI_TEXT_OUTPUT: 0.0006, // $0.60 per 1M tokens
  GEMINI_MULTIMODAL_INPUT: 0.002, // $2.00 per 1M tokens
  GEMINI_MULTIMODAL_OUTPUT: 0.008, // $8.00 per 1M tokens
};

// Complexity detection thresholds
const COMPLEXITY_THRESHOLDS = {
  MIN_CONFIDENCE: 0.7, // Minimum OCR confidence for direct use
  MAX_TEXT_LENGTH: 10000, // Maximum text length for simple processing
  HANDWRITING_KEYWORDS: ['handwritten', 'cursive', 'script', 'manuscript'],
  COMPLEX_LAYOUT_KEYWORDS: ['diagram', 'chart', 'graph', 'formula', 'equation', 'table'],
  TABLE_INDICATORS: ['|', '\t', 'row', 'column', 'cell'],
};

/**
 * Fast OCR-Focused Vision Service for Cost-Effective Image-to-Note Processing
 * 
 * Processing Strategy:
 * 1. Primary: Google Cloud Vision OCR (fast & cheap) + Basic HTML formatting (instant)
 * 2. Optional Fallback: Gemini Multimodal (expensive) for complex cases when explicitly enabled
 * 3. Eliminates problematic Gemini text API token limits and latency issues
 */
export class HybridVisionService {
  private static instance: HybridVisionService;
  private visionService: VisionService;
  private geminiVisionService: GeminiVisionService;
  private geminiModel: GenerativeModel | null = null;
  private processingStats = {
    totalRequests: 0,
    ocrOnlyCount: 0,
    hybridCount: 0,
    multimodalCount: 0,
    costSavings: 0, // Estimated cost savings
  };
  
  // Performance optimizations
  private responseCache = new Map<string, { formattedNote: string; noteTitle: string; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly PARALLEL_PROCESSING_LIMIT = 3; // Max concurrent OCR requests

  private constructor() {
    this.visionService = VisionService.getInstance();
    this.geminiVisionService = GeminiVisionService.getInstance();
    console.log('HybridVisionService: Initialized with cost-effective processing strategy');
  }

  public static getInstance(): HybridVisionService {
    if (!HybridVisionService.instance) {
      HybridVisionService.instance = new HybridVisionService();
    }
    return HybridVisionService.instance;
  }

  /**
   * Initialize with Gemini model for text processing
   */
  public setGeminiModel(model: GenerativeModel): void {
    if (!model) {
      throw new Error('HybridVisionService: Invalid Gemini model provided');
    }
    this.geminiModel = model;
    this.geminiVisionService.setGeminiModel(model);
    console.log('HybridVisionService: Gemini model configured for hybrid processing');
  }

  /**
   * Check if the service is properly configured
   */
  public isConfigured(): boolean {
    return this.visionService.isConfigured() && this.geminiModel !== null;
  }

  /**
   * Process single image with fast OCR-only approach
   */
  public async processImageToNote(
    imageUri: string,
    tone: 'professional' | 'casual' | 'simplified' = 'professional',
    options: HybridProcessingOptions = {}
  ): Promise<HybridResult> {
    const startTime = Date.now();
    this.processingStats.totalRequests++;

    // Normalize tone - handle 'custom' tone by defaulting to 'professional'
    const normalizedTone = ['professional', 'casual', 'simplified'].includes(tone) ? 
      tone : 'professional';

    // Set default options for OCR optimization
    const processOptions: Required<HybridProcessingOptions> = {
      preferOCR: true, // Always use OCR first
      useMultimodalFallback: false, // Disable expensive fallback by default
      qualityThreshold: 0.5, // Lower threshold for more acceptance
      complexityDetection: false, // Disable complexity checks
      enhanceHandwriting: false,
      preserveLayout: true,
      extractTables: true,
      ...options
    };

    console.log(`HybridVisionService: Processing image with fast OCR-only ${normalizedTone} approach...`);

    try {
      // Primary: Google Cloud Vision OCR (fast and cost-effective)
      if (this.visionService.isConfigured()) {
        console.log('HybridVisionService: Attempting OCR extraction...');
        
        const ocrResult = await this.visionService.extractTextFromImage(imageUri);
        
        if (ocrResult && ocrResult.confidence >= processOptions.qualityThreshold) {
          console.log(`HybridVisionService: OCR successful with ${ocrResult.confidence} confidence`);
          
          // Format with simple HTML structure (no AI needed)
          const formattedResult = this.formatTextWithBasicHTML(ocrResult.text, normalizedTone);
          
          const processingTime = Date.now() - startTime;
          this.processingStats.ocrOnlyCount++;
          
          return {
            text: ocrResult.text,
            formattedNote: formattedResult.formattedNote,
            noteTitle: formattedResult.noteTitle,
            confidence: ocrResult.confidence,
            processingMethod: 'ocr_only',
            costEstimate: 'low',
            processingTime,
            metadata: {
              textLength: ocrResult.text.length,
              hasTablesDetected: this.detectTables(ocrResult.text),
              hasHandwritingDetected: false,
              documentType: this.detectDocumentType(ocrResult.text),
              pageCount: 1,
              ocrConfidence: ocrResult.confidence,
              geminiUsed: false,
            }
          };
        } else {
          console.log('HybridVisionService: OCR confidence below threshold, checking fallback...');
        }
      }

      // Optional fallback to Gemini multimodal only if explicitly enabled
      if (processOptions.useMultimodalFallback) {
        console.log('HybridVisionService: Using expensive Gemini multimodal fallback...');
        
        const geminiResult = await this.geminiVisionService.generateStructuredNoteFromImages(
          [imageUri], 
          normalizedTone, 
          {
            preserveLayout: processOptions.preserveLayout,
            extractTables: processOptions.extractTables,
            enhanceHandwriting: true,
            detectLanguages: true,
            analyzeStructure: true,
          }
        );

        const processingTime = Date.now() - startTime;
        this.processingStats.multimodalCount++;

        return {
          text: geminiResult.text,
          formattedNote: geminiResult.formattedNote,
          noteTitle: geminiResult.noteTitle,
          confidence: geminiResult.confidence,
          processingMethod: 'gemini_multimodal',
          costEstimate: 'high',
          processingTime,
          metadata: {
            textLength: geminiResult.text.length,
            hasTablesDetected: geminiResult.metadata.hasTablesDetected,
            hasHandwritingDetected: geminiResult.metadata.hasHandwritingDetected,
            documentType: geminiResult.metadata.documentType,
            pageCount: 1,
            geminiUsed: true,
            fallbackReason: 'ocr_insufficient_quality'
          }
        };
      }

      throw new Error('OCR processing failed and fallback disabled');

    } catch (error) {
      console.error('HybridVisionService: Processing failed:', error);
      throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process multiple images with fast OCR-only approach
   */
  public async processMultipleImagesToNote(
    imageUris: string[],
    tone: 'professional' | 'casual' | 'simplified' = 'professional',
    options: HybridProcessingOptions = {}
  ): Promise<HybridResult> {
    const startTime = Date.now();
    this.processingStats.totalRequests++;

    // Normalize tone - handle 'custom' tone by defaulting to 'professional'
    const normalizedTone = ['professional', 'casual', 'simplified'].includes(tone) ? 
      tone : 'professional';

    console.log(`HybridVisionService: Processing ${imageUris.length} images with fast OCR-only approach...`);

    // Set default options for multi-page OCR processing
    const processOptions: Required<HybridProcessingOptions> = {
      preferOCR: true,
      useMultimodalFallback: false, // Disable expensive fallback by default
      qualityThreshold: 0.5, // Lower threshold for multi-page
      complexityDetection: false, // Disable complexity checks
      enhanceHandwriting: false,
      preserveLayout: true,
      extractTables: true,
      ...options
    };

    try {
      // Process all images with Google Cloud Vision OCR (parallel processing)
      if (this.visionService.isConfigured()) {
        console.log('HybridVisionService: Attempting parallel OCR extraction...');
        
        // Process images in parallel batches for speed
        const ocrResults: (VisionResult | null)[] = await this.processImagesInParallel(imageUris);
        
        // Filter successful results and calculate confidence
        const validResults = ocrResults.filter(result => result !== null) as VisionResult[];
        const hasLowConfidence = validResults.some(result => result.confidence < processOptions.qualityThreshold);

        // Check if we have enough successful OCR results
        if (validResults.length >= Math.ceil(imageUris.length * 0.7)) { // Accept if 70% successful
          const overallConfidence = validResults.reduce((sum, result) => sum + result.confidence, 0) / validResults.length;
          console.log(`HybridVisionService: Parallel OCR successful for ${validResults.length}/${imageUris.length} pages with ${overallConfidence.toFixed(3)} average confidence`);
          
          // Combine text from all successful pages
          const combinedText = validResults
            .map((result, index) => `--- PAGE ${index + 1} ---\n${result.text}`)
            .join('\n\n');

          // Format with basic HTML structure (no AI needed)
          const formattedResult = this.formatTextWithBasicHTML(combinedText, normalizedTone);
          
          const processingTime = Date.now() - startTime;
          this.processingStats.hybridCount++;
          
          return {
            text: combinedText,
            formattedNote: formattedResult.formattedNote,
            noteTitle: formattedResult.noteTitle,
            confidence: overallConfidence,
            processingMethod: 'ocr_only',
            costEstimate: 'low',
            processingTime,
            metadata: {
              textLength: combinedText.length,
              hasTablesDetected: this.detectTables(combinedText),
              hasHandwritingDetected: false,
              documentType: this.detectDocumentType(combinedText),
              pageCount: imageUris.length,
              ocrConfidence: overallConfidence,
              geminiUsed: false,
            }
          };
        } else {
          console.log('HybridVisionService: OCR success rate too low for reliable processing...');
        }
      }

      // Optional fallback to Gemini multimodal only if explicitly enabled
      if (processOptions.useMultimodalFallback) {
        console.log('HybridVisionService: Using expensive Gemini multimodal for all pages...');
        
        const geminiResult = await this.geminiVisionService.generateStructuredNoteFromImages(
          imageUris, 
          normalizedTone, 
          {
            preserveLayout: processOptions.preserveLayout,
            extractTables: processOptions.extractTables,
            enhanceHandwriting: true,
            detectLanguages: true,
            analyzeStructure: true,
            combinePages: true,
            preservePageBreaks: true,
          }
        );

        const processingTime = Date.now() - startTime;
        this.processingStats.multimodalCount++;

        return {
          text: geminiResult.text,
          formattedNote: geminiResult.formattedNote,
          noteTitle: geminiResult.noteTitle,
          confidence: geminiResult.confidence,
          processingMethod: 'gemini_multimodal',
          costEstimate: 'high',
          processingTime,
          metadata: {
            textLength: geminiResult.text.length,
            hasTablesDetected: geminiResult.metadata.hasTablesDetected,
            hasHandwritingDetected: geminiResult.metadata.hasHandwritingDetected,
            documentType: geminiResult.metadata.documentType,
            pageCount: imageUris.length,
            geminiUsed: true,
            fallbackReason: 'multi_page_complexity'
          }
        };
      }

      throw new Error('OCR processing failed and fallback disabled');

    } catch (error) {
      console.error('HybridVisionService: Multi-page OCR processing failed:', error);
      throw new Error(`Multi-page OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process multiple images in parallel for better performance
   */
  private async processImagesInParallel(imageUris: string[]): Promise<(VisionResult | null)[]> {
    const batches: string[][] = [];
    
    // Split images into batches for controlled parallelism
    for (let i = 0; i < imageUris.length; i += this.PARALLEL_PROCESSING_LIMIT) {
      batches.push(imageUris.slice(i, i + this.PARALLEL_PROCESSING_LIMIT));
    }

    const allResults: (VisionResult | null)[] = [];

    // Process each batch in parallel
    for (const batch of batches) {
      const batchPromises = batch.map(async (imageUri, index) => {
        try {
          console.log(`HybridVisionService: Processing image ${allResults.length + index + 1}/${imageUris.length} in parallel...`);
          return await this.visionService.extractTextFromImage(imageUri);
        } catch (error) {
          console.warn(`HybridVisionService: OCR error for image ${allResults.length + index + 1}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
    }

    return allResults;
  }

  /**
   * Optimized text formatting with caching and reduced latency
   */
  private async formatTextWithGeminiOptimized(
    text: string, 
    tone: 'professional' | 'casual' | 'simplified'
  ): Promise<{ formattedNote: string; noteTitle: string }> {
    // Check cache first
    const cacheKey = this.generateCacheKey(text, tone);
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      console.log('HybridVisionService: Using cached formatting result');
      return cached;
    }

    if (!this.geminiModel) {
      throw new Error('Gemini model not configured');
    }

    const prompt = this.buildOptimizedPrompt(text, tone);

    try {
      console.log('HybridVisionService: Formatting text with optimized Gemini API...');
      console.log(`HybridVisionService: Prompt preview: ${prompt.substring(0, 200)}...`);
      
      const result = await this.geminiModel.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2, // Reduced for faster processing
          topK: 10, // Increased slightly for better quality
          topP: 0.9, // Increased for better completion
          maxOutputTokens: 4096, // Increased to prevent MAX_TOKENS cutoff
        }
      });

      const response = await result.response;
      
      // Enhanced debugging for empty responses
      console.log('HybridVisionService: Response received from Gemini');
      console.log('HybridVisionService: Response candidates count:', response.candidates?.length || 0);
      
      if (response.candidates && response.candidates.length > 0) {
        const candidate = response.candidates[0];
        console.log('HybridVisionService: First candidate finish reason:', candidate.finishReason);
        console.log('HybridVisionService: First candidate safety ratings:', candidate.safetyRatings?.length || 0);
        
        // Special handling for MAX_TOKENS cutoff
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.warn('HybridVisionService: Response was cut off due to MAX_TOKENS limit');
        }
      }
      
      // Quick validation without extensive logging
      if (!response.candidates || response.candidates.length === 0) {
        console.error('HybridVisionService: No candidates in response - possible content policy violation');
        throw new Error('No response candidates from Gemini API');
      }

      const responseText = response.text();
      console.log(`HybridVisionService: Response text length: ${responseText?.length || 0}`);
      
      if (!responseText || responseText.trim().length === 0) {
        const candidate = response.candidates[0];
        if (candidate.finishReason === 'MAX_TOKENS') {
          console.error('HybridVisionService: Response cut off due to token limit - trying with shorter input');
          throw new Error('Response truncated due to MAX_TOKENS limit');
        }
        console.error('HybridVisionService: Empty response text despite having candidates');
        throw new Error('Empty response from Gemini text API');
      }

      // Extract title and format content
      const { noteTitle, formattedNote } = this.parseFormattedResponseOptimized(responseText);

      // Cache the result
      const result_obj = { formattedNote, noteTitle };
      this.setCachedResult(cacheKey, result_obj);

      console.log(`HybridVisionService: Optimized formatting completed (${text.length} → ${formattedNote.length} chars)`);
      
      return result_obj;

    } catch (error) {
      console.error('HybridVisionService: Optimized text formatting failed:', error);
      throw new Error(`Text formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Format text with basic HTML structure (no AI required)
   */
  private formatTextWithBasicHTML(
    text: string, 
    tone: 'professional' | 'casual' | 'simplified'
  ): { formattedNote: string; noteTitle: string } {
    console.log('HybridVisionService: Formatting text with basic HTML structure...');
    console.log('HybridVisionService: Raw OCR text preview:', text.substring(0, 200) + '...');
    
    // Clean and prepare text - preserve line structure
    const cleanText = text.trim()
      .replace(/\r\n/g, '\n') // Normalize Windows line endings
      .replace(/\r/g, '\n') // Normalize Mac line endings
      .replace(/[ \t]+/g, ' ') // Normalize spaces and tabs within lines
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive empty lines
      .replace(/^\s+|\s+$/gm, ''); // Trim each line
    
    const lines = cleanText.split('\n')
      .filter(line => line.length > 0);
    
    console.log(`HybridVisionService: Processing ${lines.length} lines of text`);
    console.log('HybridVisionService: First 5 lines:', lines.slice(0, 5));
    
    // Generate title from first meaningful line or document type
    let noteTitle = this.extractTitleFromText(lines);
    
    // Basic HTML structure
    let html = `<h1>${this.escapeHtml(noteTitle)}</h1>\n\n`;
    
    // Process lines to create structured content
    let inList = false;
    let skipNextLines = 0;
    
    for (let i = 0; i < lines.length; i++) {
      if (skipNextLines > 0) {
        skipNextLines--;
        continue;
      }
      
      const line = lines[i];
      
      // Skip the title line if it was used as title
      if (i === 0 && this.isLineSimilarToTitle(line, noteTitle)) {
        console.log(`HybridVisionService: Skipping title line: "${line}"`);
        continue;
      }
      
      // Skip obvious page markers
      if (this.isPageMarker(line)) {
        console.log(`HybridVisionService: Skipping page marker: "${line}"`);
        continue;
      }
      
      // Detect headers (lines with specific patterns)
      if (this.isHeaderLine(line)) {
        console.log(`HybridVisionService: Found header: "${line}"`);
        if (inList) {
          html += '</ul>\n\n';
          inList = false;
        }
        html += `<h2>${this.escapeHtml(line.replace(/:\s*$/, ''))}</h2>\n\n`;
        continue;
      }
      
      // Detect list items
      if (this.isListItem(line)) {
        console.log(`HybridVisionService: Found list item: "${line}"`);
        if (!inList) {
          html += '<ul>\n';
          inList = true;
        }
        const cleanItem = this.cleanListItem(line);
        html += `  <li>${this.escapeHtml(cleanItem)}</li>\n`;
        continue;
      }
      
      // Close list if we're in one and this isn't a list item
      if (inList) {
        html += '</ul>\n\n';
        inList = false;
      }
      
      // Handle regular content - be more conservative about grouping
      if (line.length > 0) {
        let paragraph = line;
        
        // Only combine very short continuation lines (likely OCR artifacts)
        // Be extra careful with mathematical content
        let j = i + 1;
        while (j < lines.length && 
               !this.isHeaderLine(lines[j]) && 
               !this.isListItem(lines[j]) && 
               !this.isPageMarker(lines[j]) &&
               lines[j].length > 0 &&
               lines[j].length < 30 && // Even shorter threshold
               !/^[A-Z]/.test(lines[j]) && // Don't combine lines that start with capital
               !lines[j].includes('.') && // Don't combine lines with periods
               !/[=+\-×÷<>²³]/.test(lines[j]) && // Don't combine math expressions
               !/^\d+[.)]\s/.test(lines[j]) && // Don't combine numbered items
               j - i < 2) { // Limit to 1 additional line max
          paragraph += ' ' + lines[j];
          j++;
        }
        
        // Skip the lines we consumed
        skipNextLines = j - i - 1;
        
        html += `<p>${this.escapeHtml(paragraph)}</p>\n\n`;
      }
    }
    
    // Close any remaining list
    if (inList) {
      html += '</ul>\n\n';
    }
    
    console.log(`HybridVisionService: Basic HTML formatting completed (${text.length} → ${html.length} chars)`);
    
    return {
      noteTitle,
      formattedNote: html.trim()
    };
  }

  /**
   * Check if a line is similar to the title (avoid duplication)
   */
  private isLineSimilarToTitle(line: string, title: string): boolean {
    const cleanLine = line.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const cleanTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    
    // If title is a brand name like "polige italy desio", be more strict about matching
    if (/^(polige|italy|desio|design|brand|company)/i.test(title)) {
      return cleanLine === cleanTitle; // Exact match required for brand names
    }
    
    // Check if line contains most of the title words
    const titleWords = cleanTitle.split(/\s+/).filter(w => w.length > 2);
    const lineWords = cleanLine.split(/\s+/);
    
    if (titleWords.length === 0) return false;
    
    const matchingWords = titleWords.filter(word => 
      lineWords.some(lineWord => lineWord.includes(word) || word.includes(lineWord))
    );
    
    return matchingWords.length >= Math.ceil(titleWords.length * 0.7);
  }

  /**
   * Check if a line is a page marker
   */
  private isPageMarker(line: string): boolean {
    const cleanLine = line.trim().toLowerCase();
    
    // Page markers like "--- PAGE 1 ---", "Page 2", etc.
    if (/^-+\s*page\s+\d+\s*-+$/.test(cleanLine)) return true;
    if (/^page\s+\d+$/.test(cleanLine)) return true;
    
    return false;
  }

  /**
   * Clean list item text
   */
  private cleanListItem(line: string): string {
    return line
      .replace(/^[-*+•]\s*/, '')  // Remove bullet points
      .replace(/^\d+[.)]\s*/, '') // Remove numbered lists
      .replace(/^[a-zA-Z][.)]\s*/, '') // Remove letter lists
      .trim();
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  /**
   * Extract title from text lines
   */
  private extractTitleFromText(lines: string[]): string {
    // Try different strategies to find a good title
    for (const line of lines.slice(0, 8)) { // Check more lines
      const cleanLine = line.trim();
      
      // Skip very short lines, very long lines, or obvious metadata/noise
      if (cleanLine.length < 5 || cleanLine.length > 80) continue;
      
      // Skip lines that are just symbols, noise, metadata, or brand names
      if (/^(###|用|\d{1,2}|date|day|time|page|\d+\/\d+\/\d+|\d{1,2}:\d{2}|polige|italy|desio|design)$/i.test(cleanLine)) continue;
      
      // Skip obvious brand names, watermarks, or company identifiers
      if (/^(polige\s+italy|italy\s+desio|design|brand|company|logo|watermark)\s*$/i.test(cleanLine)) continue;
      
      // Skip lines that are just numbers or single words
      if (/^\d+$/.test(cleanLine) || cleanLine.split(/\s+/).length === 1) continue;
      
      // Look for assignment-related content first (high priority)
      if (/assignment\s+(no\.?\s*)?(\d+|[a-z]+)/i.test(cleanLine)) {
        const match = cleanLine.match(/assignment\s+(no\.?\s*)?(\d+|[a-z]+)/i);
        if (match) {
          return `Assignment ${match[2]}`;
        }
      }
      
      // Look for exercise or problem references
      if (/^(ex|exercise|problem|question)\s*#?\s*(\d+)/i.test(cleanLine)) {
        const match = cleanLine.match(/^(ex|exercise|problem|question)\s*#?\s*(\d+)/i);
        if (match) {
          return `${match[1]} ${match[2]}`;
        }
      }
      
      // Look for subject names (e.g., "Calculus C-2")
      if (/^(calculus|mathematics|physics|chemistry|biology|english|history)\s+/i.test(cleanLine)) {
        return cleanLine;
      }
      
      // Good title candidate - has multiple words and reasonable length
      // But skip obvious brand/company names
      if (cleanLine.length >= 8 && cleanLine.length <= 60 && 
          cleanLine.split(/\s+/).length >= 2 &&
          !/^(polige|italy|desio|design|brand|company)/i.test(cleanLine)) {
        
        // Clean up the title
        let title = cleanLine
          .replace(/^[-*•]\s*/, '') // Remove bullet points
          .replace(/^\d+[.)]\s*/, '') // Remove numbering
          .replace(/:\s*$/, '') // Remove trailing colon
          .trim();
        
        // Ensure it's still meaningful after cleaning
        if (title.length >= 5 && title.split(/\s+/).length >= 2) {
          return title;
        }
      }
    }
    
    // Enhanced fallback based on document content
    const allText = lines.join(' ').toLowerCase();
    
    // Look for specific document types and create meaningful titles
    if (/assignment|homework|exercise/.test(allText)) {
      // Try to find assignment number or subject
      const assignmentMatch = allText.match(/assignment\s+(?:no\.?\s*)?(\d+|\w+)/);
      if (assignmentMatch) {
        return `Assignment ${assignmentMatch[1]}`;
      }
      return 'Assignment';
    }
    
    if (/lecture|notes|study|course|chapter/.test(allText)) {
      // Try to find subject or chapter
      const chapterMatch = allText.match(/chapter\s+(\d+|\w+)/);
      if (chapterMatch) {
        return `Chapter ${chapterMatch[1]} Notes`;
      }
      return 'Study Notes';
    }
    
    if (/quiz|test|exam/.test(allText)) {
      return 'Test/Quiz';
    }
    
    if (/receipt|invoice|bill/.test(allText)) {
      return 'Receipt';
    }
    
    if (/meeting|minutes/.test(allText)) {
      return 'Meeting Notes';
    }
    
    // Ultimate fallback
    const docType = this.detectDocumentType(allText);
    return docType === 'document' ? 'Document' : `${docType.charAt(0).toUpperCase() + docType.slice(1)}`;
  }

  /**
   * Check if a line should be treated as a header
   */
  private isHeaderLine(line: string): boolean {
    const cleanLine = line.trim();
    
    // Skip very short or very long lines
    if (cleanLine.length < 5 || cleanLine.length > 60) return false;
    
    // Skip obvious noise, company names/brands, or mathematical expressions
    if (/^(###|用|polige|italy|design|desio)$/i.test(cleanLine)) return false;
    
    // Skip mathematical expressions and equations
    if (/[=+\-×÷<>²³√∫∑]/.test(cleanLine)) return false;
    
    // Skip expressions that look like math functions or variables
    if (/^[a-z]\.\s*(lim|sin|cos|tan|log)/i.test(cleanLine)) return false;
    
    // Skip expressions with parentheses that look like math
    if (/^\([a-z0-9,]+\)/.test(cleanLine)) return false;
    
    // Lines that are all caps (but not too long and have reasonable word count)
    if (cleanLine === cleanLine.toUpperCase() && 
        cleanLine.length > 8 && 
        cleanLine.length < 50 &&
        cleanLine.split(/\s+/).length >= 2 &&
        cleanLine.split(/\s+/).length <= 8 &&
        !/^[A-Z]\.\s/.test(cleanLine) && // Not just initials
        !/[=+\-×÷<>²³]/.test(cleanLine)) { // Not math expressions
      return true;
    }
    
    // Lines that end with a colon (section headers)
    if (cleanLine.endsWith(':') && 
        cleanLine.length > 5 && 
        cleanLine.length < 50 &&
        cleanLine.split(/\s+/).length >= 2 &&
        !/[=+\-×÷<>²³]/.test(cleanLine)) { // Not math expressions
      return true;
    }
    
    // Lines that start with common header patterns
    if (/^(chapter|section|part|step|question|problem|solution|answer|objective|introduction|conclusion|summary)\s+/i.test(cleanLine)) {
      return true;
    }
    
    // Numbered sections (e.g., "1. Introduction", "Problem 1") - but not math expressions
    if (/^(\d+\.)\s+[A-Z]/i.test(cleanLine) && 
        cleanLine.split(/\s+/).length >= 2 &&
        !/[+\-×÷=<>²³]/.test(cleanLine)) { // Not math expressions
      return true;
    }
    
    // Roman numerals (I., II., III., etc.)
    if (/^[IVX]+\.\s+[A-Z]/i.test(cleanLine) && 
        !/[+\-×÷=<>²³]/.test(cleanLine)) { // Not math expressions
      return true;
    }
    
    return false;
  }

  /**
   * Check if a line should be treated as a list item
   */
  private isListItem(line: string): boolean {
    const cleanLine = line.trim();
    
    // Bullet points
    if (/^[-*+•]\s+/.test(cleanLine)) return true;
    
    // Numbered lists (but not standalone numbers or exercise references)
    if (/^\d+[.)]\s+\w/.test(cleanLine) && cleanLine.split(/\s+/).length >= 2) return true;
    
    // Letter lists (but not single letters or names)
    if (/^[a-zA-Z][.)]\s+\w/.test(cleanLine) && cleanLine.split(/\s+/).length >= 2) return true;
    
    // Roman numeral lists
    if (/^[ivx]+[.)]\s+\w/i.test(cleanLine) && cleanLine.split(/\s+/).length >= 2) return true;
    
    return false;
  }

  /**
   * Check if OCR result is sufficient for direct use
   */
  private isOCRResultSufficient(
    ocrResult: VisionResult, 
    options: Required<HybridProcessingOptions>
  ): boolean {
    // Check confidence threshold
    if (ocrResult.confidence < options.qualityThreshold) {
      console.log(`HybridVisionService: OCR confidence ${ocrResult.confidence} below threshold ${options.qualityThreshold}`);
      return false;
    }

    // Check if text is meaningful
    const textLength = ocrResult.text.trim().length;
    if (textLength < 10) {
      console.log('HybridVisionService: OCR text too short');
      return false;
    }

    // Check for complexity indicators if enabled
    if (options.complexityDetection) {
      const text = ocrResult.text.toLowerCase();
      
      // Check for handwriting indicators
      const hasHandwriting = COMPLEXITY_THRESHOLDS.HANDWRITING_KEYWORDS.some(keyword => 
        text.includes(keyword)
      );
      
      // Check for complex layout indicators
      const hasComplexLayout = COMPLEXITY_THRESHOLDS.COMPLEX_LAYOUT_KEYWORDS.some(keyword => 
        text.includes(keyword)
      );

      if (hasHandwriting && !options.enhanceHandwriting) {
        console.log('HybridVisionService: Handwriting detected, may need enhanced processing');
        return false;
      }

      if (hasComplexLayout) {
        console.log('HybridVisionService: Complex layout detected, may need enhanced processing');
        return false;
      }
    }

    return true;
  }

  /**
   * Format extracted text using Gemini text API (cost-effective)
   */
  private async formatTextWithGemini(
    text: string, 
    tone: 'professional' | 'casual' | 'simplified'
  ): Promise<{ formattedNote: string; noteTitle: string }> {
    if (!this.geminiModel) {
      throw new Error('Gemini model not configured');
    }

    const prompt = this.buildFormattingPrompt(text, tone);

    try {
      console.log('HybridVisionService: Formatting text with Gemini text API...');
      
      const result = await this.geminiModel.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.2, // Reduced for speed
          topK: 5, // Reduced for speed
          topP: 0.8, // Reduced for speed
          maxOutputTokens: 2048, // Reduced for speed
        }
      });

      const response = await result.response;
      
      // Simplified validation for speed
      if (!response.candidates || response.candidates.length === 0) {
        throw new Error('No response candidates from Gemini API');
      }

      const responseText = response.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error('Empty response from Gemini text API');
      }

      // Extract title and format content
      const { noteTitle, formattedNote } = this.parseFormattedResponse(responseText);

      console.log(`HybridVisionService: Successfully formatted ${text.length} chars into ${formattedNote.length} chars`);
      
      return { formattedNote, noteTitle };

    } catch (error) {
      console.error('HybridVisionService: Text formatting failed:', error);
      throw new Error(`Text formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Build prompt for text formatting (optimized for speed)
   */
  private buildFormattingPrompt(text: string, tone: string): string {
    // Reduce text length for faster processing
    const maxTextLength = 6000; // Reduced from 8000
    const processedText = text.length > maxTextLength ? 
      text.substring(0, maxTextLength) + '\n[Text truncated...]' : 
      text;

    // Simplified prompt for speed
    let basePrompt = `Transform to HTML note (${tone} tone):

REQUIREMENTS:
- Start with <h1> title
- Use <h2>, <h3>, <p>, <ul>, <li>, <strong>
- Clean OCR errors`;

    if (tone === 'professional') {
      basePrompt += '\n- Formal language';
    } else if (tone === 'casual') {
      basePrompt += '\n- Friendly tone';
    } else if (tone === 'simplified') {
      basePrompt += '\n- Simple language';
    }

    basePrompt += `\n\nTEXT:\n${processedText}\n\nHTML:`;

    return basePrompt;
  }

  /**
   * Parse formatted response to extract title and content
   */
  private parseFormattedResponse(responseText: string): { noteTitle: string; formattedNote: string } {
    // Clean the response text first - remove markdown code blocks
    let cleanedResponse = this.cleanResponseText(responseText);
    
    // Extract title from h1 tag with better cleaning
    let noteTitle = 'Untitled Note';
    const h1Match = cleanedResponse.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
      noteTitle = h1Match[1]
        .trim()
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/```html/gi, '') // Remove markdown artifacts
        .replace(/```/g, '') // Remove code blocks
        .replace(/^\*\*\s*/, '') // Remove leading **
        .replace(/\s*\*\*$/, '') // Remove trailing **
        .trim();
    } else {
      // Fallback: use first line if it looks like a title
      const firstLine = cleanedResponse.split('\n')[0].trim();
      if (firstLine.length > 0 && firstLine.length < 100 && !firstLine.includes('<')) {
        noteTitle = firstLine
          .replace(/<[^>]*>/g, '')
          .replace(/```html/gi, '')
          .replace(/```/g, '')
          .trim();
      }
    }

    // Final validation - ensure no markdown artifacts in title
    if (noteTitle.includes('```') || noteTitle === '' || noteTitle.startsWith('**')) {
      noteTitle = 'Untitled Note';
    }

    return {
      noteTitle,
      formattedNote: cleanedResponse.trim()
    };
  }

  /**
   * Clean response text by removing markdown code blocks and extra formatting
   */
  private cleanResponseText(responseText: string): string {
    let cleaned = responseText;
    
    // Remove markdown code blocks (```html, ```, etc.)
    cleaned = cleaned.replace(/```html\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');
    
    // Remove any leading/trailing markdown artifacts
    cleaned = cleaned.replace(/^\*\*\s*/gm, ''); // Remove ** at start of lines
    cleaned = cleaned.replace(/\s*\*\*$/gm, ''); // Remove ** at end of lines
    
    // Clean up multiple newlines
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    // Trim whitespace
    cleaned = cleaned.trim();
    
    return cleaned;
  }

  /**
   * Generate cache key for response caching (React Native compatible)
   */
  private generateCacheKey(text: string, tone: string): string {
    // Use first and last 100 chars + tone for cache key
    const textSample = text.length > 200 ? 
      text.substring(0, 100) + text.substring(text.length - 100) : 
      text;
    
    // Simple hash function for React Native (no Buffer dependency)
    let hash = 0;
    const combined = `${tone}_${textSample}`;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `${tone}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get cached formatting result
   */
  private getCachedResult(cacheKey: string): { formattedNote: string; noteTitle: string } | null {
    const cached = this.responseCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      return { formattedNote: cached.formattedNote, noteTitle: cached.noteTitle };
    }
    
    if (cached) {
      this.responseCache.delete(cacheKey); // Remove expired cache
    }
    
    return null;
  }

  /**
   * Set cached formatting result
   */
  private setCachedResult(cacheKey: string, result: { formattedNote: string; noteTitle: string }): void {
    this.responseCache.set(cacheKey, {
      ...result,
      timestamp: Date.now()
    });

    // Cleanup old cache entries (keep only 50 most recent)
    if (this.responseCache.size > 50) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      this.responseCache.clear();
      entries.slice(0, 50).forEach(([key, value]) => {
        this.responseCache.set(key, value);
      });
    }
  }

  /**
   * Build optimized prompt for faster processing
   */
  private buildOptimizedPrompt(text: string, tone: string): string {
    // Truncate text more aggressively for speed but allow more output
    const maxTextLength = 5000; // Slightly increased from 4000
    const processedText = text.length > maxTextLength ? 
      text.substring(0, maxTextLength) + '\n[Text truncated...]' : 
      text;

    // More concise prompt to reduce input tokens but ensure complete output
    const toneInstruction = tone === 'professional' ? 'formal style' : 
                           tone === 'casual' ? 'friendly style' : 'simple style';

    const basePrompt = `Convert to clean HTML with ${toneInstruction}:

Structure:
- <h1> for title
- <h2>/<h3> for sections
- <p> for paragraphs  
- <ul>/<li> for lists
- Fix text errors

Text:
${processedText}

HTML:`;

    return basePrompt;
  }

  /**
   * Optimized response parsing for speed
   */
  private parseFormattedResponseOptimized(responseText: string): { noteTitle: string; formattedNote: string } {
    // Quick cleanup - remove all markdown artifacts
    let cleaned = responseText
      .replace(/```html\s*/gi, '')
      .replace(/```\s*/g, '')
      .replace(/^\*\*\s*/gm, '') // Remove ** at start of lines
      .replace(/\s*\*\*$/gm, '') // Remove ** at end of lines
      .trim();
    
    // Quick title extraction with better cleaning
    let noteTitle = 'Untitled Note';
    const h1Match = cleaned.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
      noteTitle = h1Match[1]
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/```html/gi, '') // Remove any remaining markdown
        .replace(/```/g, '') // Remove any remaining code blocks
        .trim();
    }

    // Ensure noteTitle doesn't contain markdown artifacts
    if (noteTitle.includes('```') || noteTitle === '') {
      noteTitle = 'Untitled Note';
    }

    return { noteTitle, formattedNote: cleaned };
  }

  /**
   * Detect if text contains tables
   */
  private detectTables(text: string): boolean {
    return COMPLEXITY_THRESHOLDS.TABLE_INDICATORS.some(indicator => 
      text.includes(indicator)
    );
  }

  /**
   * Detect document type from text content
   */
  private detectDocumentType(text: string): string {
    const lowerText = text.toLowerCase();
    
    if (/receipt|invoice|bill|payment|purchase/.test(lowerText)) return 'receipt';
    if (/form|application|field|checkbox/.test(lowerText)) return 'form';
    if (/slide|presentation|bullet|agenda/.test(lowerText)) return 'presentation';
    if (/lecture|notes|study|course|chapter/.test(lowerText)) return 'academic';
    if (/meeting|minutes|discussion|action/.test(lowerText)) return 'meeting';
    
    return 'document';
  }

  /**
   * Estimate processing costs for transparency (OCR-focused)
   */
  public estimateProcessingCost(
    imageCount: number, 
    averageTextLength: number = 2000,
    method: 'ocr_only' | 'gemini_multimodal' = 'ocr_only'
  ): ProcessingCosts {
    if (method === 'ocr_only') {
      const ocrCost = (imageCount / 1000) * COST_ESTIMATES.GOOGLE_VISION_OCR;
      
      return {
        ocrCost,
        geminiTextCost: 0, // No Gemini text processing
        geminiMultimodalCost: 0,
        totalCost: ocrCost,
        method: 'OCR Only (Fast & Cheap)'
      };
    } else {
      const inputTokens = Math.ceil(averageTextLength / 4); // Rough token estimation
      const outputTokens = Math.ceil(averageTextLength * 1.5 / 4); // Formatted output is typically longer
      
      const multimodalCost = imageCount * 0.01 + // Rough image processing cost
        (inputTokens + outputTokens) / 1000000 * 
        (COST_ESTIMATES.GEMINI_MULTIMODAL_INPUT + COST_ESTIMATES.GEMINI_MULTIMODAL_OUTPUT);
      
      return {
        ocrCost: 0,
        geminiTextCost: 0,
        geminiMultimodalCost: multimodalCost,
        totalCost: multimodalCost,
        method: 'Gemini Multimodal (Expensive)'
      };
    }
  }

  /**
   * Get processing statistics and cost savings (OCR-focused)
   */
  public getProcessingStats(): {
    totalRequests: number;
    ocrOnlyPercentage: number;
    multimodalPercentage: number;
    estimatedCostSavings: string;
    cacheHitRate: string;
    averageProcessingTime: string;
  } {
    const total = this.processingStats.totalRequests;
    if (total === 0) {
      return {
        totalRequests: 0,
        ocrOnlyPercentage: 0,
        multimodalPercentage: 0,
        estimatedCostSavings: '0%',
        cacheHitRate: '0%',
        averageProcessingTime: '0ms'
      };
    }

    const ocrPercentage = ((this.processingStats.ocrOnlyCount + this.processingStats.hybridCount) / total) * 100;
    const multimodalPercentage = (this.processingStats.multimodalCount / total) * 100;
    
    // Estimate cost savings (OCR only vs multimodal)
    const costSavings = Math.round(ocrPercentage * 0.95); // ~95% savings with OCR-only

    return {
      totalRequests: total,
      ocrOnlyPercentage: Math.round(ocrPercentage * 100) / 100,
      multimodalPercentage: Math.round(multimodalPercentage * 100) / 100,
      estimatedCostSavings: `${costSavings}%`,
      cacheHitRate: 'N/A', // No longer using cache for OCR-only
      averageProcessingTime: 'N/A' // Could be tracked with more instrumentation
    };
  }

  /**
   * Clear response cache for memory management
   */
  public clearCache(): void {
    this.responseCache.clear();
    console.log('HybridVisionService: Response cache cleared');
  }

  /**
   * Get service health status for OCR-focused processing
   */
  public getServiceHealth(): {
    visionServiceHealthy: boolean;
    geminiServiceHealthy: boolean;
    hybridServiceHealthy: boolean;
    recommendedMethod: string;
  } {
    const visionHealthy = this.visionService.isConfigured();
    const geminiHealthy = this.geminiModel !== null;
    const hybridHealthy = visionHealthy; // OCR-focused, Gemini optional

    let recommendedMethod = 'ocr_only'; // Default to fast and cost-effective
    if (!visionHealthy && geminiHealthy) {
      recommendedMethod = 'gemini_multimodal'; // Fallback to expensive method
    } else if (!visionHealthy && !geminiHealthy) {
      recommendedMethod = 'service_unavailable';
    }

    return {
      visionServiceHealthy: visionHealthy,
      geminiServiceHealthy: geminiHealthy,
      hybridServiceHealthy: hybridHealthy,
      recommendedMethod
    };
  }
}

export default HybridVisionService;
