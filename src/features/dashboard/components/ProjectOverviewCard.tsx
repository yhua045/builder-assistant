import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ProjectOverview } from '../hooks/useProjectsOverview';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import { PendingPaymentBadge } from './PendingPaymentBadge';
import { PhaseProgressRow } from './PhaseProgressRow';

interface ProjectOverviewCardProps {
  overview: ProjectOverview;
  onPress: () => void;
}

export function ProjectOverviewCard({ overview, onPress }: ProjectOverviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { project } = overview;

  const statusColorClass = ({
    on_track: 'bg-green-500',
    at_risk:  'bg-orange-500',
    blocked:  'bg-red-500',
  } as Record<string, string>)[overview.overallStatus] ?? 'bg-yellow-500';

  const statusLabel = ({
    on_track: 'On Track',
    at_risk:  'In Progress',
    blocked:  'Blocked',
  } as Record<string, string>)[overview.overallStatus] ?? 'In Progress';

  return (
    <Pressable
      onPress={onPress}
      className="bg-card border border-border rounded-2xl mb-4 overflow-hidden"
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      {/* ── ZONE 1: Header ── */}
      <View className="p-5 border-b border-border bg-muted/30">
        <View className="flex-row items-start justify-between">
          {/* Left: name + subtitle */}
          <View className="flex-1 pr-4">
            <Text className="text-lg font-bold text-foreground mb-1">
              {project.name}
            </Text>
            <View className="flex-row items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <Text className="text-xs text-muted-foreground">Active Project</Text>
            </View>
          </View>
          {/* Right: payment badge */}
          {overview.totalPendingPayment > 0 && (
            <PendingPaymentBadge amount={overview.totalPendingPayment} />
          )}
        </View>
      </View>

      {/* ── ZONE 2a: Simple View (collapsed) ── */}
      {!expanded && (
        <View className="p-5 bg-card">
          <View className="flex-row justify-between items-end mb-2">
            <Text className="text-sm font-semibold text-foreground">Overall Progress</Text>
            <Text className="text-xs font-bold text-muted-foreground">
              {overview.totalTasksCompleted}/{overview.totalTasksCount} tasks
            </Text>
          </View>
          <View className="h-3 bg-muted rounded-full overflow-hidden mb-2">
            <View
              className={`h-full rounded-full ${statusColorClass}`}
              style={{ width: `${overview.allTasksPercent}%` }}
            />
          </View>
          <View className="flex-row items-center justify-between mt-2">
            <View className="flex-row items-center">
              <View className={`w-2 h-2 rounded-full ${statusColorClass} mr-2`} />
              <Text className="text-xs text-muted-foreground">{statusLabel}</Text>
            </View>
            <Text className="text-xs font-bold text-foreground">
              {overview.allTasksPercent}%
            </Text>
          </View>
        </View>
      )}

      {/* ── ZONE 2b: Comprehensive View (expanded) ── */}
      {expanded && (
        <View className="p-5 gap-6">
          {overview.phaseOverviews.map(po => (
            <PhaseProgressRow key={po.phaseId ?? 'unassigned'} phaseOverview={po} />
          ))}
        </View>
      )}

      {/* ── ZONE 3: Toggle Button ── */}
      <Pressable
        onPress={() => setExpanded(prev => !prev)}
        className="flex-row items-center justify-center py-3 bg-muted/20 border-t border-border active:bg-muted/40"
      >
        <Text className="text-sm font-medium text-primary mr-2">
          {expanded ? 'Show Less' : 'View Details'}
        </Text>
        {expanded
          ? <ChevronUp size={18} className="text-primary" />
          : <ChevronDown size={18} className="text-primary" />
        }
      </Pressable>
    </Pressable>
  );
}