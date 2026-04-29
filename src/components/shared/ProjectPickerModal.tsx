/**
 * ProjectPickerModal — lets the user assign or clear a project.
 *
 * Moved from `src/components/payments/` to `src/components/shared/` in #192
 * so it can be reused in QuotationForm and any other feature.
 *
 * Layout reference: SubcontractorPickerModal.tsx
 * Added in #191 — onNavigate made optional in #192.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { X, ChevronRight, Check } from 'lucide-react-native';
import { container } from 'tsyringe';
import { Project } from '../../domain/entities/Project';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import '../../infrastructure/di/registerServices';

export interface ProjectPickerModalProps {
  visible: boolean;
  currentProjectId?: string;
  /** Called when the user picks a project (or undefined to clear). */
  onSelect(project: Project | undefined): void;
  /**
   * Called when the user taps "Go to Project →".
   * Optional — omit when the caller doesn't support navigation
   * (e.g. QuotationForm inside a modal).
   */
  onNavigate?: () => void;
  onClose(): void;
}

export function ProjectPickerModal({
  visible,
  currentProjectId,
  onSelect,
  onNavigate,
  onClose,
}: ProjectPickerModalProps) {
  const [query, setQuery] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [fetching, setFetching] = useState(false);

  const projectRepo = React.useMemo(
    () => container.resolve<ProjectRepository>('ProjectRepository' as any),
    [],
  );

  const loadProjects = useCallback(async () => {
    setFetching(true);
    try {
      const { items } = await projectRepo.list();
      setProjects(items);
    } finally {
      setFetching(false);
    }
  }, [projectRepo]);

  useEffect(() => {
    if (visible) {
      loadProjects();
      setQuery('');
    }
  }, [visible, loadProjects]);

  const filtered = query.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      )
    : projects;

  const handleSelect = (project: Project) => {
    onSelect(project);
    onClose();
  };

  const handleClear = () => {
    onSelect(undefined);
    onClose();
  };

  const handleGoToProject = () => {
    onClose();
    onNavigate?.();
  };

  const renderItem = ({ item }: { item: Project }) => {
    const isSelected = item.id === currentProjectId;
    return (
      <TouchableOpacity
        testID={`project-item-${item.id}`}
        onPress={() => handleSelect(item)}
        className={`flex-row items-center px-4 py-3 border-b border-border ${
          isSelected ? 'bg-blue-50' : ''
        }`}
      >
        <View className="flex-1 flex-row items-center gap-2">
          <Text className="text-[15px] font-medium text-zinc-900 shrink" numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.statusBadge, statusBadgeStyle(item.status)]}>
            <Text className="text-[11px] text-gray-700 capitalize">
              {item.status?.replace('_', ' ') ?? 'unknown'}
            </Text>
          </View>
        </View>
        {isSelected && <Check size={16} color="#2563eb" />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="project-picker-modal"
    >
      <View className="flex-1 bg-white">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-zinc-200">
          <Text className="text-[17px] font-semibold text-zinc-900">Assign Project</Text>
          <View className="flex-row items-center gap-3">
            {currentProjectId && onNavigate && (
              <TouchableOpacity
                testID="project-picker-go-to-project"
                onPress={handleGoToProject}
                className="flex-row items-center gap-[2px]"
              >
                <Text className="text-sm font-medium text-blue-600">Go to Project</Text>
                <ChevronRight size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              className="p-1"
              testID="project-picker-close"
            >
              <X size={20} color="#71717a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View className="px-4 py-3 border-b border-zinc-200">
          <TextInput
            className="h-10 rounded-lg border border-zinc-400 px-3 text-sm text-zinc-900 bg-zinc-50"
            placeholder="Search projects..."
            placeholderTextColor="#9ca3af"
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
        </View>

        {/* Clear assignment row */}
        {currentProjectId && (
          <TouchableOpacity
            testID="project-picker-clear"
            onPress={handleClear}
            className="flex-row items-center gap-2 px-4 py-3 border-b border-zinc-200"
          >
            <X size={16} color="#dc2626" />
            <Text className="text-sm text-red-600">Clear assignment</Text>
          </TouchableOpacity>
        )}

        {/* Project list */}
        {fetching ? (
          <ActivityIndicator size="large" className="mt-12" />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              <View className="px-4 py-8 items-center">
                <Text className="text-sm text-zinc-500">No projects found</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

function statusBadgeStyle(status?: string): object {
  switch (status) {
    case 'in_progress': return { backgroundColor: '#dbeafe' };
    case 'completed':   return { backgroundColor: '#dcfce7' };
    case 'on_hold':     return { backgroundColor: '#fef9c3' };
    case 'cancelled':   return { backgroundColor: '#fee2e2' };
    default:            return { backgroundColor: '#f3f4f6' };
  }
}

const styles = StyleSheet.create({
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
