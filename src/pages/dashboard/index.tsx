import React from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { TrendingUp, Calendar, AlertCircle, DollarSign, Package, Clock, CheckSquare } from 'lucide-react-native';
import { cssInterop, useColorScheme } from 'nativewind';

cssInterop(TrendingUp, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Package, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckSquare, { className: { target: 'style', nativeStyleToProp: { color: true } } });

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
        {/* Total Expense Card */}
        <View className="px-6 mb-6">
          <View className="bg-card rounded-2xl p-6 border border-border">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-muted-foreground text-sm font-medium">Total Expenses</Text>
              <View className="bg-primary/10 p-2 rounded-lg">
                <DollarSign className="text-primary" size={20} />
              </View>
            </View>
            <Text className="text-4xl font-bold text-foreground mb-2">
              ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </Text>
            <View className="flex-row items-center">
              <TrendingUp className="text-chart-2" size={16} />
              <Text className="text-chart-2 text-sm ml-1 font-medium">+12.5% from last month</Text>
            </View>
          </View>
        </View>

        {/* Next Payment Alert */}
        <View className="px-6 mb-6">
          <View className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
            <View className="flex-row items-start">
              <View className="bg-destructive/20 p-2 rounded-lg mr-3">
                <AlertCircle className="text-destructive" size={20} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground font-semibold mb-1">Next Payment Due</Text>
                <Text className="text-muted-foreground text-sm mb-2">{nextPayment.vendor}</Text>
                <View className="flex-row items-center justify-between">
                  <Text className="text-destructive font-bold text-lg">
                    ${nextPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </Text>
                  <View className="flex-row items-center">
                    <Calendar className="text-muted-foreground" size={14} />
                    <Text className="text-muted-foreground text-xs ml-1">{nextPayment.dueDate}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Quick Stats */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-3">
            <View className="flex-1 bg-card border border-border rounded-xl p-4">
              <View className="bg-chart-1/10 p-2 rounded-lg self-start mb-2">
                <Package className="text-chart-1" size={20} />
              </View>
              <Text className="text-2xl font-bold text-foreground mb-1">3</Text>
              <Text className="text-muted-foreground text-xs">Active Projects</Text>
            </View>
            <View className="flex-1 bg-card border border-border rounded-xl p-4">
              <View className="bg-chart-4/10 p-2 rounded-lg self-start mb-2">
                <Clock className="text-chart-4" size={20} />
              </View>
              <Text className="text-2xl font-bold text-foreground mb-1">{pendingTasks.length}</Text>
              <Text className="text-muted-foreground text-xs">Pending Tasks</Text>
            </View>
          </View>
        </View>

        {/* Projects Section */}
        <View className="mb-6">
          <View className="px-6 mb-4 flex-row items-center justify-between">
            <Text className="text-xl font-bold text-foreground">Active Projects</Text>
            <Text className="text-primary text-sm font-medium">View All</Text>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
          >
            {projects.map((project) => (
              <Pressable key={project.id}>
                <View className="bg-card border border-border rounded-2xl overflow-hidden w-72">
                  <Image 
                    source={{ uri: project.image }}
                    className="w-full h-40"
                    resizeMode="cover"
                  />
                  <View className="p-4">
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-foreground font-bold text-base flex-1">{project.name}</Text>
                      <View className="bg-chart-2/10 px-2 py-1 rounded">
                        <Text className="text-chart-2 text-xs font-medium">{project.status}</Text>
                      </View>
                    </View>
                    <Text className="text-2xl font-bold text-foreground mb-3">
                      ${project.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </Text>
                    <View className="mb-2">
                      <View className="flex-row items-center justify-between mb-1">
                        <Text className="text-muted-foreground text-xs">Progress</Text>
                        <Text className="text-foreground text-xs font-medium">{project.completion}%</Text>
                      </View>
                      <View className="bg-muted h-2 rounded-full overflow-hidden">
                        <View 
                          className="bg-primary h-full rounded-full" 
                          style={{ width: `${project.completion}%` }}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {/* Upcoming Tasks */}
        <View className="px-6 mb-6">
          <Text className="text-xl font-bold text-foreground mb-4">Upcoming Tasks</Text>
          <View className="gap-3">
            {pendingTasks.map((task) => (
              <View key={task.id} className="bg-card border border-border rounded-xl p-4 flex-row items-center">
                <View className="bg-primary/10 p-2 rounded-lg mr-3">
                  <CheckSquare className="text-primary" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground font-semibold mb-1">{task.title}</Text>
                  <View className="flex-row items-center">
                    <Clock className="text-muted-foreground" size={12} />
                    <Text className="text-muted-foreground text-xs ml-1">{task.date}</Text>
                  </View>
                </View>
                <View className="bg-accent px-2 py-1 rounded">
                  <Text className="text-accent-foreground text-xs">{task.type}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}