import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useColorScheme } from 'nativewind';
import { Moon, Sun } from 'lucide-react-native';

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  return (
    <TouchableOpacity 
      onPress={toggleColorScheme} 
      className="p-2 rounded-full bg-gray-200 dark:bg-gray-800"
    >
      {colorScheme === 'dark' ? (
        <Sun size={20} color="#fbbf24" />
      ) : (
        <Moon size={20} color="#4b5563" />
      )}
    </TouchableOpacity>
  );
}
