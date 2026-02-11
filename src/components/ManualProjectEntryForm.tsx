import React from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import DatePickerInput from './inputs/DatePickerInput';
import ContactSelector from './inputs/ContactSelector';
import TeamSelector from './inputs/TeamSelector';

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
  const [projectOwner, setProjectOwner] = React.useState<string | null>(null);
  const [team, setTeam] = React.useState<string | null>(null);
  const [startDate, setStartDate] = React.useState<Date | null>(null);
  const [endDate, setEndDate] = React.useState<Date | null>(null);
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
      if (startDate >= endDate) {
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
      projectOwner: projectOwner ? projectOwner : undefined,
      team: team ? team : undefined,
      visibility: 'Public' as const,
      startDate: startDate ? startDate : undefined,
      expectedEndDate: endDate ? endDate : undefined,
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
        <ContactSelector
          label="Project Owner"
          value={projectOwner}
          onChange={setProjectOwner}
        />
      </View>

      {/* Team */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Team</Text>
        <TeamSelector
          label="Team"
          value={team}
          onChange={setTeam}
        />
      </View>

      {/* Start Date */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">Start Date</Text>
        <DatePickerInput
          label="Start Date"
          value={startDate}
          onChange={setStartDate}
        />
      </View>

      {/* End Date */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">End Date</Text>
        <DatePickerInput
          label="End Date"
          value={endDate}
          onChange={setEndDate}
          error={errors.dates}
        />
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
