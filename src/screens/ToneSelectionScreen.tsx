import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Surface, Button, Text, useTheme, Card, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import type { ToneSelectionScreenNavigationProp, RootStackParamList } from '../types/navigation';
import { AIService } from '../services/AIService';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const { width } = Dimensions.get('window');

type ToneSelectionRouteProp = RouteProp<RootStackParamList, 'ToneSelection'>;

interface ToneOption {
  id: 'professional' | 'casual' | 'simplified';
  title: string;
  description: string;
  icon: string;
  colors: string[];
  example: string;
}

const toneOptions: ToneOption[] = [
  {
    id: 'professional',
    title: 'Professional',
    description: 'Formal, structured notes perfect for business and academic use',
    icon: 'briefcase',
    colors: ['#1976D2', '#1565C0'],
    example: 'Well-organized bullet points with clear headings and formal language'
  },
  {
    id: 'casual',
    title: 'Casual',
    description: 'Friendly, conversational tone that\'s easy to read and understand',
    icon: 'chat',
    colors: ['#388E3C', '#2E7D32'],
    example: 'Natural language with personal touches and easy-to-follow explanations'
  },
  {
    id: 'simplified',
    title: 'Simplified',
    description: 'Clear, concise summaries focusing on key points only',
    icon: 'lightbulb',
    colors: ['#F57C00', '#EF6C00'],
    example: 'Short sentences, main ideas highlighted, perfect for quick review'
  }
];

export default function ToneSelectionScreen() {
  const navigation = useNavigation<ToneSelectionScreenNavigationProp>();
  const route = useRoute<ToneSelectionRouteProp>();
  const theme = useTheme();
  const { extractedText } = route.params;

  const [selectedTone, setSelectedTone] = useState<'professional' | 'casual' | 'simplified' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleToneSelect = (toneId: 'professional' | 'casual' | 'simplified') => {
    setSelectedTone(toneId);
  };

  const handleContinue = async () => {
    if (!selectedTone) return;

    setIsProcessing(true);
    try {
      const aiService = AIService.getInstance();
      const result = await aiService.transformTextToNote({
        text: extractedText,
        tone: selectedTone
      });
      
      navigation.navigate('Editor', {
        noteText: result.transformedText,
        tone: selectedTone,
        originalText: extractedText
      });
    } catch (error) {
      console.error('Failed to transform text:', error);
      // For now, continue with original text if AI fails
      navigation.navigate('Editor', {
        noteText: extractedText,
        tone: selectedTone,
        originalText: extractedText
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const renderToneCard = (option: ToneOption) => {
    const isSelected = selectedTone === option.id;
    
    return (
      <Card 
        key={option.id}
        style={[
          styles.toneCard,
          isSelected && { borderColor: theme.colors.primary, borderWidth: 2 }
        ]}
        onPress={() => handleToneSelect(option.id)}
      >
        <LinearGradient
          colors={option.colors}
          style={styles.gradientHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Icon name={option.icon} size={32} color="white" />
          <Text variant="headlineSmall" style={styles.toneTitle}>
            {option.title}
          </Text>
        </LinearGradient>
        
        <Card.Content style={styles.toneContent}>
          <Text variant="bodyMedium" style={[styles.toneDescription, { color: theme.colors.onSurface }]}>
            {option.description}
          </Text>
          
          <View style={[styles.exampleContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Text variant="labelSmall" style={[styles.exampleLabel, { color: theme.colors.onSurfaceVariant }]}>
              Example style:
            </Text>
            <Text variant="bodySmall" style={[styles.exampleText, { color: theme.colors.onSurfaceVariant }]}>
              {option.example}
            </Text>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium" style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
          Choose Your Style
        </Text>
        <Text variant="bodyMedium" style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
          Select how you'd like your notes to be formatted
        </Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.originalTextContainer}>
          <Surface style={[styles.originalTextCard, { backgroundColor: theme.colors.surfaceVariant }]} elevation={1}>
            <Text variant="labelMedium" style={[styles.originalTextLabel, { color: theme.colors.onSurfaceVariant }]}>
              Extracted Text:
            </Text>
            <Text 
              variant="bodySmall" 
              style={[styles.originalText, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={3}
            >
              {extractedText}
            </Text>
          </Surface>
        </View>

        <View style={styles.tonesContainer}>
          {toneOptions.map(renderToneCard)}
        </View>
      </ScrollView>

      <Surface style={[styles.bottomContainer, { backgroundColor: theme.colors.surface }]} elevation={4}>
        <Button
          mode="contained"
          onPress={handleContinue}
          disabled={!selectedTone || isProcessing}
          loading={isProcessing}
          style={styles.continueButton}
          contentStyle={styles.continueButtonContent}
        >
          {isProcessing ? 'Transforming...' : 'Continue'}
        </Button>
      </Surface>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    alignItems: 'center',
  },
  headerTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  headerSubtitle: {
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  originalTextContainer: {
    marginBottom: 24,
  },
  originalTextCard: {
    padding: 16,
    borderRadius: 12,
  },
  originalTextLabel: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  originalText: {
    lineHeight: 20,
  },
  tonesContainer: {
    gap: 16,
  },
  toneCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
  },
  gradientHeader: {
    padding: 20,
    alignItems: 'center',
    gap: 8,
  },
  toneTitle: {
    color: 'white',
    fontWeight: 'bold',
  },
  toneContent: {
    padding: 20,
  },
  toneDescription: {
    marginBottom: 16,
    lineHeight: 22,
  },
  exampleContainer: {
    padding: 12,
    borderRadius: 8,
  },
  exampleLabel: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  exampleText: {
    lineHeight: 18,
    fontStyle: 'italic',
  },
  bottomContainer: {
    padding: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  continueButton: {
    paddingVertical: 4,
  },
  continueButtonContent: {
    paddingVertical: 8,
  },
});
