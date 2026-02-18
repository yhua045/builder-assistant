import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TasksListPage from './TasksListPage';
import TaskDetailsPage from './TaskDetailsPage';
import CreateTaskPage from './CreateTaskPage';
import EditTaskPage from './EditTaskPage';

const Stack = createNativeStackNavigator();

export default function TasksNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TasksList" component={TasksListPage} />
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
