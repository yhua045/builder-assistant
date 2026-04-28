import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import type { UseCriticalPathReturn } from '../../../../hooks/useCriticalPath';
import { CriticalPathTaskRow } from './CriticalPathTaskRow';

interface CriticalPathPreviewProps {
  projectId: string;
  hookResult: UseCriticalPathReturn;
  onDone?: () => void;
}

export function CriticalPathPreview({ projectId, hookResult, onDone }: CriticalPathPreviewProps) {
  const {
    suggestions,
    isLoading,
    error,
    suggest,
    selectedIds,
    toggleSelection,
    selectAll,
    clearAll,
    isCreating,
    creationProgress,
    creationError,
    confirmSelected,
  } = hookResult;

  const selectedCount = selectedIds.size;
  const allSelected = suggestions.length > 0 && selectedCount === suggestions.length;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View testID="loading-skeleton" style={styles.centeredContainer}>
        <ActivityIndicator testID="loading-indicator" size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading suggestions…</Text>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.centeredContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          testID="error-retry-btn"
          style={styles.retryButton}
          onPress={() => suggest({ project_type: 'complete_rebuild' })}
        >
          <Text style={styles.retryButtonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Creation error banner */}
      {creationError ? (
        <View testID="creation-error-banner" style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{creationError}</Text>
          <TouchableOpacity
            testID="creation-error-retry-btn"
            onPress={() => confirmSelected(projectId)}
          >
            <Text style={styles.retryInlinText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Select all / deselect all control */}
      {suggestions.length > 0 && !isCreating ? (
        <View style={styles.selectAllRow}>
          <TouchableOpacity
            testID="select-all-btn"
            onPress={allSelected ? clearAll : selectAll}
          >
            <Text style={styles.selectAllText}>
              {allSelected ? 'Deselect all' : 'Select all'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Task list */}
      <ScrollView
        style={styles.listContainer}
        pointerEvents={isCreating ? 'none' : 'auto'}
      >
        {suggestions.map(suggestion => (
          <CriticalPathTaskRow
            key={suggestion.id}
            suggestion={suggestion}
            isSelected={selectedIds.has(suggestion.id)}
            disabled={isCreating}
            onPress={toggleSelection}
          />
        ))}
      </ScrollView>

      {/* CTA / progress area */}
      {isCreating ? (
        <View testID="creation-progress" style={styles.progressContainer}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.progressText}>
            {creationProgress
              ? `Creating tasks… ${creationProgress.completed} / ${creationProgress.total}`
              : 'Creating tasks…'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          testID="cta-add-tasks"
          style={[styles.ctaButton, selectedCount === 0 && styles.ctaButtonDisabled]}
          disabled={selectedCount === 0}
          onPress={async () => {
            const success = await confirmSelected(projectId);
            if (success) onDone?.();
          }}
        >
          <Text style={styles.ctaButtonText}>
            {selectedCount === 0
              ? 'Add Tasks to Plan'
              : `Add ${selectedCount} Task${selectedCount === 1 ? '' : 's'} to Plan`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 15,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    margin: 12,
  },
  errorBannerText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
  },
  retryInlinText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 8,
  },
  selectAllRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  selectAllText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '500',
  },
  listContainer: {
    flex: 1,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  progressText: {
    marginLeft: 12,
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  ctaButton: {
    backgroundColor: '#2563EB',
    margin: 16,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
  ctaButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
});
