import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, MapPin, CheckCircle, AlertCircle, User } from 'lucide-react-native';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cssInterop, useColorScheme } from 'nativewind';

cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MapPin, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(User, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type TaskStatus = 'scheduled' | 'in-progress' | 'completed' | 'overdue';

type Task = {
  id: string;
  title: string;
  vendor: string;
  vendorImage: string;
  project: string;
  date: string;
  time: string;
  location: string;
  status: TaskStatus;
  description: string;
  priority: 'high' | 'medium' | 'low';
};

const TASKS: Task[] = [
  {
    id: '1',
    title: 'Pool Cleaning & Maintenance',
    vendor: 'AquaClear Services',
    vendorImage: 'https://images.unsplash.com/photo-1572331165267-854da2b10ccc?w=900&auto=format&fit=crop&q=60',
    project: 'Riverside Residence',
    date: 'Today',
    time: '09:00 AM',
    location: 'Pool Area, Building A',
    status: 'scheduled',
    description: 'Weekly pool cleaning, chemical balance check, and filter maintenance',
    priority: 'high',
  },
  {
    id: '2',
    title: 'Electrical Panel Inspection',
    vendor: 'PowerTech Electrical',
    vendorImage: 'https://images.unsplash.com/photo-1600249324369-cf81f82f441b?w=900&auto=format&fit=crop&q=60',
    project: 'Downtown Plaza',
    date: 'Today',
    time: '02:00 PM',
    location: 'Basement, Main Building',
    status: 'in-progress',
    description: 'Quarterly safety inspection of main electrical distribution panel',
    priority: 'high',
  },
  {
    id: '3',
    title: 'Plumbing Repair - Kitchen',
    vendor: 'FlowMaster Plumbing',
    vendorImage: 'https://images.unsplash.com/photo-1517340073101-289191978ae8?w=900&auto=format&fit=crop&q=60',
    project: 'Green Valley Complex',
    date: 'Today',
    time: '04:30 PM',
    location: 'Unit 305, Kitchen',
    status: 'scheduled',
    description: 'Fix leaking faucet and inspect under-sink drainage',
    priority: 'medium',
  },
  {
    id: '4',
    title: 'HVAC System Maintenance',
    vendor: 'Climate Control Pro',
    vendorImage: 'https://images.unsplash.com/photo-1600675608140-991fcf38cc6e?w=900&auto=format&fit=crop&q=60',
    project: 'Riverside Residence',
    date: 'Tomorrow',
    time: '10:00 AM',
    location: 'Rooftop HVAC Units',
    status: 'scheduled',
    description: 'Bi-annual HVAC system cleaning and performance check',
    priority: 'medium',
  },
  {
    id: '5',
    title: 'Fire Safety Inspection',
    vendor: 'SafeGuard Inspections',
    vendorImage: 'https://images.unsplash.com/photo-1635099404457-91c3d0dade3b?w=900&auto=format&fit=crop&q=60',
    project: 'Downtown Plaza',
    date: 'Tomorrow',
    time: '11:30 AM',
    location: 'All Floors',
    status: 'scheduled',
    description: 'Annual fire extinguisher and alarm system inspection',
    priority: 'high',
  },
  {
    id: '6',
    title: 'Landscaping Service',
    vendor: 'GreenScape Gardens',
    vendorImage: 'https://images.unsplash.com/photo-1608447718455-ed5006c46051?w=900&auto=format&fit=crop&q=60',
    project: 'Green Valley Complex',
    date: 'Tomorrow',
    time: '03:00 PM',
    location: 'Front Garden & Courtyard',
    status: 'scheduled',
    description: 'Weekly lawn mowing, hedge trimming, and garden maintenance',
    priority: 'low',
  },
];

const STATUS_CONFIG = {
  scheduled: { label: 'Scheduled', color: 'bg-blue-500', textColor: 'text-blue-700', bgColor: 'bg-blue-50' },
  'in-progress': { label: 'In Progress', color: 'bg-amber-500', textColor: 'text-amber-700', bgColor: 'bg-amber-50' },
  completed: { label: 'Completed', color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-50' },
  overdue: { label: 'Overdue', color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-50' },
};

const PRIORITY_CONFIG = {
  high: { color: 'text-red-500', label: 'High Priority' },
  medium: { color: 'text-amber-500', label: 'Medium Priority' },
  low: { color: 'text-green-500', label: 'Low Priority' },
};

export default function TasksScreen() {
  const [filter, setFilter] = useState<'all' | 'today' | 'tomorrow'>('all');

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const filteredTasks = TASKS.filter((task) => {
    if (filter === 'today') return task.date === 'Today';
    if (filter === 'tomorrow') return task.date === 'Tomorrow';
    return true;
  });

  const todayCount = TASKS.filter((t) => t.date === 'Today').length;
  const tomorrowCount = TASKS.filter((t) => t.date === 'Tomorrow').length;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4">
        <View>
          <Text className="text-2xl font-bold text-foreground">Scheduled Tasks</Text>
          <Text className="text-sm text-muted-foreground mt-1">Next 2 days overview</Text>
        </View>
        <ThemeToggle />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Summary Cards */}
        <View className="px-6 mb-6">
          <View className="flex-row gap-4">
            <View className="flex-1 bg-card rounded-2xl p-4 border border-border">
              <View className="flex-row items-center justify-between mb-2">
                <Calendar className="text-primary" size={24} />
                <View className="bg-blue-100 px-3 py-1 rounded-full">
                  <Text className="text-blue-700 font-bold text-xs">TODAY</Text>
                </View>
              </View>
              <Text className="text-3xl font-bold text-foreground">{todayCount}</Text>
              <Text className="text-sm text-muted-foreground mt-1">Tasks Today</Text>
            </View>

            <View className="flex-1 bg-card rounded-2xl p-4 border border-border">
              <View className="flex-row items-center justify-between mb-2">
                <Clock className="text-amber-500" size={24} />
                <View className="bg-amber-100 px-3 py-1 rounded-full">
                  <Text className="text-amber-700 font-bold text-xs">TOMORROW</Text>
                </View>
              </View>
              <Text className="text-3xl font-bold text-foreground">{tomorrowCount}</Text>
              <Text className="text-sm text-muted-foreground mt-1">Tasks Tomorrow</Text>
            </View>
          </View>
        </View>

        {/* Filter Tabs */}
        <View className="px-6 mb-6">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            <TouchableOpacity onPress={() => setFilter('all')}>
              <View className={`px-6 py-3 rounded-full ${filter === 'all' ? 'bg-primary' : 'bg-card border border-border'}`}>
                <Text className={`font-semibold ${filter === 'all' ? 'text-primary-foreground' : 'text-foreground'}`}>
                  All ({TASKS.length})
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setFilter('today')}>
              <View className={`px-6 py-3 rounded-full ${filter === 'today' ? 'bg-primary' : 'bg-card border border-border'}`}>
                <Text className={`font-semibold ${filter === 'today' ? 'text-primary-foreground' : 'text-foreground'}`}>
                  Today ({todayCount})
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setFilter('tomorrow')}>
              <View className={`px-6 py-3 rounded-full ${filter === 'tomorrow' ? 'bg-primary' : 'bg-card border border-border'}`}>
                <Text className={`font-semibold ${filter === 'tomorrow' ? 'text-primary-foreground' : 'text-foreground'}`}>
                  Tomorrow ({tomorrowCount})
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Task Cards */}
        <View className="px-6 gap-4">
          {filteredTasks.map((task) => {
            const statusConfig = STATUS_CONFIG[task.status];
            const priorityConfig = PRIORITY_CONFIG[task.priority];

            return (
              <TouchableOpacity key={task.id}>
                <View className="bg-card rounded-2xl border border-border overflow-hidden">
                  {/* Task Image */}
                  <Image source={{ uri: task.vendorImage }} className="w-full h-40" resizeMode="cover" />

                  {/* Task Content */}
                  <View className="p-4">
                    {/* Header with Status */}
                    <View className="flex-row items-start justify-between mb-3">
                      <View className="flex-1 mr-3">
                        <Text className="text-lg font-bold text-foreground mb-1">{task.title}</Text>
                        <View className="flex-row items-center gap-2">
                          <User className="text-muted-foreground" size={14} />
                          <Text className="text-sm text-muted-foreground">{task.vendor}</Text>
                        </View>
                      </View>
                      <View className={`${statusConfig.bgColor} px-3 py-1.5 rounded-full`}>
                        <Text className={`${statusConfig.textColor} font-semibold text-xs`}>{statusConfig.label}</Text>
                      </View>
                    </View>

                    {/* Project Tag */}
                    <View className="bg-muted px-3 py-1.5 rounded-full self-start mb-3">
                      <Text className="text-xs font-medium text-muted-foreground">{task.project}</Text>
                    </View>

                    {/* Time & Location */}
                    <View className="gap-2 mb-3">
                      <View className="flex-row items-center gap-2">
                        <Calendar className="text-primary" size={16} />
                        <Text className="text-sm font-semibold text-foreground">{task.date}</Text>
                        <Text className="text-sm text-muted-foreground">at {task.time}</Text>
                      </View>
                      <View className="flex-row items-center gap-2">
                        <MapPin className="text-muted-foreground" size={16} />
                        <Text className="text-sm text-muted-foreground">{task.location}</Text>
                      </View>
                    </View>

                    {/* Description */}
                    <Text className="text-sm text-muted-foreground mb-3">{task.description}</Text>

                    {/* Priority Badge */}
                    <View className="flex-row items-center gap-2">
                      <AlertCircle className={priorityConfig.color} size={16} />
                      <Text className={`text-xs font-semibold ${priorityConfig.color}`}>{priorityConfig.label}</Text>
                    </View>
                  </View>

                  {/* Action Button */}
                  {task.status === 'scheduled' && (
                    <View className="px-4 pb-4">
                      <TouchableOpacity>
                        <View className="bg-primary py-3 rounded-xl items-center">
                          <Text className="text-primary-foreground font-semibold">View Details</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  {task.status === 'in-progress' && (
                    <View className="px-4 pb-4">
                      <TouchableOpacity>
                        <View className="bg-green-500 py-3 rounded-xl items-center flex-row justify-center gap-2">
                          <CheckCircle className="text-white" size={20} />
                          <Text className="text-white font-semibold">Mark as Completed</Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Empty State */}
        {filteredTasks.length === 0 && (
          <View className="items-center py-16 px-6">
            <Calendar className="text-muted-foreground mb-4" size={64} />
            <Text className="text-xl font-bold text-foreground text-center mb-2">No Tasks Found</Text>
            <Text className="text-muted-foreground text-center">
              There are no scheduled tasks for this period.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}