import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, CreditCard, CheckSquare, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { cssInterop } from 'nativewind';
import DashboardScreen from '../dashboard';
import PaymentsScreen from '../payments';
import TasksScreen from '../tasks';
import ProfileScreen from '../profile';

// Enable className styling for icons
cssInterop(Home, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CreditCard, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckSquare, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const Tab = createBottomTabNavigator();

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: isDark ? '#171717' : '#ffffff',
          borderTopColor: isDark ? '#262626' : '#e4e4e7',
        },
        tabBarActiveTintColor: isDark ? '#3b82f6' : '#2563eb',
        tabBarInactiveTintColor: isDark ? '#a1a1aa' : '#71717a',
      }}
      >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused, color }) => (
            <Home color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Payments"
        component={PaymentsScreen}
        options={{
          title: 'Payments',
          tabBarIcon: ({ focused, color }) => (
            <CreditCard color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused, color }) => (
            <CheckSquare color={color} size={24} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color }) => (
            <User color={color} size={24} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
