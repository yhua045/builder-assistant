import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, CreditCard, CheckSquare, User } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { cssInterop } from 'nativewind';
import DashboardScreen from '../dashboard';
import PaymentsScreen from '../payments';
import TasksNavigator from '../tasks/TasksNavigator';
import ProjectsPage from '../projects/ProjectsPage';

// Enable className styling for icons
cssInterop(Home, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CreditCard, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckSquare, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const Tab = createBottomTabNavigator();
const DashboardIcon = ({ color }: { color: string }) => <Home color={color} size={24} />;
const FinancesIcon = ({ color }: { color: string }) => <CreditCard color={color} size={24} />;
const WorkIcon = ({ color }: { color: string }) => <CheckSquare color={color} size={24} />;
const ProjectsIcon = ({ color }: { color: string }) => <User color={color} size={24} />;

export default function TabsLayout() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const tabBarStyle = isDark
    ? { backgroundColor: '#171717', borderTopColor: '#262626' }
    : { backgroundColor: '#ffffff', borderTopColor: '#e4e4e7' };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: isDark ? '#3b82f6' : '#2563eb',
        tabBarInactiveTintColor: isDark ? '#a1a1aa' : '#71717a',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
          tabBarIcon: DashboardIcon,
        }}
      />
      <Tab.Screen
        name="Finances"
        component={PaymentsScreen}
        options={{
          title: 'Finances',
          tabBarIcon: FinancesIcon,
        }}
      />
      <Tab.Screen
        name="Work"
        component={TasksNavigator}
        options={{
          title: 'Work',
          tabBarIcon: WorkIcon,
        }}
      />
      <Tab.Screen
        name="Projects"
        component={ProjectsPage}
        options={{
          title: 'Projects',
          tabBarIcon: ProjectsIcon,
        }}
      />
    </Tab.Navigator>
  );
}
