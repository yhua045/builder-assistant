import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  ArrowLeft, 
  MapPin, 
  Phone, 
  User, 
  Calendar, 
  AlertCircle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Layers
} from 'lucide-react-native';

// Types
type TaskStatus = 'blocked' | 'pending' | 'completed' | 'cancelled';

interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  status: TaskStatus;
  description?: string;
}

interface Project {
  id: string;
  owner: string;
  address: string;
  contact: string;
  status: 'active' | 'on_hold';
  startDate: string;
  estimatedEndDate: string;
  tasks: Task[];
}

// Mock Data
const project: Project = {
  id: '1',
  owner: 'John Smith',
  address: '1234 Oak Street, San Francisco, CA 94102',
  contact: '(415) 555-0123',
  status: 'active',
  startDate: 'Dec 15, 2024',
  estimatedEndDate: 'Jan 15, 2025',
  tasks: [
    {
      id: 't1',
      title: 'Foundation Inspection',
      date: '2024-12-20',
      time: '10:00 AM',
      status: 'completed',
      description: 'Passed city inspection requirements.'
    },
    {
      id: 't2',
      title: 'Concrete Pouring',
      date: '2024-12-20',
      time: '02:00 PM',
      status: 'completed',
      description: 'Slab foundation poured and cured.'
    },
    {
      id: 't3',
      title: 'Framing Installation',
      date: '2024-12-28',
      time: '09:00 AM',
      status: 'pending',
      description: 'Wood framing for first floor.'
    },
    {
      id: 't4',
      title: 'Electrical Rough-in',
      date: '2024-12-28',
      time: '11:00 AM',
      status: 'blocked',
      description: 'Waiting for framing approval.'
    },
    {
      id: 't5',
      title: 'Plumbing Rough-in',
      date: '2024-12-30',
      time: '09:00 AM',
      status: 'pending',
      description: 'Supply and drain lines.'
    },
    {
      id: 't6',
      title: 'HVAC Installation',
      date: '2025-01-02',
      time: '10:00 AM',
      status: 'cancelled',
      description: 'Scope changed by owner.'
    },
    {
      id: 't7',
      title: 'Drywall Hanging',
      date: '2025-01-05',
      time: '08:00 AM',
      status: 'pending',
      description: 'Sheetrock installation.'
    }
  ]
};

// Helper to group tasks by date
const groupTasksByDate = (tasks: Task[]) => {
  const grouped: Record<string, Task[]> = {};
  tasks.forEach(task => {
    if (!grouped[task.date]) {
      grouped[task.date] = [];
    }
    grouped[task.date].push(task);
  });
  return grouped;
};

// Helper to get status styles
const getStatusStyles = (status: TaskStatus) => {
  switch (status) {
    case 'blocked':
      return {
        container: 'bg-red-50 border-red-200',
        text: 'text-red-700',
        iconBg: 'bg-red-100',
        iconColor: 'text-red-600',
        label: 'Blocked'
      };
    case 'pending':
      return {
        container: 'bg-yellow-50 border-yellow-200',
        text: 'text-yellow-700',
        iconBg: 'bg-yellow-100',
        iconColor: 'text-yellow-600',
        label: 'Pending'
      };
    case 'completed':
      return {
        container: 'bg-green-50 border-green-200',
        text: 'text-green-700',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        label: 'Completed'
      };
    case 'cancelled':
      return {
        container: 'bg-green-50 border-green-200', // Green per request
        text: 'text-green-700',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        label: 'Cancelled'
      };
    default:
      return {
        container: 'bg-gray-50 border-gray-200',
        text: 'text-gray-700',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        label: 'Unknown'
      };
  }
};

// Helper to get status icon
const getStatusIcon = (status: TaskStatus, size: number = 16, color: string = '') => {
  const iconColor = color || 'currentColor';
  switch (status) {
    case 'blocked':
      return <AlertCircle size={size} color={iconColor} />;
    case 'pending':
      return <Clock size={size} color={iconColor} />;
    case 'completed':
      return <CheckCircle size={size} color={iconColor} />;
    case 'cancelled':
      return <XCircle size={size} color={iconColor} />;
    default:
      return <Clock size={size} color={iconColor} />;
  }
};

// Helper to format date (Dec 20, 2024)
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Helper to format day (Mon)
const formatDay = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'short' });
};

