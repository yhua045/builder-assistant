import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { DelayReason } from '../../domain/entities/DelayReason';
import { Clock, Plus, CheckCircle } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  delayReasons: DelayReason[];
  onAddDelay?: () => void;
  onRemoveDelay?: (id: string) => void;
  onResolveDelay?: (id: string) => void;
}

export function TaskDelaySection({ delayReasons, onAddDelay, onRemoveDelay, onResolveDelay }: Props) {
  return (
    <View className="bg-card p-4 rounded-lg border border-border">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-semibold text-muted-foreground">DELAY LOG</Text>
        {onAddDelay && (
          <TouchableOpacity onPress={onAddDelay} className="flex-row items-center gap-1">
            <Plus size={16} className="text-primary" />
            <Text className="text-sm text-primary font-medium">Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {delayReasons.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No delays recorded</Text>
      ) : (
        <View className="gap-3">
          {delayReasons.map((reason) => (
            <View key={reason.id} className="bg-muted p-3 rounded-lg">
              <View className="flex-row justify-between items-start">
                <View className="flex-row items-center gap-2 flex-1">
                  <Clock size={14} className="text-muted-foreground" />
                  <Text className="text-sm font-medium text-foreground">
                    {reason.reasonTypeLabel || reason.reasonTypeId}
                  </Text>
                </View>
                <View className="flex-row items-center gap-2">
                  {reason.resolvedAt ? (
                    <View className="flex-row items-center gap-1">
                      <CheckCircle size={14} className="text-green-600" />
                      <Text className="text-xs text-green-600 font-medium">Resolved</Text>
                    </View>
                  ) : (
                    <Text className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">Open</Text>
                  )}
                  {reason.delayDurationDays != null && (
                    <Text className="text-xs text-muted-foreground">
                      {reason.delayDurationDays}d
                    </Text>
                  )}
                </View>
              </View>

              {reason.notes && (
                <Text className="text-sm text-muted-foreground mt-1 ml-6">{reason.notes}</Text>
              )}

              {reason.mitigationNotes && reason.resolvedAt && (
                <Text className="text-sm text-muted-foreground italic mt-1 ml-6">↳ {reason.mitigationNotes}</Text>
              )}

              <View className="flex-row items-center gap-3 mt-2 ml-6">
                {reason.delayDate && (
                  <Text className="text-xs text-muted-foreground">
                    {new Date(reason.delayDate).toLocaleDateString()}
                  </Text>
                )}
                {reason.actor && (
                  <Text className="text-xs text-muted-foreground">{reason.actor}</Text>
                )}
                {reason.resolvedAt && (
                  <Text className="text-xs text-muted-foreground">
                    Resolved {new Date(reason.resolvedAt).toLocaleDateString()}
                  </Text>
                )}
                <Text className="text-xs text-muted-foreground">
                  {new Date(reason.createdAt).toLocaleDateString()}
                </Text>
              </View>

              <View className="flex-row gap-3 mt-2 ml-6">
                {!reason.resolvedAt && onResolveDelay && (
                  <TouchableOpacity onPress={() => onResolveDelay(reason.id)}>
                    <Text className="text-xs text-green-600 font-medium">Mark Resolved</Text>
                  </TouchableOpacity>
                )}
                {onRemoveDelay && (
                  <TouchableOpacity onPress={() => onRemoveDelay(reason.id)}>
                    <Text className="text-xs text-destructive">Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
