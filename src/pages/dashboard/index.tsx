import React from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { TrendingUp, Calendar, AlertCircle, DollarSign } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';
import QuickStats from '../../components/QuickStats';
import ProjectsList from '../../components/ProjectsList';
import TasksList from '../../components/TasksList';
import TotalExpenseCard from './components/TotalExpenseCard';
import NextPaymentAlert from './components/NextPaymentAlert';

cssInterop(TrendingUp, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// Mock data
const totalExpense = 127450.00;
const nextPayment = {
  vendor: 'ABC Construction Co.',
  amount: 8500.00,
  dueDate: 'Dec 28, 2024',
  project: 'Office Renovation'
};

const projects = [
  {
    id: '1',
    name: 'Office Renovation',
    totalExpense: 45600.00,
    status: 'In Progress',
    completion: 65,
    image: 'https://images.unsplash.com/photo-1541085929911-dea736e9287b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8M3x8TW9kZXJuJTIwU2NhbmRpbmF2aWFuJTIwZnVybml0dXJlfGVufDB8fDB8fHww'
  },
  {
    id: '2',
    name: 'Warehouse Expansion',
    totalExpense: 52300.00,
    status: 'In Progress',
    completion: 42,
    image: 'https://images.unsplash.com/photo-1600249324369-cf81f82f441b?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTJ8fE1vZGVybiUyMHVyYmFuJTIwYnVpbGRpbmd8ZW58MHx8MHx8fDA%3D'
  },
  {
    id: '3',
    name: 'Retail Store Setup',
    totalExpense: 29550.00,
    status: 'Planning',
    completion: 15,
    image: 'https://images.unsplash.com/photo-1652173254238-38fb2aa89ffd?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NHx8TW9kZXJuJTIwdXJiYW4lMjBhcmNoaXRlY3R1cmV8ZW58MHx8MHx8fDA%3D'
  }
];

const pendingTasks = [
  { id: '1', title: 'Pool Cleaner Visit', date: 'Tomorrow, 2:00 PM', type: 'Maintenance' },
  { id: '2', title: 'Electrician Inspection', date: 'Tomorrow, 4:30 PM', type: 'Inspection' },
  { id: '3', title: 'Plumber - Pipe Replacement', date: 'Dec 27, 10:00 AM', type: 'Repair' }
];

export default function DashboardScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
    >
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <View>
          <Text className="text-muted-foreground text-sm">Welcome back,</Text>
          <Text className="text-2xl font-bold text-foreground">Dashboard</Text>
        </View>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        <TotalExpenseCard totalExpense={totalExpense} />

        <NextPaymentAlert nextPayment={nextPayment} />

        <QuickStats
          items={[
            { id: 'projects', label: 'Active Projects', value: 3, Icon: TrendingUp, iconClass: 'text-chart-1' },
            { id: 'tasks', label: 'Pending Tasks', value: pendingTasks.length, Icon: Calendar, iconClass: 'text-chart-4' },
          ]}
        />

        <ProjectsList projects={projects} />

        <TasksList tasks={pendingTasks} />
      </ScrollView>
    </SafeAreaView>
  );
}