export default function ProjectDetailScreen() {
  const router = useRouter();
  const groupedTasks = groupTasksByDate(project.tasks);
  const sortedDates = Object.keys(groupedTasks).sort();

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-border">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft className="text-foreground" size={24} />
        </Pressable>
        <View className="flex-row items-center">
          <Layers className="text-primary mr-2" size={20} />
          <Text className="text-lg font-bold text-foreground">Project Details</Text>
        </View>
        <View className="w-8" /> {/* Spacer for center alignment */}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 128 }}>
        {/* Project High-Level Details */}
        <View className="p-6 bg-card border-b border-border">
          <View className="flex-row items-start justify-between mb-4">
            <View className="flex-1">
              <Text className="text-2xl font-bold text-foreground mb-1">{project.owner}</Text>
              <View className="flex-row items-center mt-2">
                <MapPin className="text-muted-foreground mr-1.5" size={16} />
                <Text className="text-muted-foreground text-sm flex-1" numberOfLines={2}>
                  {project.address}
                </Text>
              </View>
            </View>
            <View 
              className={`px-3 py-1.5 rounded-full ml-4 ${
                project.status === 'active' 
                  ? 'bg-chart-2/10' 
                  : 'bg-chart-4/10'
              }`}
            >
              <Text 
                className={`text-xs font-semibold uppercase tracking-wide ${
                  project.status === 'active' 
                    ? 'text-chart-2' 
                    : 'text-chart-4'
                }`}
              >
                {project.status.replace('_', ' ')}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View className="flex-row gap-4 mt-4">
            <View className="flex-1 bg-muted/50 rounded-xl p-3">
              <View className="flex-row items-center mb-1">
                <Calendar className="text-muted-foreground mr-1.5" size={14} />
                <Text className="text-xs text-muted-foreground uppercase">Start Date</Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">{project.startDate}</Text>
            </View>
            <View className="flex-1 bg-muted/50 rounded-xl p-3">
              <View className="flex-row items-center mb-1">
                <Clock className="text-muted-foreground mr-1.5" size={14} />
                <Text className="text-xs text-muted-foreground uppercase">Est. End</Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">{project.estimatedEndDate}</Text>
            </View>
          </View>
          
          {/* Contact */}
          <View className="flex-row items-center mt-4 pt-4 border-t border-border/50">
             <Phone className="text-muted-foreground mr-2" size={16} />
             <Text className="text-foreground font-medium">{project.contact}</Text>
          </View>
        </View>

        {/* Task Timeline Section */}
        <View className="p-6">
          <Text className="text-xl font-bold text-foreground mb-6">Task Timeline</Text>
          
          <View className="flex-row">
            {/* Left Column: Dates */}
            <View className="w-16 pr-4 items-end">
              {sortedDates.map((date) => (
                <View key={date} className="mb-6">
                  <Text className="text-sm font-bold text-foreground">{new Date(date).getDate()}</Text>
                  <Text className="text-xs text-muted-foreground uppercase">{formatDay(date)}</Text>
                </View>
              ))}
            </View>

            {/* Right Column: Tasks & Timeline Line */}
            <View className="flex-1 relative">
              {/* Vertical Line */}
              <View className="absolute left-0 top-2 bottom-0 w-0.5 bg-border" />

              {sortedDates.map((date, dateIndex) => (
                <View key={date} className="mb-6 relative">
                  {/* Timeline Dot */}
                  <View className="absolute -left-[5px] top-3 w-2.5 h-2.5 rounded-full bg-primary border-2 border-background" />

                  {/* Tasks for this date */}
                  <View className="pl-4 gap-3">
                    {groupedTasks[date].map((task) => {
                      const styles = getStatusStyles(task.status);
                      return (
                        <View 
                          key={task.id} 
                          className={`p-4 rounded-xl border ${styles.container}`}
                        >
                          <View className="flex-row items-start justify-between mb-2">
                            <View className="flex-1 mr-2">
                              <Text className={`font-semibold text-base ${styles.text}`}>
                                {task.title}
                              </Text>
                              {task.description && (
                                <Text className="text-sm text-muted-foreground mt-1">
                                  {task.description}
                                </Text>
                              )}
                            </View>
                            <View className={`px-2 py-1 rounded-md ${styles.iconBg}`}>
                              {getStatusIcon(task.status, 16, undefined)}
                            </View>
                          </View>
                          
                          <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-black/5">
                            <View className="flex-row items-center">
                              <Clock className="text-muted-foreground mr-1.5" size={14} />
                              <Text className="text-xs text-muted-foreground">{task.time}</Text>
                            </View>
                            <Text className={`text-xs font-bold uppercase tracking-wide ${styles.text}`}>
                              {styles.label}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}