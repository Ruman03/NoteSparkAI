import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Config from 'react-native-config';

export const EnvDebug: React.FC = () => {
  useEffect(() => {
    console.log('=== ENV DEBUG FULL ===');
    console.log('Config object:', Config);
    console.log('All keys:', Object.keys(Config));
    console.log('All values:', Object.values(Config));
    
    // Check each expected key individually
    console.log('FIREBASE_API_KEY:', Config.FIREBASE_API_KEY);
    console.log('FIREBASE_AUTH_DOMAIN:', Config.FIREBASE_AUTH_DOMAIN);
    console.log('FIREBASE_PROJECT_ID:', Config.FIREBASE_PROJECT_ID);
    console.log('OPENAI_API_KEY:', Config.OPENAI_API_KEY);
    console.log('GOOGLE_CLOUD_VISION_API_KEY:', Config.GOOGLE_CLOUD_VISION_API_KEY);
    console.log('===================');
  }, []);

  return (
    <View style={{ padding: 10, backgroundColor: '#f0f0f0', margin: 10 }}>
      <Text style={{ fontWeight: 'bold' }}>Environment Debug:</Text>
      <Text>Keys loaded: {Object.keys(Config).length}</Text>
      <Text>Config working: {Object.keys(Config).length > 0 ? 'YES' : 'NO'}</Text>
    </View>
  );
};
