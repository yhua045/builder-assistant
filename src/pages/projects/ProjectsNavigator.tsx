import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProjectsPage from './ProjectsPage';
import ProjectDetailScreen from './ProjectDetail';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string };
  /** Pushed from within the Projects stack so the user stays in context */
  TaskDetails: { taskId: string; openProgressLog?: boolean; openDocument?: boolean };
};

const Stack = createNativeStackNavigator();

export default function ProjectsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProjectsList" component={ProjectsPage} />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ presentation: 'card' }}
      />
    </Stack.Navigator>
  );
}
