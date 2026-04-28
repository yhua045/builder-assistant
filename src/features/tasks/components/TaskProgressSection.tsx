import React, { useState } from 'react';
import { View, Text, Image, Pressable, TouchableOpacity, Alert } from 'react-native';
import { Plus, MoreVertical, Edit2, Trash2 } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { ProgressLog } from '../../../domain/entities/ProgressLog';

cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MoreVertical, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Edit2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ── Badge config ──────────────────────────────────────────────────────────────

interface BadgeConfig { bg: string; text: string; label: string }

const LOG_TYPE_BADGE: Record<ProgressLog['logType'], BadgeConfig> = {
  info:       { bg: 'bg-muted',     text: 'text-muted-foreground', label: 'Info'       },
  general:    { bg: 'bg-muted',     text: 'text-muted-foreground', label: 'General'    },
  inspection: { bg: 'bg-blue-100',  text: 'text-blue-700',         label: 'Inspection' },
  delay:      { bg: 'bg-amber-100', text: 'text-amber-700',        label: 'Delay'      },
  issue:      { bg: 'bg-red-100',   text: 'text-red-700',          label: 'Issue'      },
  completion: { bg: 'bg-green-100', text: 'text-green-700',        label: 'Completion' },
  other:      { bg: 'bg-muted',     text: 'text-muted-foreground', label: 'Other'      },
};

function LogTypeBadge({ logType }: { logType: ProgressLog['logType'] }) {
  const cfg = LOG_TYPE_BADGE[logType] ?? LOG_TYPE_BADGE.other;
  return (
    <View
      className={`px-2 py-0.5 rounded-full ${cfg.bg}`}
      accessibilityLabel={`log type: ${logType}`}
    >
      <Text className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</Text>
    </View>
  );
}

// ── Relative time ─────────────────────────────────────────────────────────────

export function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH} hour${diffH !== 1 ? 's' : ''} ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD} day${diffD !== 1 ? 's' : ''} ago`;
  const d = new Date(ts);
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Log card ──────────────────────────────────────────────────────────────────

interface LogCardProps {
  log: ProgressLog;
  isLast: boolean;
  onEdit?: (log: ProgressLog) => void;
  onDelete?: (logId: string) => void;
}

function LogCard({ log, isLast, onEdit, onDelete }: LogCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDeletePress = () => {
    setMenuOpen(false);
    Alert.alert(
      'Delete Log',
      'Are you sure you want to delete this progress log?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(log.id) },
      ],
    );
  };

  const createdAtMs =
    typeof log.createdAt === 'number'
      ? log.createdAt
      : new Date(log.createdAt).getTime();

  return (
    <View className="flex-row gap-4">
      {/* Timeline dot + line */}
      <View className="items-center">
        <View className="w-4 h-4 rounded-full bg-primary border-4 border-background" />
        {!isLast && <View className="w-0.5 flex-1 bg-border mt-2" />}
      </View>

      {/* Card */}
      <View className="flex-1 pb-6">
        <View className="bg-card border border-border rounded-2xl p-4 mb-3">
          {/* Header row */}
          <View className="flex-row items-center justify-between mb-2">
            <View className="flex-row items-center gap-2 flex-1 flex-wrap">
              <LogTypeBadge logType={log.logType} />
              <Text className="text-xs text-muted-foreground">
                {formatRelativeTime(createdAtMs)}
              </Text>
            </View>

            {(onEdit || onDelete) && (
              <View>
                <TouchableOpacity
                  onPress={() => setMenuOpen((v) => !v)}
                  className="p-1"
                  accessibilityLabel="Log options"
                  testID={`log-options-${log.id}`}
                >
                  <MoreVertical size={16} className="text-muted-foreground" />
                </TouchableOpacity>
                {menuOpen && (
                  <View className="absolute right-0 top-7 bg-card border border-border rounded-xl shadow-lg z-10 min-w-[120px]">
                    <TouchableOpacity
                      onPress={() => { setMenuOpen(false); onEdit?.(log); }}
                      className="flex-row items-center gap-2 px-4 py-3"
                      accessibilityLabel="Edit log"
                      testID={`log-edit-${log.id}`}
                    >
                      <Edit2 size={14} className="text-foreground" />
                      <Text className="text-sm text-foreground">Edit</Text>
                    </TouchableOpacity>
                    <View className="h-px bg-border" />
                    <TouchableOpacity
                      onPress={handleDeletePress}
                      className="flex-row items-center gap-2 px-4 py-3"
                      accessibilityLabel="Delete log"
                      testID={`log-delete-${log.id}`}
                    >
                      <Trash2 size={14} className="text-destructive" />
                      <Text className="text-sm text-destructive">Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Actor */}
          {log.actor && (
            <Text className="text-xs text-primary font-medium mb-2">by {log.actor}</Text>
          )}

          {/* Notes */}
          {log.notes && (
            <Text className="text-sm text-foreground leading-relaxed mb-3">{log.notes}</Text>
          )}

          {/* Photos */}
          {log.photos && log.photos.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {log.photos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  className="w-full h-40 rounded-xl"
                  resizeMode="cover"
                />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface Props {
  progressLogs?: ProgressLog[];
  onAddLog?: () => void;
  onEditLog?: (log: ProgressLog) => void;
  onDeleteLog?: (logId: string) => void;
}

export function TaskProgressSection({ progressLogs = [], onAddLog, onEditLog, onDeleteLog }: Props) {
  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Progress Logs
        </Text>
        <Pressable
          onPress={onAddLog}
          className="flex-row items-center gap-2 bg-primary/10 px-3 py-2 rounded-full"
          accessibilityLabel="Add progress log"
        >
          <Plus className="text-primary" size={16} />
          <Text className="text-xs text-primary font-semibold">Add Log</Text>
        </Pressable>
      </View>

      {progressLogs.length === 0 ? (
        <View className="items-center py-8 bg-card border border-border rounded-2xl">
          <Text className="text-muted-foreground text-sm">No progress logs yet</Text>
          <Text className="text-muted-foreground text-xs mt-1">
            Tap "+ Add Log" to record the first entry
          </Text>
        </View>
      ) : (
        <View className="pl-2">
          {progressLogs.map((log, index) => (
            <LogCard
              key={log.id}
              log={log}
              isLast={index === progressLogs.length - 1}
              onEdit={onEditLog}
              onDelete={onDeleteLog}
            />
          ))}
        </View>
      )}
    </View>
  );
}

