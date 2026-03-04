import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { HardHat, Phone, Mail, Pencil } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(HardHat, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Phone, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Mail, { className: { target: 'style', nativeStyleToProp: { color: true } } });
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
    <View className="bg-card p-4 rounded-lg border border-border">
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-sm font-semibold text-muted-foreground">SUBCONTRACTOR</Text>
        {onEditSubcontractor && (
          <TouchableOpacity onPress={onEditSubcontractor} className="p-1">
            <Pencil size={16} className="text-primary" />
          </TouchableOpacity>
        )}
      </View>

      {!subcontractor ? (
        <TouchableOpacity
          onPress={onEditSubcontractor}
          className="flex-row items-center gap-2 py-2"
        >
          <HardHat size={18} className="text-muted-foreground" />
          <Text className="text-sm text-muted-foreground">Assign subcontractor</Text>
        </TouchableOpacity>
      ) : (
        <View className="gap-2">
          <View className="flex-row items-center gap-2">
            <HardHat size={16} className="text-foreground" />
            <Text className="text-foreground font-medium">{subcontractor.name}</Text>
          </View>
          {subcontractor.trade && (
            <Text className="text-sm text-muted-foreground ml-6">{subcontractor.trade}</Text>
          )}
          {subcontractor.phone && (
            <View className="flex-row items-center gap-2">
              <Phone size={14} className="text-muted-foreground" />
              <Text className="text-sm text-foreground">{subcontractor.phone}</Text>
            </View>
          )}
          {subcontractor.email && (
            <View className="flex-row items-center gap-2">
              <Mail size={14} className="text-muted-foreground" />
              <Text className="text-sm text-foreground">{subcontractor.email}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
