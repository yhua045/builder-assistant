import React from 'react';
import { View, Text, TextInput, Button, ScrollView, Platform } from 'react-native';

interface Props {
  visible: boolean;
  onSave: (project: any) => void;
  onCancel: () => void;
}

interface FormErrors {
  name?: string;
  address?: string;
  dates?: string;
}

const ManualProjectEntryForm: React.FC<Props> = ({ visible, onSave, onCancel }) => {
  if (!visible) return null;

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [address, setAddress] = React.useState('');
  const [projectOwner, setProjectOwner] = React.useState('');
  const [team, setTeam] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [priority, setPriority] = React.useState('Low');
  const [notes, setNotes] = React.useState('');
  const [errors, setErrors] = React.useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = 'Project name is required';
    }

    if (!address.trim()) {
      newErrors.address = 'Address is required';
    }

    // Validate dates if both present
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (start >= end) {
        newErrors.dates = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;

    const projectData = {
      name: name.trim(),
      description: description.trim() || undefined,
      address: address.trim() || undefined,
      projectOwner: projectOwner.trim() || undefined,
      team: team.trim() || undefined,
      visibility: 'Public' as const,
      startDate: startDate ? new Date(startDate) : undefined,
      expectedEndDate: endDate ? new Date(endDate) : undefined,
      budget: budget ? parseFloat(budget) : undefined,
      priority: priority as 'Low' | 'Medium' | 'High',
      notes: notes.trim() || undefined
    };

    onSave(projectData);
  };

  return (
    <ScrollView className="flex-1 p-4 bg-background">
      <Text className="text-2xl font-bold mb-6 text-foreground">New Project</Text>
      
      {/* Name - Required */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Name *</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Project name"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
        {errors.name && <Text className="text-red-500 text-sm mt-1">{errors.name}</Text>}
      </View>

      {/* Address - Required */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Address *</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Property address"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
        {errors.address && <Text className="text-red-500 text-sm mt-1">{errors.address}</Text>}
      </View>

      {/* Description */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Project description"
          multiline
          numberOfLines={3}
          className="border border-border rounded p-2 bg-card text-foreground"
        />
      </View>

      {/* Project Owner */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Project Owner</Text>
        <TextInput
          value={projectOwner}
          onChangeText={setProjectOwner}
          placeholder="Owner name or ID"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
      </View>

      {/* Team */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Team</Text>
        <TextInput
          value={team}
          onChangeText={setTeam}
          placeholder="Team members"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
      </View>

      {/* Start Date */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Start Date</Text>
        <TextInput
          value={startDate}
          onChangeText={setStartDate}
          placeholder="YYYY-MM-DD"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
      </View>

      {/* End Date */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">End Date</Text>
        <TextInput
          value={endDate}
          onChangeText={setEndDate}
          placeholder="YYYY-MM-DD"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
        {errors.dates && <Text className="text-red-500 text-sm mt-1">{errors.dates}</Text>}
      </View>

      {/* Budget */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Budget</Text>
        <TextInput
          value={budget}
          onChangeText={setBudget}
          placeholder="0.00"
          keyboardType="numeric"
          className="border border-border rounded p-2 bg-card text-foreground"
        />
      </View>

      {/* Priority */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Priority</Text>
        <View className="flex-row gap-2">
          {['Low', 'Medium', 'High'].map((p) => (
            <Button
              key={p}
              title={p}
              onPress={() => setPriority(p)}
              color={priority === p ? '#007AFF' : '#8E8E93'}
            />
          ))}
        </View>
      </View>

      {/* Notes */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Additional notes"
          multiline
          numberOfLines={4}
          className="border border-border rounded p-2 bg-card text-foreground"
        />
      </View>

      {/* Actions */}
      <View className="flex-row justify-end mt-6 mb-4">
        <Button title="Cancel" onPress={onCancel} color="#8E8E93" />
        <View style={{ width: 12 }} />
        <Button
          title="Save"
          onPress={handleSave}
          disabled={!name.trim() || !address.trim()}
        />
      </View>
    </ScrollView>
  );
};

export default ManualProjectEntryForm;
