// NoteSpark AI - Document Processing Service
// Feature 1.2: Smart Document Upload System
// Handles PDF, DOCX, PPTX uploads with intelligent content extraction

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import type { 
  DocumentFile, 
  SupportedDocumentType, 
  DocumentUploadProgress, 
  DocumentMetadata, 
  ProcessingOptions, 
  DocumentProcessingResult,
  DocumentStructure,
  DocumentChunk 
} from '../types';

export class DocumentProcessor {
  private static instance: DocumentProcessor;

  // Supported document types configuration
  public static readonly SUPPORTED_TYPES: SupportedDocumentType[] = [
    {
      mimeType: 'application/pdf',
      extension: '.pdf',
      displayName: 'PDF Document',
      icon: 'file-pdf',
      maxSize: 50 * 1024 * 1024, // 50MB for Pro users, 5MB for free users
      description: 'Portable Document Format'
    },
    {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
      displayName: 'Word Document',
      icon: 'file-word',
      maxSize: 25 * 1024 * 1024, // 25MB
      description: 'Microsoft Word Document'
    },
    {
      mimeType: 'application/msword',
      extension: '.doc',
      displayName: 'Word Document (Legacy)',
      icon: 'file-word',
      maxSize: 25 * 1024 * 1024, // 25MB
      description: 'Microsoft Word 97-2003 Document'
    },
    {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: '.pptx',
      displayName: 'PowerPoint Presentation',
      icon: 'file-powerpoint',
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'Microsoft PowerPoint Presentation'
    },
    {
      mimeType: 'application/vnd.ms-powerpoint',
      extension: '.ppt',
      displayName: 'PowerPoint Presentation (Legacy)',
      icon: 'file-powerpoint',
      maxSize: 50 * 1024 * 1024, // 50MB
      description: 'Microsoft PowerPoint 97-2003 Presentation'
    },
    {
      mimeType: 'text/plain',
      extension: '.txt',
      displayName: 'Text File',
      icon: 'file-text',
      maxSize: 10 * 1024 * 1024, // 10MB
      description: 'Plain Text File'
    }
  ];

  public static getInstance(): DocumentProcessor {
    if (!DocumentProcessor.instance) {
      DocumentProcessor.instance = new DocumentProcessor();
    }
    return DocumentProcessor.instance;
  }

