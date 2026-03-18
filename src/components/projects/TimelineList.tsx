/**
 * TimelineList
 *
 * Generic collapsible day-group list for use in timeline sections.
 * Used by both the Task and Quotes sections of ProjectDetail.
 *
 * Each group can be individually collapsed/expanded.
 * Manages its own group-toggle state internally; the parent simply passes
 * the `groups` data and a `renderItem` factory.
 *
 * @template T — the item type inside each day group
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, LayoutAnimation } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(ChevronDown, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRight, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface DayGroupGeneric<T> {
  /** ISO date YYYY-MM-DD, or '__nodate__' */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Mar" */
  label: string;
  items: T[];
}

export interface TimelineListProps<T> {
  groups: DayGroupGeneric<T>[];
  renderItem: (item: T, groupDate: string, itemIndex: number) => React.ReactNode;
  /** Message shown when groups is empty */
  emptyMessage?: string;
  testID?: string;
}

export function TimelineList<T>({
  groups,
  renderItem,
  emptyMessage = 'No items.',
  testID,
}: TimelineListProps<T>) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const initialised = useRef(false);

  // Auto-expand today/future groups when data first arrives
  useEffect(() => {
    if (!groups.length || initialised.current) return;
    const todayStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const init: Record<string, boolean> = {};
    for (const g of groups) {
      init[g.date] = g.date === '__nodate__' || g.date >= todayStr;
    }
    setExpandedGroups(init);
    initialised.current = true;
  }, [groups]);

  // When the set of groups changes (e.g. filter toggle), initialise new keys
  useEffect(() => {
    const todayStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (!(g.date in next)) {
          next[g.date] = g.date === '__nodate__' || g.date >= todayStr;
        }
      }
      return next;
    });
  }, [groups]);

  const handleToggle = useCallback((date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups((prev) => ({ ...prev, [date]: !prev[date] }));
  }, []);

  if (groups.length === 0) {
    return (
      <Text
        testID={testID ? `${testID}-empty` : undefined}
        className="text-muted-foreground text-center py-8"
      >
        {emptyMessage}
      </Text>
    );
  }

  return (
    <View testID={testID}>
      {groups.map((group, groupIdx) => {
        const expanded = expandedGroups[group.date] !== false;
        const isLast = groupIdx === groups.length - 1;

        return (
          <View key={group.date} className="flex-row">
            {/* ── Left column: date ── */}
            <View className="w-16 pr-3 items-end" style={{ paddingTop: 10 }}>
              <Text className="text-sm font-bold text-foreground leading-tight">
                {group.date !== '__nodate__'
                  ? new Date(`${group.date}T00:00:00Z`).getUTCDate().toString()
                  : '—'}
              </Text>
              <Text className="text-xs text-muted-foreground uppercase leading-tight">
                {group.date !== '__nodate__'
                  ? new Date(`${group.date}T00:00:00Z`).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    })
                  : ''}
              </Text>
            </View>

            {/* ── Right column: connector + items ── */}
            <View className="flex-1 relative">
              {!isLast && (
                <View className="absolute left-0 top-0 bottom-0 w-px bg-border" />
              )}

              {/* Group header row */}
              <Pressable
                onPress={() => handleToggle(group.date)}
                className="flex-row items-center gap-2 pb-2 active:opacity-70"
                testID={testID ? `${testID}-group-${group.date}` : undefined}
              >
                <View className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-background -ml-[5px]" />
                <Text className="text-xs text-muted-foreground font-medium">{group.label}</Text>
                {expanded ? (
                  <ChevronDown size={12} color="#6b7280" />
                ) : (
                  <ChevronRight size={12} color="#6b7280" />
                )}
                <View className="ml-1 px-1.5 py-0.5 bg-muted rounded-full">
                  <Text className="text-[10px] text-muted-foreground font-semibold">
                    {group.items.length}
                  </Text>
                </View>
              </Pressable>

              {/* Items */}
              {expanded &&
                group.items.map((item, itemIdx) =>
                  renderItem(item, group.date, itemIdx),
                )}

              {/* Bottom spacing */}
              {!isLast && <View className="h-4" />}
            </View>
          </View>
        );
      })}
    </View>
  );
}
