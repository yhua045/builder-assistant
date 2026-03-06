import React from 'react';
import { View, Text, ScrollView, Pressable, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  FileText, 
  Users, 
  Link2, 
  CheckCircle,
  Edit,
  AlertCircle,
  Image as ImageIcon,
  File,
  Camera,
  Plus
} from 'lucide-react-native';

// Mock data for the task detail
const task = {
  id: '1',
  title: 'Electrical Panel Inspection',
  vendor: 'PowerTech Electrical',
  vendorImage: 'https://images.unsplash.com/photo-1600249324369-cf81f82f441b?w=900&auto=format&fit=crop&q=60',
  status: 'in-progress',
  project: 'Downtown Plaza',
  
  // Requested fields
  dueDate: 'Dec 28, 2024',
  scheduledStartDate: 'Dec 20, 2024',
  notes: 'Ensure all breakers are labeled correctly. Check for any signs of overheating on the main bus bars. Verify grounding connections are secure. Document any irregularities with photos.',
  
  subcontractors: [
    { id: 's1', name: 'John Martinez', role: 'Lead Electrician', phone: '(415) 555-0101' },
    { id: 's2', name: 'Sarah Kim', role: 'Apprentice', phone: '(415) 555-0102' },
    { id: 's3', name: 'Mike Johnson', role: 'Safety Inspector', phone: '(415) 555-0103' }
  ],
  
  dependentTasks: [
    { id: 'd1', title: 'Drywall Installation - Section A', status: 'blocked' },
    { id: 'd2', title: 'Painting Prep - Common Areas', status: 'blocked' },
    { id: 'd3', title: 'Flooring Installation - Lobby', status: 'pending' }
  ],

  // Progress Logs - daily inspection records
  progressLogs: [
    {
      id: 'pl1',
      date: 'Dec 22, 2024',
      time: '2:30 PM',
      inspector: 'Mike Johnson',
      text: 'Main panel installed and wired. All breakers labeled according to specifications. Grounding connections verified and secure. No issues found.',
      image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&auto=format&fit=crop&q=60'
    },
    {
      id: 'pl2',
      date: 'Dec 21, 2024',
      time: '10:15 AM',
      inspector: 'John Martinez',
      text: 'Rough-in inspection completed. All conduits properly secured. Need to verify final connections before power-up.',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=60'
    }
  ],

  // Images and Documents attached to task
  attachments: [
    { id: 'a1', type: 'image', uri: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=60', name: 'Panel Front View.jpg' },
    { id: 'a2', type: 'image', uri: 'https://images.unsplash.com/photo-1504384308090-c54be3852f33?w=400&auto=format&fit=crop&q=60', name: 'Wiring Detail.jpg' },
    { id: 'a3', type: 'document', uri: '', name: 'Electrical_Specs.pdf' },
    { id: 'a4', type: 'image', uri: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=400&auto=format&fit=crop&q=60', name: 'Grounding System.jpg' },
    { id: 'a5', type: 'document', uri: '', name: 'Safety_Checklist.pdf' },
    { id: 'a6', type: 'image', uri: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&auto=format&fit=crop&q=60', name: 'Circuit Breakers.jpg' },
  ]
};

type Subcontractor = typeof task.subcontractors[0];
type DependentTask = typeof task.dependentTasks[0];
type ProgressLog = typeof task.progressLogs[0];
type Attachment = typeof task.attachments[0];

export default function TaskDetailScreen() {
  const router = useNavigation();

  const renderProgressLog = ({ item, index }: { item: ProgressLog; index: number }) => (
    <View className="flex-row gap-4">
      {/* Timeline Line */}
      <View className="items-center">
        <View className="w-4 h-4 rounded-full bg-primary border-4 border-background" />
        {index !== task.progressLogs.length - 1 && (
          <View className="w-0.5 flex-1 bg-border mt-2" />
        )}
      </View>

      {/* Log Content */}
      <View className="flex-1 pb-6">
        <View className="bg-card border border-border rounded-2xl p-4 mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-bold text-foreground">{item.date}</Text>
            <Text className="text-xs text-muted-foreground">{item.time}</Text>
          </View>
          <Text className="text-xs text-primary font-medium mb-3">by {item.inspector}</Text>
          <Text className="text-sm text-foreground leading-relaxed mb-3">
            {item.text}
          </Text>
          {item.image && (
            <Image 
              source={{ uri: item.image }} 
              className="w-full h-40 rounded-xl"
              resizeMode="cover"
            />
          )}
        </View>
      </View>
    </View>
  );

  const renderAttachment = ({ item }: { item: Attachment }) => (
    <View className="mr-3">
      <View className="w-24 h-24 bg-card border border-border rounded-xl overflow-hidden">
        {item.type === 'image' ? (
          <Image 
            source={{ uri: item.uri }} 
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center bg-muted/30">
            <File className="text-muted-foreground" size={32} />
          </View>
        )}
      </View>
      <Text className="text-xs text-muted-foreground mt-2 w-24" numberOfLines={2}>
        {item.name}
      </Text>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Pressable onPress={() => router.goBack()} className="p-2 -ml-2">
          <ArrowLeft className="text-foreground" size={24} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Task Details</Text>
        <Pressable className="p-2 -mr-2">
          <Edit className="text-primary" size={24} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        {/* Task Header */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-start gap-4 mb-4">
            <Image 
              source={{ uri: task.vendorImage }} 
              className="w-16 h-16 rounded-xl"
              resizeMode="cover"
            />
            <View className="flex-1">
              <Text className="text-xl font-bold text-foreground mb-1">
                {task.title}
              </Text>
              <Text className="text-sm text-muted-foreground mb-2">
                {task.vendor}
              </Text>
              <View className="flex-row items-center gap-2">
                <View className="bg-amber-100 px-3 py-1 rounded-full">
                  <Text className="text-amber-700 font-semibold text-xs">In Progress</Text>
                </View>
                <Text className="text-sm text-muted-foreground">
                  {task.project}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Dates Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Schedule
          </Text>
          <View className="flex-row gap-4">
            {/* Scheduled Start Date */}
            <View className="flex-1 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar className="text-primary" size={18} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Start Date
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">
                {task.scheduledStartDate}
              </Text>
            </View>

            {/* Due Date */}
            <View className="flex-1 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Clock className="text-red-500" size={18} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Due Date
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">
                {task.dueDate}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Notes
          </Text>
          <View className="bg-card border border-border rounded-2xl p-4">
            <View className="flex-row items-start gap-3">
              <FileText className="text-muted-foreground mt-1" size={20} />
              <Text className="text-foreground text-sm leading-relaxed flex-1">
                {task.notes}
              </Text>
            </View>
          </View>
        </View>

        {/* Subcontractors Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Subcontractors
            </Text>
            <Text className="text-xs text-primary font-semibold">
              {task.subcontractors.length} assigned
            </Text>
          </View>
          
          <View className="bg-card border border-border rounded-2xl overflow-hidden">
            {task.subcontractors.map((sub: Subcontractor, index: number) => (
              <View 
                key={sub.id}
                className={`p-4 flex-row items-center justify-between ${
                  index !== task.subcontractors.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center">
                    <Users className="text-primary" size={18} />
                  </View>
                  <View>
                    <Text className="text-foreground font-semibold text-sm">
                      {sub.name}
                    </Text>
                    <Text className="text-muted-foreground text-xs">
                      {sub.role}
                    </Text>
                  </View>
                </View>
                <Text className="text-muted-foreground text-xs">
                  {sub.phone}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Dependent Tasks Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dependent Tasks
            </Text>
            <Text className="text-xs text-amber-600 font-semibold">
              {task.dependentTasks.filter(t => t.status === 'blocked').length} blocked
            </Text>
          </View>

          <View className="gap-3">
            {task.dependentTasks.map((dep: DependentTask) => (
              <View key={dep.id} className="bg-card border border-border rounded-2xl p-4">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Link2 className="text-muted-foreground" size={14} />
                      <Text className="text-foreground font-semibold text-sm">
                        {dep.title}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2 mt-2">
                      {dep.status === 'blocked' ? (
                        <>
                          <AlertCircle className="text-red-500" size={14} />
                          <Text className="text-red-500 text-xs font-medium">
                            Blocked by this task
                          </Text>
                        </>
                      ) : (
                        <>
                          <Clock className="text-amber-500" size={14} />
                          <Text className="text-muted-foreground text-xs">
                            Waiting for completion
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  {dep.status === 'blocked' && (
                    <View className="bg-red-50 px-2 py-1 rounded-md">
                      <Text className="text-red-600 text-xs font-bold">BLOCKED</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Progress Logs Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Progress Logs
            </Text>
            <Pressable className="flex-row items-center gap-2 bg-primary/10 px-3 py-2 rounded-full">
              <Plus className="text-primary" size={16} />
              <Text className="text-xs text-primary font-semibold">Add Log</Text>
            </Pressable>
          </View>

          <View className="pl-2">
            {task.progressLogs.map((log: ProgressLog, index: number) => renderProgressLog({ item: log, index }))}
          </View>
        </View>

        {/* Images and Documents Section */}
        <View className="px-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Images & Documents
            </Text>
            <Pressable className="flex-row items-center gap-2 bg-primary/10 px-3 py-2 rounded-full">
              <Plus className="text-primary" size={16} />
              <Text className="text-xs text-primary font-semibold">Add</Text>
            </Pressable>
          </View>

          <FlatList
            data={task.attachments}
            renderItem={renderAttachment}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 2 }}
          />
        </View>
      </ScrollView>

      {/* Bottom Action Button */}
      <View className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t border-border">
        <Pressable className="bg-primary py-4 rounded-2xl items-center flex-row justify-center gap-2">
          <CheckCircle className="text-primary-foreground" size={20} />
          <Text className="text-primary-foreground font-bold text-base">
            Mark as Completed
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}