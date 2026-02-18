import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Task } from '../../domain/entities/Task';
import DatePickerInput from '../inputs/DatePickerInput';
import { X, Save } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Save, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  initialValues?: Partial<Task>;
  onSubmit: (data: Partial<Task>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TaskForm({ initialValues, onSubmit, onCancel, isLoading }: Props) {
  const [title, setTitle] = useState(initialValues?.title || '');
  const [notes, setNotes] = useState(initialValues?.notes || '');
  const [projectId, setProjectId] = useState(initialValues?.projectId || '');
  const [dueDate, setDueDate] = useState<Date | null>(initialValues?.dueDate ? new Date(initialValues.dueDate) : null);
  const [status, setStatus] = useState<Task['status']>(initialValues?.status || 'pending');
  const [priority, setPriority] = useState<Task['priority']>(initialValues?.priority || 'medium');
  
  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    const data: Partial<Task> = {
      title,
      notes,
      projectId: projectId || undefined,
      dueDate: dueDate?.toISOString(),
      status,
      priority,
      isScheduled: !!dueDate,
    };
    
    await onSubmit(data);
  };

  const priorities: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];
  const statuses: Task['status'][] = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];

  return (
    <ScrollView className="flex-1 bg-background p-4">
      <View className="mb-6 gap-4">
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Title *</Text>
          <TextInput
            className="h-12 rounded-lg border border-input bg-background px-3 text-foreground"
            placeholder="Task title"
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />
        </View>

        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Project ID (Optional)</Text>
          <TextInput
            className="h-12 rounded-lg border border-input bg-background px-3 text-foreground"
            placeholder="Associated Project ID"
            placeholderTextColor="#9ca3af"
            value={projectId}
            onChangeText={setProjectId}
          />
        </View>

        <View className="gap-2">
           <Text className="text-sm font-medium text-foreground">Due Date</Text>
           <DatePickerInput
             label="Due Date"
             value={dueDate}
             onChange={setDueDate}
           />
        </View>

        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Status</Text>
          <View className="flex-row gap-2 flex-wrap">
            {statuses.map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setStatus(s)}
                className={`px-3 py-2 rounded-full border ${
                  status === s 
                    ? 'bg-primary border-primary' 
                    : 'bg-card border-border'
                }`}
              >
                <Text 
                  className={`text-xs capitalize ${
                    status === s ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {s.replace('_', ' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Priority</Text>
          <View className="flex-row gap-2 flex-wrap">
            {priorities.map((p) => (
              <TouchableOpacity
                key={p}
                onPress={() => setPriority(p)}
                className={`px-3 py-2 rounded-full border ${
                  priority === p 
                    ? 'bg-primary border-primary' 
                    : 'bg-card border-border'
                }`}
              >
                <Text 
                  className={`text-xs capitalize ${
                    priority === p ? 'text-primary-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-sm font-medium text-foreground">Notes</Text>
          <TextInput
            className="h-32 rounded-lg border border-input bg-background px-3 py-3 text-foreground"
            placeholder="Add details..."
            placeholderTextColor="#9ca3af"
            multiline
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />
        </View>
      </View>

      <View className="flex-row gap-4 mb-10">
        <TouchableOpacity 
          onPress={onCancel}
          disabled={isLoading}
          className="flex-1 h-12 items-center justify-center rounded-lg border border-border bg-card"
        >
          <Text className="font-semibold text-foreground">Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={handleSubmit}
          disabled={isLoading}
          className="flex-1 h-12 items-center justify-center rounded-lg bg-primary"
        >
          <Text className="font-semibold text-primary-foreground">
            {isLoading ? 'Saving...' : 'Save Task'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
