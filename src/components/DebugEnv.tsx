import React from 'react';
import { View, Text } from 'react-native';
import Config from 'react-native-config';

const DebugEnv: React.FC = () => {
  return (
    <View style={{ padding: 20, backgroundColor: '#f0f0f0', margin: 10 }}>
      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Environment Debug:</Text>
      <Text>OpenAI Key: {Config.OPENAI_API_KEY ? 'Set' : 'Not Set'}</Text>
      <Text>Firebase Project ID: {Config.FIREBASE_PROJECT_ID || 'Not Set'}</Text>
      <Text>Config Object Keys: {Object.keys(Config).join(', ')}</Text>
    </View>
  );
};

export default DebugEnv;
