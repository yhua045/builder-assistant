import React, { useState, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTasks } from '../../hooks/useTasks';
import { Task } from '../../domain/entities/Task';
import { TaskStatusBadge } from '../../components/tasks/TaskStatusBadge';
import { X } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  visible: boolean;
  projectId: string;
  /** The ID of the task currently being viewed — excluded from the list */
  excludeTaskId: string;
  /** IDs of tasks already added as dependencies — excluded from the list */
  existingDependencyIds: string[];
  onSelect: (taskId: string) => void;
  onClose: () => void;
}

export function TaskPickerModal({
  visible,
  projectId,
  excludeTaskId,
  existingDependencyIds,
  onSelect,
  onClose,
}: Props) {
  const { tasks, loading } = useTasks(projectId);
  const [query, setQuery] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t: Task) => {
      if (t.id === excludeTaskId) return false;
      if (existingDependencyIds.includes(t.id)) return false;
      if (query.trim()) {
        return t.title.toLowerCase().includes(query.trim().toLowerCase());
      }
      return true;
    });
  }, [tasks, excludeTaskId, existingDependencyIds, query]);

  const handleSelect = (taskId: string) => {
    onSelect(taskId);
    setQuery('');
    onClose();
  };

  const renderItem = ({ item }: { item: Task }) => (
    <TouchableOpacity
      onPress={() => handleSelect(item.id)}
      className="flex-row items-center justify-between px-4 py-3 border-b border-border"
    >
      <Text className="text-foreground flex-1 mr-3" numberOfLines={2}>
        {item.title}
      </Text>
      <TaskStatusBadge status={item.status} />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
          <Text className="text-lg font-semibold text-foreground">Select Task</Text>
          <TouchableOpacity
            onPress={onClose}
            testID="task-picker-close"
            className="p-2"
          >
            <X size={22} className="text-foreground" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View className="px-4 py-3">
          <TextInput
            placeholder="Search tasks…"
            value={query}
            onChangeText={setQuery}
            className="bg-muted px-4 py-2 rounded-lg text-foreground"
            placeholderTextColor="#9ca3af"
            autoCorrect={false}
          />
        </View>

        {/* List */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator />
          </View>
        ) : filteredTasks.length === 0 ? (
          <View className="flex-1 items-center justify-center px-4">
            <Text className="text-muted-foreground text-center">
              {query ? 'No tasks match your search.' : 'No tasks available to add.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredTasks}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
          />
        )}
      </View>
    </Modal>
  );
}
