// src/components/ErrorBoundary.tsx
// OPTIMIZED: Global Error Boundary for App-wide Error Handling

import React, { Component, ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { 
  Text, 
  Button, 
  Surface, 
  useTheme,
  Provider as PaperProvider 
} from 'react-native-paper';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: React.ErrorInfo, retry: () => void) => ReactNode;
}

// Error display component (functional component that uses theme)
const ErrorDisplay: React.FC<{
  error: Error;
  errorInfo: React.ErrorInfo;
  onRetry: () => void;
}> = ({ error, errorInfo, onRetry }) => {
  const theme = useTheme();
  
  return (
    <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
      <Surface style={[styles.errorSurface, { backgroundColor: theme.colors.surface }]} elevation={2}>
        <Text variant="headlineMedium" style={[styles.errorTitle, { color: theme.colors.error }]}>
          Oops! Something went wrong
        </Text>
        
        <Text variant="bodyMedium" style={[styles.errorMessage, { color: theme.colors.onSurface }]}>
          We've encountered an unexpected error. Don't worry, your data is safe.
        </Text>
        
        {__DEV__ && (
          <View style={styles.debugInfo}>
            <Text variant="titleSmall" style={[styles.debugTitle, { color: theme.colors.primary }]}>
              Debug Information:
            </Text>
            <Text variant="bodySmall" style={[styles.debugText, { color: theme.colors.onSurfaceVariant }]}>
              {error.message}
            </Text>
            <Text variant="bodySmall" style={[styles.debugText, { color: theme.colors.onSurfaceVariant }]}>
              {error.stack}
            </Text>
          </View>
        )}
        
        <View style={styles.buttonContainer}>
          <Button 
            mode="contained" 
            onPress={onRetry}
            style={styles.retryButton}
          >
            Try Again
          </Button>
          
          <Button 
            mode="outlined" 
            onPress={() => {
              // You could navigate to home or show additional options
              console.log('Additional help requested');
            }}
            style={styles.helpButton}
          >
            Get Help
          </Button>
        </View>
      </Surface>
    </View>
  );
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error details
    console.error('ErrorBoundary caught an error:', error);
    console.error('Error info:', errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Log to crash reporting service (if available)
    if (!__DEV__) {
      try {
        // You can add crashlytics or other crash reporting here
        console.log('Error logged for crash reporting:', error.message);
      } catch (loggingError) {
        console.error('Failed to log error to crash reporting:', loggingError);
      }
    }

    // Log analytics event for error tracking
    this.logErrorAnalytics(error, errorInfo);
  }

  private logErrorAnalytics(error: Error, errorInfo: React.ErrorInfo) {
    // You can integrate with your analytics service here
    const errorData = {
      error_message: error.message,
      error_stack: error.stack,
      component_stack: errorInfo.componentStack,
      error_boundary: 'GlobalErrorBoundary',
      timestamp: new Date().toISOString(),
    };

    console.log('Error Analytics:', errorData);
    
    // Example: Send to analytics service
    // analytics().logEvent('app_error', errorData);
  }

  private handleRetry = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback && this.state.error && this.state.errorInfo) {
        return this.props.fallback(this.state.error, this.state.errorInfo, this.handleRetry);
      }

      // Default fallback UI wrapped in PaperProvider for theme access
      return (
        <PaperProvider>
          <ErrorDisplay
            error={this.state.error!}
            errorInfo={this.state.errorInfo!}
            onRetry={this.handleRetry}
          />
        </PaperProvider>
      );
    }

    // Normal render
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorSurface: {
    padding: 24,
    borderRadius: 16,
    maxWidth: 400,
    width: '100%',
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: 'bold',
  },
  errorMessage: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  debugInfo: {
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: 8,
  },
  debugTitle: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  debugText: {
    marginBottom: 4,
    fontFamily: 'monospace',
    fontSize: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  retryButton: {
    flex: 1,
  },
  helpButton: {
    flex: 1,
  },
});

export default ErrorBoundary;
