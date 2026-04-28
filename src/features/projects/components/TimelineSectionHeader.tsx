/**
 * TimelineSectionHeader
 *
 * Sticky-safe collapsible section heading for the Project Detail SectionList.
 * Must have a solid background so it opaques content scrolling beneath it
 * when pinned by stickySectionHeadersEnabled.
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(ChevronDown, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRight, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface TimelineSectionHeaderProps {
  title: string;
  itemCount: number;
  loading?: boolean;
  collapsed: boolean;
  onToggle: () => void;
  testID?: string;
}

export function TimelineSectionHeader({
  title,
  itemCount,
  loading = false,
  collapsed,
  onToggle,
  testID,
}: TimelineSectionHeaderProps) {
  return (
    <Pressable
      onPress={onToggle}
      className="flex-row items-center justify-between px-6 py-3 bg-background border-b border-border active:opacity-70"
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title} section, ${itemCount} items, ${collapsed ? 'collapsed' : 'expanded'}`}
      accessibilityState={{ expanded: !collapsed }}
    >
      <View className="flex-row items-center gap-2">
        {collapsed ? (
          <ChevronRight size={16} color="#6b7280" />
        ) : (
          <ChevronDown size={16} color="#6b7280" />
        )}
        <Text className="text-base font-bold text-foreground">{title}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        {loading ? (
          <View className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-pulse" />
        ) : null}
        <View className="px-2 py-0.5 bg-muted rounded-full">
          <Text
            className="text-xs font-semibold text-muted-foreground"
            testID={testID ? `${testID}-count` : undefined}
          >
            {itemCount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
