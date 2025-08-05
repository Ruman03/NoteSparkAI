import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { UploadSession, DocumentMetadata } from './index';

// Main Stack Navigator Types
export type RootStackParamList = {
  MainTabs: { screen?: keyof MainTabParamList } | undefined;
  DocumentUpload: undefined;
  DocumentPreview: {
    uploadSession: UploadSession;
  };
  ToneSelection: { 
    extractedText?: string;
    imageUri?: string;
    imageUris?: string[]; // For multi-page scanning
    isMultiPage?: boolean;
    documentText?: string; // For document uploads
    documentMetadata?: DocumentMetadata;
    isDocumentUpload?: boolean;
  };
  Editor: { 
    noteId?: string;
    noteText: string; 
    tone: 'professional' | 'casual' | 'simplified';
    originalText?: string;
    noteTitle?: string;
  };
};

// Tab Navigator Types
export type MainTabParamList = {
  Home: undefined;
  Scanner: undefined;
  Library: undefined;
};

// Combined Navigation Props
export type HomeScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type ScannerScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Scanner'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type LibraryScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Library'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type DocumentUploadScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DocumentUpload'
>;

export type DocumentPreviewScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'DocumentPreview'
>;

export type ToneSelectionScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ToneSelection'
>;

export type EditorScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Editor'
>;

// Route Props
export type DocumentPreviewScreenRouteProp = {
  route: {
    params: {
      uploadSession: UploadSession;
    };
  };
};

export type ToneSelectionScreenRouteProp = {
  route: {
    params: {
      extractedText?: string;
      imageUri?: string;
      imageUris?: string[]; // For multi-page scanning
      isMultiPage?: boolean;
      documentText?: string; // For document uploads
      documentMetadata?: DocumentMetadata;
      isDocumentUpload?: boolean;
    };
  };
};

export type EditorScreenRouteProp = {
  route: {
    params: {
      noteText: string;
      tone: 'professional' | 'casual' | 'simplified';
      originalText?: string;
    };
  };
};
