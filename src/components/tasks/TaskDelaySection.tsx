import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { DelayReason } from '../../domain/entities/DelayReason';
import { Clock, Plus } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  delayReasons: DelayReason[];
  onAddDelay?: () => void;
  onRemoveDelay?: (id: string) => void;
}

export function TaskDelaySection({ delayReasons, onAddDelay, onRemoveDelay }: Props) {
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
                {reason.delayDurationDays != null && (
                  <Text className="text-xs text-muted-foreground">
                    {reason.delayDurationDays}d
                  </Text>
                )}
              </View>

              {reason.notes && (
                <Text className="text-sm text-muted-foreground mt-1 ml-6">{reason.notes}</Text>
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
                <Text className="text-xs text-muted-foreground">
                  {new Date(reason.createdAt).toLocaleDateString()}
                </Text>
              </View>

              {onRemoveDelay && (
                <TouchableOpacity
                  onPress={() => onRemoveDelay(reason.id)}
                  className="mt-2 ml-6"
                >
                  <Text className="text-xs text-destructive">Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
