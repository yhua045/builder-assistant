import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { BlockedTaskItem } from '../../utils/selectTopBlockedTasks';

export interface CriticalTasksTimelineProps {
  items: BlockedTaskItem[];
  onItemPress?: (item: BlockedTaskItem) => void;
  testID?: string;
}

const SEVERITY_CONFIG = {
  critical: {
    badgeBg: "bg-red-100",
    textColor: "text-red-700",
    dotColor: "bg-red-500",
  },
  high: {
    badgeBg: "bg-orange-100",
    textColor: "text-orange-700",
    dotColor: "bg-orange-500",
  },
  medium: {
    badgeBg: "bg-amber-100",
    textColor: "text-amber-700",
    dotColor: "bg-amber-500",
  },
  low: {
    badgeBg: "bg-blue-100",
    textColor: "text-blue-700",
    dotColor: "bg-blue-500",
  }
};

export function CriticalTasksTimeline({ items, onItemPress, testID }: CriticalTasksTimelineProps) {
  if (!items || items.length === 0) {
    return (
      <View className="py-4" testID={testID}>
        <Text className="text-muted-foreground text-center">No critical blocked tasks.</Text>
      </View>
    );
  }

  return (
    <View className="pl-2" testID={testID} testID="critical-tasks-timeline">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const severityConfig = item.severity ? SEVERITY_CONFIG[item.severity] : SEVERITY_CONFIG.medium;

        return (
          <View key={item.id} className="flex-row gap-4">
            {/* Timeline Line */}
            <View className="items-center">
              <View
                className={`w-4 h-4 rounded-full ${severityConfig.dotColor} border-4 border-background`}
              />
              {!isLast && (
                <View className="w-0.5 flex-1 bg-border mt-2" />
              )}
            </View>

            {/* Content Card */}
            <View className="flex-1 pb-6">
              <TouchableOpacity
                onPress={() => onItemPress?.(item)}
                className="bg-card border border-border rounded-2xl p-4"
                activeOpacity={0.7}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-2">
                    {/* Project Badge */}
                    <View className="flex-row items-center gap-2 mb-2">
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: item.projectColor || '#94a3b8',
                        }}
                      />
                      <Text className="text-sm text-muted-foreground font-medium">
                        {item.projectName}
                      </Text>
                    </View>
                    
                    {/* Task Title */}
                    <Text className="text-base font-bold text-foreground mb-3">
                      {item.title}
                    </Text>
                    
                    {/* Scheduled Date */}
                    <View className="flex-row items-center gap-2">
                      <Calendar
                        size={14}
                        className="text-muted-foreground"
                      />
                      <Text className="text-xs text-muted-foreground">
                        {item.scheduledAt || 'TBD'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Severity Badge */}
                  {item.severity && (
                    <View
                      className={`${severityConfig.badgeBg} px-2 py-1 rounded-md`}
                    >
                      <Text
                        className={`${severityConfig.textColor} text-[10px] font-bold uppercase`}
                      >
                        {item.severity}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}
