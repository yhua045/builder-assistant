import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProjectsPage from './ProjectsPage';
import ProjectDetailScreen from './ProjectDetail';
import TaskDetailsPage from '../tasks/TaskDetailsPage';
import CreateTaskPage from '../tasks/CreateTaskPage';
import EditTaskPage from '../tasks/EditTaskPage';

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string };
  /** Pushed from within the Projects stack so the user stays in context */
  TaskDetails: { taskId: string; openProgressLog?: boolean; openDocument?: boolean };
  CreateTask: { projectId?: string } | undefined;
  EditTask: { taskId: string };
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
      <Stack.Screen
        name="TaskDetails"
        component={TaskDetailsPage}
        options={{ presentation: 'card' }}
      />
      <Stack.Screen
        name="CreateTask"
        component={CreateTaskPage}
        options={{ presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditTask"
        component={EditTaskPage}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
