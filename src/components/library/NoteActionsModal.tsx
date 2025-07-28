import React from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import { 
  Modal, 
  Portal, 
  Text, 
  List,
  useTheme, 
  ActivityIndicator,
  Divider 
} from 'react-native-paper';
import type { Note } from '../../types';
import { exportNoteToPDF, exportNoteToDocx, shareNote, copyNoteToClipboard } from '../../utils/exportUtils';
import { NotesService } from '../../services/NotesService';
import { hapticService } from '../../services/HapticService';
import auth from '@react-native-firebase/auth';

interface NoteActionsModalProps {
  visible: boolean;
  note: Note | null;
  onDismiss: () => void;
  onNoteDeleted: (noteId: string) => void;
  onEditNote: (note: Note) => void;
}

const NoteActionsModal: React.FC<NoteActionsModalProps> = ({
  visible,
  note,
  onDismiss,
  onNoteDeleted,
  onEditNote,
}) => {
  const theme = useTheme();
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadingAction, setLoadingAction] = React.useState<string>('');

  const notesService = NotesService.getInstance();

  const handleDeleteNote = () => {
    if (!note) return;

    Alert.alert(
      'Delete Note',
      `Are you sure you want to delete "${note.title || 'Untitled Note'}"? This action cannot be undone.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              setLoadingAction('Deleting note...');
              
              const user = auth().currentUser;
              if (!user) {
                throw new Error('User not authenticated');
              }
              
              await notesService.deleteNote(user.uid, note.id);
              
              hapticService.success();
              onNoteDeleted(note.id);
              onDismiss();
              
              Alert.alert('Success', 'Note deleted successfully.');
            } catch (error) {
              console.error('Error deleting note:', error);
              hapticService.error();
              Alert.alert('Error', 'Failed to delete note. Please try again.');
            } finally {
              setIsLoading(false);
              setLoadingAction('');
            }
          },
        },
      ]
    );
  };

  const handleShareNote = async () => {
    if (!note) return;

    try {
      setIsLoading(true);
      setLoadingAction('Preparing to share...');
      
      await shareNote(note, { includeMetadata: true });
      hapticService.light();
      onDismiss();
    } catch (error) {
      console.error('Error sharing note:', error);
      hapticService.error();
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleExportToPDF = async () => {
    if (!note) return;

    try {
      setIsLoading(true);
      setLoadingAction('Generating PDF...');
      
      const filePath = await exportNoteToPDF(note, { includeMetadata: true });
      
      if (filePath) {
        hapticService.success();
        Alert.alert(
          'PDF Created',
          `PDF export completed successfully!`,
          [
            { text: 'OK', onPress: onDismiss },
          ]
        );
      }
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      hapticService.error();
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleExportToDocx = async () => {
    if (!note) return;

    try {
      setIsLoading(true);
      setLoadingAction('Creating Word document...');
      
      const filePath = await exportNoteToDocx(note, { includeMetadata: true });
      
      if (filePath) {
        hapticService.success();
        Alert.alert(
          'Word Document Created',
          `Document export completed successfully!`,
          [
            { text: 'OK', onPress: onDismiss },
          ]
        );
      }
    } catch (error) {
      console.error('Error exporting to DOCX:', error);
      hapticService.error();
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleCopyToClipboard = async () => {
    if (!note) return;

    try {
      setIsLoading(true);
      setLoadingAction('Copying to clipboard...');
      
      await copyNoteToClipboard(note, { includeMetadata: false });
      hapticService.light();
      onDismiss();
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      hapticService.error();
    } finally {
      setIsLoading(false);
      setLoadingAction('');
    }
  };

  const handleEditNote = () => {
    if (!note) return;
    
    hapticService.light();
    onEditNote(note);
    onDismiss();
  };

  if (!note) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.modalContainer,
          { backgroundColor: theme.colors.surface }
        ]}
      >
        <View style={styles.modalHeader}>
          <Text variant="headlineSmall" style={[styles.modalTitle, { color: theme.colors.onSurface }]}>
            {note.title || 'Untitled Note'}
          </Text>
          <Text variant="bodyMedium" style={[styles.modalSubtitle, { color: theme.colors.onSurfaceVariant }]}>
            Choose an action
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={[styles.loadingText, { color: theme.colors.onSurfaceVariant }]}>
              {loadingAction}
            </Text>
          </View>
        ) : (
          <View style={styles.actionsContainer}>
            <List.Item
              title="Edit Note"
              description="Open note in editor"
              left={(props) => <List.Icon {...props} icon="pencil" color={theme.colors.primary} />}
              onPress={handleEditNote}
              style={styles.actionItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title="Share Note"
              description="Share via system share sheet"
              left={(props) => <List.Icon {...props} icon="share" color={theme.colors.primary} />}
              onPress={handleShareNote}
              style={styles.actionItem}
            />

            <List.Item
              title="Copy to Clipboard"
              description="Copy note content"
              left={(props) => <List.Icon {...props} icon="content-copy" color={theme.colors.primary} />}
              onPress={handleCopyToClipboard}
              style={styles.actionItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title="Export to PDF"
              description="Save as PDF document"
              left={(props) => <List.Icon {...props} icon="file-pdf-box" color={theme.colors.secondary} />}
              onPress={handleExportToPDF}
              style={styles.actionItem}
            />

            <List.Item
              title="Export to Word"
              description="Save as RTF document (opens in Word)"
              left={(props) => <List.Icon {...props} icon="file-word-box" color={theme.colors.secondary} />}
              onPress={handleExportToDocx}
              style={styles.actionItem}
            />

            <Divider style={styles.divider} />

            <List.Item
              title="Delete Note"
              description="Permanently delete this note"
              left={(props) => <List.Icon {...props} icon="delete" color={theme.colors.error} />}
              onPress={handleDeleteNote}
              style={styles.actionItem}
              titleStyle={{ color: theme.colors.error }}
            />
          </View>
        )}
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    margin: 20,
    borderRadius: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    padding: 24,
    paddingBottom: 16,
  },
  modalTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modalSubtitle: {
    opacity: 0.7,
  },
  actionsContainer: {
    paddingHorizontal: 8,
  },
  actionItem: {
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  divider: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    textAlign: 'center',
  },
});

export default NoteActionsModal;
