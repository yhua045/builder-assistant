import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
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
      <View testID="loading-skeleton" className="flex-1 items-center justify-center p-6">
        <ActivityIndicator testID="loading-indicator" size="large" color="#2563EB" />
        <Text className="mt-3 text-[15px] color-slate-500">Loading suggestions…</Text>
      </View>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-[15px] color-red-600 text-center mb-4">{error}</Text>
        <TouchableOpacity
          testID="error-retry-btn"
          className="bg-blue-600 rounded-lg px-5 py-2.5"
          onPress={() => suggest({ project_type: 'complete_rebuild' })}
        >
          <Text className="color-white font-semibold text-[15px]">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Creation error banner */}
      {creationError ? (
        <View testID="creation-error-banner" className="flex-row items-center justify-between bg-red-100 px-4 py-2.5 rounded-lg m-3">
          <Text className="color-red-600 text-sm flex-1">{creationError}</Text>
          <TouchableOpacity
            testID="creation-error-retry-btn"
            onPress={() => confirmSelected(projectId)}
          >
            <Text className="color-red-600 font-bold text-sm ml-2">Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Select all / deselect all control */}
      {suggestions.length > 0 && !isCreating ? (
        <View className="flex-row justify-end px-4 py-2 border-b border-gray-100">
          <TouchableOpacity
            testID="select-all-btn"
            onPress={allSelected ? clearAll : selectAll}
          >
            <Text className="color-blue-600 text-sm font-medium">
              {allSelected ? 'Deselect all' : 'Select all'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Task list */}
      <ScrollView
        className="flex-1"
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
        <View testID="creation-progress" className="flex-row items-center justify-center py-[18px] px-4 border-t border-gray-200">
          <ActivityIndicator size="small" color="#2563EB" />
          <Text className="ml-3 text-[15px] color-gray-700 font-medium">
            {creationProgress
              ? `Creating tasks… ${creationProgress.completed} / ${creationProgress.total}`
              : 'Creating tasks…'}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          testID="cta-add-tasks"
          className={`bg-blue-600 m-4 rounded-[10px] py-3.5 items-center ${selectedCount === 0 ? 'bg-blue-300' : ''}`}
          disabled={selectedCount === 0}
          onPress={async () => {
            const success = await confirmSelected(projectId);
            if (success) onDone?.();
          }}
        >
          <Text className="color-white font-bold text-base">
            {selectedCount === 0
              ? 'Add Tasks to Plan'
              : `Add ${selectedCount} Task${selectedCount === 1 ? '' : 's'} to Plan`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
