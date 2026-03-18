/**
 * TimelineSectionHeader
 *
 * Collapsible section header for timeline sections on ProjectDetail.
 * Used for both the Task Timeline and the Quotes section.
 *
 * Layout:
 *   [ Title  count-badge ]  [ filter-pill ]  [ chevron ]
 *
 * LayoutAnimation is triggered in the parent toggle handler;
 * this component just renders the header row.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(ChevronDown, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRight, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface TimelineSectionHeaderProps {
  /** Section title, e.g. "Quotes" or "Task Timeline" */
  title: string;
  /** Total items in the current filtered view */
  itemCount: number;
  /** Whether the section body is currently expanded */
  expanded: boolean;
  /** Called when the collapse/expand area is pressed */
  onToggle: () => void;
  /** Optional summary line displayed beneath the title (e.g. total value) */
  summary?: string;
  /** Label shown on the filter toggle pill (e.g. "Show all (5)") */
  filterLabel?: string;
  /** Called when the filter pill is pressed */
  onToggleFilter?: () => void;
  testID?: string;
}

export function TimelineSectionHeader({
  title,
  itemCount,
  expanded,
  onToggle,
  summary,
  filterLabel,
  onToggleFilter,
  testID,
}: TimelineSectionHeaderProps) {
  return (
    <View
      className="flex-row items-center mb-4"
      testID={testID}
    >
      {/* ── Left: title + count badge + optional summary ── */}
      <Pressable
        className="flex-1 flex-row items-center gap-2 active:opacity-70"
        onPress={onToggle}
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <Text className="text-xl font-bold text-foreground">{title}</Text>

        {itemCount > 0 && (
          <View className="px-2 py-0.5 bg-primary/10 rounded-full">
            <Text
              className="text-xs font-semibold text-primary"
              testID={testID ? `${testID}-count` : undefined}
            >
              {itemCount}
            </Text>
          </View>
        )}

        {summary ? (
          <Text className="text-sm text-muted-foreground flex-shrink ml-1" numberOfLines={1}>
            {summary}
          </Text>
        ) : null}

        {expanded ? (
          <ChevronDown size={16} color="#6b7280" />
        ) : (
          <ChevronRight size={16} color="#6b7280" />
        )}
      </Pressable>

      {/* ── Right: optional filter toggle pill ── */}
      {filterLabel && onToggleFilter ? (
        <Pressable
          onPress={onToggleFilter}
          className="ml-2 px-3 py-1 bg-muted rounded-full active:opacity-70"
          testID={testID ? `${testID}-filter` : undefined}
        >
          <Text className="text-xs font-semibold text-muted-foreground">
            {filterLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