  /**
   * Validate if a file is supported and meets size requirements
   */
  public validateFile(file: DocumentFile, isPremiumUser: boolean = false): { 
    isValid: boolean; 
    error?: string; 
    supportedType?: SupportedDocumentType;
  } {
    // Find supported type
    const supportedType = DocumentProcessor.SUPPORTED_TYPES.find(
      type => type.mimeType === file.type || 
              file.name.toLowerCase().endsWith(type.extension)
    );

    if (!supportedType) {
      return {
        isValid: false,
        error: `Unsupported file type. Supported formats: ${DocumentProcessor.SUPPORTED_TYPES.map(t => t.extension.toUpperCase()).join(', ')}`
      };
    }

    // Check file size limits
    const maxSize = isPremiumUser ? supportedType.maxSize : Math.min(supportedType.maxSize, 5 * 1024 * 1024); // 5MB limit for free users

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / (1024 * 1024));
      const fileSizeMB = Math.round(file.size / (1024 * 1024));
      return {
        isValid: false,
        error: `File too large (${fileSizeMB}MB). Maximum size: ${maxSizeMB}MB${!isPremiumUser ? ' (upgrade to Pro for larger files)' : ''}`
      };
    }

    // Basic file corruption check (size should be > 0)
    if (file.size === 0) {
      return {
        isValid: false,
        error: 'File appears to be empty or corrupted'
      };
    }

    return {
      isValid: true,
      supportedType
    };
  }

  /**
   * Process a document file with progress tracking
   */
  public async processDocument(
    file: DocumentFile,
    options: ProcessingOptions = this.getDefaultOptions(),
    onProgress?: (progress: DocumentUploadProgress) => void
  ): Promise<DocumentProcessingResult> {
    
    try {
      // Phase 1: Validation and preparation
      this.updateProgress(onProgress, {
        phase: 'uploading',
        percentage: 0,
        message: 'Validating document...',
        currentStep: 1,
        totalSteps: 5
      });

      const validation = this.validateFile(file, true); // Assume premium for now
      if (!validation.isValid) {
        throw new Error(validation.error);
      }

      // Phase 2: File reading and metadata extraction
      this.updateProgress(onProgress, {
        phase: 'processing',
        percentage: 20,
        message: 'Reading file...',
        currentStep: 2,
        totalSteps: 5
      });

      const fileContent = await this.readFileContent(file);
      const metadata = await this.extractMetadata(file, fileContent);

      // Phase 3: Content extraction
      this.updateProgress(onProgress, {
        phase: 'extracting',
        percentage: 50,
        message: 'Extracting content...',
        currentStep: 3,
        totalSteps: 5
      });

      const extractedText = await this.extractTextContent(file, fileContent, options);
      const structure = await this.analyzeDocumentStructure(extractedText);

      // Phase 4: Enhanced processing (tagging, chunking, etc.)
      this.updateProgress(onProgress, {
        phase: 'transforming',
        percentage: 80,
        message: 'Analyzing content...',
        currentStep: 4,
        totalSteps: 5
      });

      const tags = options.autoTagging ? await this.generateTags(extractedText) : undefined;
      const summary = options.generateSummary ? await this.generateSummary(extractedText) : undefined;
      const chunks = options.chunkLargeDocuments ? this.chunkDocument(extractedText, options.maxChunkSize) : undefined;

      // Phase 5: Complete
      this.updateProgress(onProgress, {
        phase: 'complete',
        percentage: 100,
        message: 'Processing complete!',
        currentStep: 5,
        totalSteps: 5
      });

      return {
        extractedText,
        metadata,
        structure,
        tags,
        summary,
        chunks
      };

    } catch (error) {
      console.error('DocumentProcessor: Error processing document:', error);
      
      this.updateProgress(onProgress, {
        phase: 'error',
        percentage: 0,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });

      throw error;
    }
  }

  /**
   * Get default processing options
   */
  public getDefaultOptions(): ProcessingOptions {
    return {
      extractImages: false, // Not implemented yet
      preserveFormatting: true,
      autoTagging: true,
      generateSummary: false, // Will use AI for this
      chunkLargeDocuments: true,
      maxChunkSize: 3000 // words
    };
  }

  /**
   * Read file content from URI
   */
  private async readFileContent(file: DocumentFile): Promise<string> {
    try {
      // For now, we'll handle text files directly
      // PDF and Office document processing would require additional libraries
      if (file.type === 'text/plain') {
        return await RNFS.readFile(file.uri, 'utf8');
      }

      // For other file types, we'll return a placeholder for now
      // In a production app, you would use libraries like:
      // - react-native-pdf-lib for PDF processing
      // - A bridge to native libraries for Office documents
      // - Or server-side processing with proper document parsers
      
      console.warn(`DocumentProcessor: Full processing for ${file.type} not yet implemented. Using placeholder.`);
      return `[Document content from ${file.name}]\n\nThis is a placeholder for document processing. In the production version, this would contain the actual extracted text from the ${file.type} file.`;
      
    } catch (error) {
      console.error('DocumentProcessor: Error reading file:', error);
      throw new Error('Failed to read document file');
    }
  }

  /**
   * Extract metadata from document
   */
  private async extractMetadata(file: DocumentFile, content: string): Promise<DocumentMetadata> {
    try {
      // Basic metadata from file info
      const metadata: DocumentMetadata = {
        fileSize: file.size,
        mimeType: file.type,
        wordCount: this.countWords(content)
      };

      // Extract title from filename
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      metadata.title = nameWithoutExt.replace(/[_-]/g, ' ').trim();

      // For text files, try to extract title from first line
      if (file.type === 'text/plain' && content) {
        const firstLine = content.split('\n')[0]?.trim();
        if (firstLine && firstLine.length < 100) {
          metadata.title = firstLine;
        }
      }

      // Estimate page count (rough approximation)
      const wordsPerPage = 300; // Average words per page
      const wordCount = metadata.wordCount || 0;
      metadata.pageCount = Math.max(1, Math.ceil(wordCount / wordsPerPage));

      return metadata;
    } catch (error) {
      console.error('DocumentProcessor: Error extracting metadata:', error);
      return {
        fileSize: file.size,
        mimeType: file.type,
        wordCount: 0
      };
    }
  }

  /**
   * Extract text content from various document types
   */
  private async extractTextContent(
    file: DocumentFile, 
    rawContent: string, 
    options: ProcessingOptions
  ): Promise<string> {
    try {
      switch (file.type) {
        case 'text/plain':
          return rawContent;
        
        default:
          // For other document types, this would use appropriate libraries
          // For now, return placeholder content
          return `Document: ${file.name}\n\n${rawContent}`;
      }
    } catch (error) {
      console.error('DocumentProcessor: Error extracting text:', error);
      throw new Error('Failed to extract text from document');
    }
  }

  /**
   * Analyze document structure (headings, paragraphs, etc.)
   */
  private async analyzeDocumentStructure(text: string): Promise<DocumentStructure> {
    const lines = text.split('\n');
    const structure: DocumentStructure = {
      headings: [],
      paragraphs: [],
      lists: []
    };

    let position = 0;
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (!trimmedLine) {
        position += line.length + 1;
        continue;
      }

      // Simple heading detection (lines that are short and don't end with punctuation)
      if (trimmedLine.length < 80 && !trimmedLine.match(/[.!?]$/)) {
        structure.headings.push({
          level: this.guessHeadingLevel(trimmedLine),
          text: trimmedLine,
          position
        });
      } 
      // List item detection
      else if (trimmedLine.match(/^\s*[-*•]\s+/) || trimmedLine.match(/^\s*\d+[.)]\s+/)) {
        // Group consecutive list items
        const listType = trimmedLine.match(/^\s*\d+[.)]\s+/) ? 'ordered' : 'unordered';
        const lastList = structure.lists[structure.lists.length - 1];
        
        if (lastList && lastList.position + 200 > position && lastList.type === listType) {
          // Add to existing list
          lastList.items.push(trimmedLine.replace(/^\s*[-*•\d+.)\s]+/, '').trim());
        } else {
          // Create new list
          structure.lists.push({
            type: listType,
            items: [trimmedLine.replace(/^\s*[-*•\d+.)\s]+/, '').trim()],
            position
          });
        }
      }
      // Regular paragraph
      else {
        structure.paragraphs.push({
          text: trimmedLine,
          position
        });
      }

      position += line.length + 1;
    }

    return structure;
  }

  /**
   * Generate automatic tags based on content
   */
  private async generateTags(text: string): Promise<string[]> {
    // Simple keyword extraction for now
    // In production, this would use AI or NLP libraries
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);

    const frequency: { [key: string]: number } = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Get most common words as tags
    const sortedWords = Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    // Filter out common stop words
    const stopWords = new Set(['this', 'that', 'with', 'have', 'will', 'from', 'they', 'been', 'have', 'their', 'said', 'each', 'which', 'there', 'what', 'about']);
    
    return sortedWords.filter(word => !stopWords.has(word)).slice(0, 5);
  }

  /**
   * Generate a summary of the document
   */
  private async generateSummary(text: string): Promise<string> {
    // Simple summary - first paragraph and last paragraph
    // In production, this would use AI for proper summarization
    const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
    
    if (paragraphs.length === 0) return 'No content to summarize.';
    if (paragraphs.length === 1) return paragraphs[0].substring(0, 200) + '...';
    
    const firstParagraph = paragraphs[0].substring(0, 100);
    const lastParagraph = paragraphs[paragraphs.length - 1].substring(0, 100);
    
    return `${firstParagraph}...\n\n${lastParagraph}...`;
  }

  /**
   * Split large documents into manageable chunks
   */
  private chunkDocument(text: string, maxChunkSize: number = 3000): DocumentChunk[] {
    const words = text.split(/\s+/);
    const chunks: DocumentChunk[] = [];
    
    if (words.length <= maxChunkSize) {
      return [{
        id: '1',
        text,
        startPosition: 0,
        endPosition: text.length,
        metadata: {
          chunkIndex: 0,
          wordCount: words.length
        }
      }];
    }

    let chunkIndex = 0;
    let startPosition = 0;
    
    for (let i = 0; i < words.length; i += maxChunkSize) {
      const chunkWords = words.slice(i, i + maxChunkSize);
      const chunkText = chunkWords.join(' ');
      const endPosition = startPosition + chunkText.length;
      
      chunks.push({
        id: (chunkIndex + 1).toString(),
        text: chunkText,
        startPosition,
        endPosition,
        metadata: {
          chunkIndex,
          wordCount: chunkWords.length
        }
      });
      
      startPosition = endPosition + 1;
      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Utility methods
   */
  private updateProgress(
    onProgress?: (progress: DocumentUploadProgress) => void, 
    progress?: DocumentUploadProgress
  ): void {
    if (onProgress && progress) {
      onProgress(progress);
    }
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  private guessHeadingLevel(text: string): number {
    // Simple heuristic for heading levels
    if (text.length <= 30 && text.toUpperCase() === text) return 1;
    if (text.length <= 50) return 2;
    return 3;
  }

  /**
   * Get file size in human-readable format
   */
  public static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get icon name for file type
   */
  public static getFileIcon(mimeType: string): string {
    const supportedType = DocumentProcessor.SUPPORTED_TYPES.find(type => type.mimeType === mimeType);
    return supportedType?.icon || 'file';
  }
}

export default DocumentProcessor;
