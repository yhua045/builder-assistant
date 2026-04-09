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
        style={[styles.row, isSelected && styles.rowSelected]}
      >
        <View style={styles.rowContent}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.statusBadge, statusBadgeStyle(item.status)]}>
            <Text style={styles.statusText}>{item.status?.replace('_', ' ') ?? 'unknown'}</Text>
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Assign Project</Text>
          <View style={styles.headerActions}>
            {currentProjectId && onNavigate && (
              <TouchableOpacity
                testID="project-picker-go-to-project"
                onPress={handleGoToProject}
                style={styles.headerBtn}
              >
                <Text style={styles.goToText}>Go to Project</Text>
                <ChevronRight size={16} color="#2563eb" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              testID="project-picker-close"
            >
              <X size={20} color="#71717a" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
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
            style={styles.clearRow}
          >
            <X size={16} color="#dc2626" />
            <Text style={styles.clearText}>Clear assignment</Text>
          </TouchableOpacity>
        )}

        {/* Project list */}
        {fetching ? (
          <ActivityIndicator size="large" style={styles.loader} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No projects found</Text>
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
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#18181b',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  goToText: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  searchInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d4d4d8',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#18181b',
    backgroundColor: '#fafafa',
  },
  clearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  clearText: {
    fontSize: 14,
    color: '#dc2626',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e4e4e7',
  },
  rowSelected: {
    backgroundColor: '#eff6ff',
  },
  rowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#18181b',
    flexShrink: 1,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#374151',
    textTransform: 'capitalize',
  },
  loader: {
    marginTop: 48,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#71717a',
  },
});
