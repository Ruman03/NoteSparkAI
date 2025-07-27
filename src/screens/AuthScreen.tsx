import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import {
  TextInput,
  Button,
  useTheme,
  Card,
  Divider,
  ActivityIndicator,
} from 'react-native-paper';
import EmojiIcon from '../components/EmojiIcon';
import { useAuth } from '../contexts/AuthContext';

const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const theme = useTheme();
  const { signIn, signUp } = useAuth();

  const handleAuth = async () => {
    if (!email || !password) return;
    
    if (!isLogin && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const Logo = () => (
    <View style={[styles.logoContainer, { backgroundColor: theme.colors.primaryContainer }]}>
      <EmojiIcon 
        name="brain" 
        size={48} 
      />
      <Text style={[styles.logoText, { color: theme.colors.primary }]}>
        NoteSpark AI
      </Text>
      <Text style={[styles.tagline, { color: theme.colors.onSurfaceVariant }]}>
        Smart Notes, Smarter Insights
      </Text>
    </View>
  );

  const SocialButton = ({ icon, title, onPress }: { icon: 'google' | 'apple'; title: string; onPress: () => void }) => {
    return (
      <Button
        mode="outlined"
        onPress={onPress}
        style={[styles.socialButton, { borderColor: theme.colors.outline }]}
        contentStyle={styles.socialButtonContent}
        labelStyle={[styles.socialButtonText, { color: theme.colors.onSurface }]}
        icon={() => <EmojiIcon name={icon} size={16} />}
      >
        {title}
      </Button>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Logo />

          <Card style={[styles.authCard, { backgroundColor: theme.colors.surface }]}>
            <Card.Content style={styles.cardContent}>
              <Text style={[styles.welcomeText, { color: theme.colors.onSurface }]}>
                {isLogin ? 'Welcome back!' : 'Create Account'}
              </Text>
              <Text style={[styles.subtitleText, { color: theme.colors.onSurfaceVariant }]}>
                {isLogin ? 'Sign in to continue' : 'Join NoteSpark AI today'}
              </Text>

              <View style={styles.inputContainer}>
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  mode="outlined"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                  left={<TextInput.Icon icon="email" />}
                  outlineStyle={styles.inputOutline}
                />

                <TextInput
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  mode="outlined"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  left={<TextInput.Icon icon="lock" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off' : 'eye'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  outlineStyle={styles.inputOutline}
                />

                {!isLogin && (
                  <TextInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    mode="outlined"
                    secureTextEntry={!showConfirmPassword}
                    style={styles.input}
                    left={<TextInput.Icon icon="shield-check" />}
                    right={
                      <TextInput.Icon
                        icon={showConfirmPassword ? 'eye-off' : 'eye'}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    }
                    outlineStyle={styles.inputOutline}
                  />
                )}
              </View>

              {isLogin && (
                <Button
                  mode="text"
                  onPress={() => {}}
                  style={styles.forgotPassword}
                  labelStyle={[styles.forgotPasswordText, { color: theme.colors.primary }]}
                >
                  Forgot Password?
                </Button>
              )}

              <Button
                mode="contained"
                onPress={handleAuth}
                loading={loading}
                disabled={loading}
                style={[styles.authButton, { backgroundColor: theme.colors.primary }]}
                contentStyle={styles.authButtonContent}
                labelStyle={styles.authButtonText}
              >
                {loading ? (
                  <ActivityIndicator color={theme.colors.onPrimary} />
                ) : (
                  isLogin ? 'Sign In' : 'Create Account'
                )}
              </Button>

              <View style={styles.dividerContainer}>
                <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
                <Text style={[styles.dividerText, { color: theme.colors.onSurfaceVariant }]}>
                  or continue with
                </Text>
                <Divider style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
              </View>

              <View style={styles.socialContainer}>
                <SocialButton
                  icon="google"
                  title="Google"
                  onPress={() => {}}
                />
                <SocialButton
                  icon="apple"
                  title="Apple"
                  onPress={() => {}}
                />
              </View>

              <View style={styles.switchContainer}>
                <Text style={[styles.switchText, { color: theme.colors.onSurfaceVariant }]}>
                  {isLogin ? "Don't have an account? " : 'Already have an account? '}
                </Text>
                <Button
                  mode="text"
                  onPress={() => setIsLogin(!isLogin)}
                  labelStyle={[styles.switchButtonText, { color: theme.colors.primary }]}
                  compact
                >
                  {isLogin ? 'Sign Up' : 'Sign In'}
                </Button>
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  authCard: {
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  cardContent: {
    padding: 24,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 16,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'transparent',
  },
  inputOutline: {
    borderRadius: 16,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '600',
  },
  authButton: {
    borderRadius: 100,
    marginBottom: 24,
  },
  authButtonContent: {
    paddingVertical: 8,
  },
  authButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
  },
  socialContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 12,
  },
  socialButton: {
    flex: 1,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  socialButtonContent: {
    paddingVertical: 4,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
  },
  switchButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AuthScreen;
