/**
 * TimelineTaskCard
 *
 * Minimal task card for the project timeline.
 * Shows only: status icon, task title, status badge, and quick-action row.
 * Description and scheduled time are intentionally omitted to maximise
 * high-level scan-ability (design decision, issue #154).
 */

import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { cssInterop } from 'nativewind';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  ExternalLink,
  Camera,
  Paperclip,
} from 'lucide-react-native';
import { Task } from '../../domain/entities/Task';

cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(XCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Play, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ExternalLink, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Camera, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Paperclip, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Status styling helpers ───────────────────────────────────────────────────

interface StatusStyle {
  container: string;
  iconBg: string;
  text: string;
  label: string;
  iconColor: string;
}

function getStatusStyle(status: Task['status']): StatusStyle {
  switch (status) {
    case 'blocked':
      return {
        container: 'bg-red-50 border-red-200',
        iconBg: 'bg-red-100',
        text: 'text-red-700',
        iconColor: '#b91c1c',
        label: 'Blocked',
      };
    case 'pending':
      return {
        container: 'bg-yellow-50 border-yellow-200',
        iconBg: 'bg-yellow-100',
        text: 'text-yellow-700',
        iconColor: '#a16207',
        label: 'Pending',
      };
    case 'in_progress':
      return {
        container: 'bg-blue-50 border-blue-200',
        iconBg: 'bg-blue-100',
        text: 'text-blue-700',
        iconColor: '#1d4ed8',
        label: 'In Progress',
      };
    case 'completed':
      return {
        container: 'bg-green-50 border-green-200',
        iconBg: 'bg-green-100',
        text: 'text-green-700',
        iconColor: '#15803d',
        label: 'Completed',
      };
    case 'cancelled':
      return {
        container: 'bg-gray-50 border-gray-200',
        iconBg: 'bg-gray-100',
        text: 'text-gray-500',
        iconColor: '#6b7280',
        label: 'Cancelled',
      };
    default:
      return {
        container: 'bg-gray-50 border-gray-200',
        iconBg: 'bg-gray-100',
        text: 'text-gray-600',
        iconColor: '#6b7280',
        label: 'Unknown',
      };
  }
}

function StatusIcon({ status, color, size = 16 }: { status: Task['status']; color: string; size?: number }) {
  switch (status) {
    case 'blocked':    return <AlertCircle size={size} color={color} />;
    case 'pending':    return <Clock size={size} color={color} />;
    case 'in_progress': return <Play size={size} color={color} />;
    case 'completed':  return <CheckCircle size={size} color={color} />;
    case 'cancelled':  return <XCircle size={size} color={color} />;
    default:           return <Clock size={size} color={color} />;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export interface TimelineTaskCardProps {
  task: Task;
  onOpen: (task: Task) => void;
  onAddProgressLog: (task: Task) => void;
  onAttachDocument: (task: Task) => void;
  onMarkComplete: (task: Task) => void;
  testID?: string;
}

export function TimelineTaskCard({
  task,
  onOpen,
  onAddProgressLog,
  onAttachDocument,
  onMarkComplete,
  testID,
}: TimelineTaskCardProps) {
  const style = getStatusStyle(task.status);
  const isAlreadyDone = task.status === 'completed' || task.status === 'cancelled';

  return (
    <View
      testID={testID}
      className={`rounded-xl border p-3 ${style.container}`}
    >
      {/* Title row */}
      <View className="flex-row items-center gap-2">
        <View className={`rounded-md p-1 ${style.iconBg}`}>
          <StatusIcon status={task.status} color={style.iconColor} size={14} />
        </View>
        <Text
          className={`flex-1 text-sm font-semibold ${style.text}`}
          numberOfLines={2}
        >
          {task.title}
        </Text>
        <View className={`px-2 py-0.5 rounded-md ${style.iconBg}`}>
          <Text className={`text-[10px] font-bold uppercase tracking-wide ${style.text}`}>
            {style.label}
          </Text>
        </View>
      </View>

      {/* Quick-action row */}
      <View className="flex-row items-center gap-3 mt-2.5 pt-2.5 border-t border-black/5">
        <Pressable
          onPress={() => onOpen(task)}
          className="flex-row items-center gap-1 active:opacity-60"
          testID={testID ? `${testID}-open` : undefined}
        >
          <ExternalLink size={13} color="#6b7280" />
          <Text className="text-xs text-muted-foreground">Open</Text>
        </Pressable>

        <Pressable
          onPress={() => onAddProgressLog(task)}
          className="flex-row items-center gap-1 active:opacity-60"
          testID={testID ? `${testID}-log` : undefined}
        >
          <Camera size={13} color="#6b7280" />
          <Text className="text-xs text-muted-foreground">Log</Text>
        </Pressable>

        <Pressable
          onPress={() => onAttachDocument(task)}
          className="flex-row items-center gap-1 active:opacity-60"
          testID={testID ? `${testID}-doc` : undefined}
        >
          <Paperclip size={13} color="#6b7280" />
          <Text className="text-xs text-muted-foreground">Doc</Text>
        </Pressable>

        {!isAlreadyDone && (
          <Pressable
            onPress={() => onMarkComplete(task)}
            className="flex-row items-center gap-1 ml-auto active:opacity-60"
            testID={testID ? `${testID}-complete` : undefined}
          >
            <CheckCircle size={13} color="#15803d" />
            <Text className="text-xs text-green-700 font-semibold">Complete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
