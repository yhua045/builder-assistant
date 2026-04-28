import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Users, Pencil } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Users, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Pencil, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface SubcontractorInfo {
  id: string;
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
}

interface Props {
  subcontractor: SubcontractorInfo | null;
  onEditSubcontractor?: () => void;
}

export function TaskSubcontractorSection({ subcontractor, onEditSubcontractor }: Props) {
  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Subcontractors
        </Text>
        <Text className="text-xs text-primary font-semibold">
          {subcontractor ? '1 assigned' : '0 assigned'}
        </Text>
      </View>
      
      <View className="bg-card border border-border rounded-2xl overflow-hidden min-h-[72px] justify-center">
        {!subcontractor ? (
          <TouchableOpacity
            onPress={onEditSubcontractor}
            className="p-4 flex-row items-center justify-center gap-2"
          >
            <Users size={18} className="text-muted-foreground" />
            <Text className="text-sm text-muted-foreground">Assign subcontractor</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            onPress={onEditSubcontractor}
            className="p-4 flex-row items-center justify-between"
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-primary/10 rounded-full items-center justify-center">
                <Users className="text-primary" size={18} />
              </View>
              <View>
                <Text className="text-foreground font-semibold text-sm">
                  {subcontractor.name}
                </Text>
                {subcontractor.trade && (
                  <Text className="text-muted-foreground text-xs">
                    {subcontractor.trade}
                  </Text>
                )}
              </View>
            </View>
            {subcontractor.phone && (
              <Text className="text-muted-foreground text-xs">
                {subcontractor.phone}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
