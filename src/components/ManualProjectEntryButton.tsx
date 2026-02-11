import React from 'react';
import { Text, Pressable, PressableProps } from 'react-native';
import { Edit3 } from 'lucide-react-native';

interface ManualProjectEntryButtonProps extends PressableProps {
  onPress?: () => void;
}

export const ManualProjectEntryButton: React.FC<ManualProjectEntryButtonProps> = ({ onPress, style, ...props }) => {
  return (
    <Pressable
      onPress={onPress}
      className="bg-card border-2 border-border rounded-xl p-4 mb-4 flex-row items-center justify-center active:opacity-70"
      style={style}
      {...props}
    >
      <Edit3 className="text-foreground mr-2" size={20} />
      <Text className="text-foreground font-semibold text-base">+ Manual Project Entry</Text>
    </Pressable>
  );
};
