import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import KnowledgeEmbeddingLaunchScreen from '../screens/KnowledgeEmbeddingLaunchScreen';

export type KnowledgeEmbeddingStackParamList = {
  KnowledgeEmbeddingLaunch: undefined;
};

const Stack = createNativeStackNavigator();

const KnowledgeEmbeddingNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="KnowledgeEmbeddingLaunch" component={KnowledgeEmbeddingLaunchScreen} />
    </Stack.Navigator>
  );
};

export default KnowledgeEmbeddingNavigator;
