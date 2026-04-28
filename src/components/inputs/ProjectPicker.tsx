import React, { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, ActivityIndicator } from 'react-native';
import { useProjects } from '../../features/projects';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export const ProjectPicker: React.FC<Props> = ({ value, onChange }) => {
  const { projects, loading } = useProjects();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-12 rounded-lg border border-input bg-background px-3 justify-center"
      >
        <Text className={`${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value ? (projects.find((p) => p.id === value)?.name ?? value) : 'None'}
        </Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View className="flex-1 p-4 bg-background">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-foreground">Select Project</Text>
            <Pressable onPress={() => setOpen(false)}>
              <Text className="text-primary">Close</Text>
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator />
          ) : (
            <FlatList
              data={[{ id: '', name: 'None' }, ...projects.map((p) => ({ id: p.id, name: p.name }))]}
              keyExtractor={(item) => item.id || 'none'}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.id);
                    setOpen(false);
                  }}
                  className="p-4 border-b border-border"
                >
                  <Text className="text-foreground">{item.name}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </>
  );
};

export default ProjectPicker;
