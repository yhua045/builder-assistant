import React, { useEffect } from 'react';
import { View, Text, TextInput, Button, ScrollView, Modal, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, ChevronRight } from 'lucide-react-native';
import DatePickerInput from './inputs/DatePickerInput';
import ContactSelector from './inputs/ContactSelector';
import TeamSelector from './inputs/TeamSelector';
import { CriticalPathPreview } from './CriticalPathPreview/CriticalPathPreview';
import Dropdown from './inputs/Dropdown';
import type { DropdownOption } from './inputs/Dropdown';

const PROJECT_TYPE_OPTIONS: DropdownOption[] = [
  { label: 'Complete Rebuild',  value: 'complete_rebuild'  },
  { label: 'Extension',         value: 'extension'         },
  { label: 'Renovation',        value: 'renovation'        },
  { label: 'Knockdown Rebuild', value: 'knockdown_rebuild' },
  { label: 'Dual Occupancy',    value: 'dual_occupancy'    },
];

const STATE_OPTIONS: DropdownOption[] = [
  { label: 'NSW', value: 'NSW' },
  { label: 'VIC', value: 'VIC' },
  { label: 'QLD', value: 'QLD' },
  { label: 'WA',  value: 'WA'  },
  { label: 'SA',  value: 'SA'  },
  { label: 'TAS', value: 'TAS' },
  { label: 'ACT', value: 'ACT' },
  { label: 'NT',  value: 'NT'  },
];
import type { UseCriticalPathReturn } from '../hooks/useCriticalPath';

interface Props {
  visible?: boolean;
  onSave: (project: any) => void;
  onCancel: () => void;
  onTasksAdded?: () => void;
  criticalPathHook: UseCriticalPathReturn;
  projectId?: string | null;
}

interface FormErrors {
  name?: string;
  address?: string;
  dates?: string;
}

const ManualProjectEntryForm: React.FC<Props> = ({ visible = true, onSave, onCancel, onTasksAdded, criticalPathHook, projectId }) => {

  const [formStep, setFormStep] = React.useState<'details' | 'tasks'>('details');
  const [isSaving, setIsSaving] = React.useState(false);

  const [name, setName] = React.useState('');
  const [projectType, setProjectType] = React.useState('complete_rebuild');
  const [state, setStateLoc] = React.useState('NSW');
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

  // Advance to task-selection step once the parent reports back a saved projectId
  useEffect(() => {
    if (projectId) setFormStep('tasks');
  }, [projectId]);

  // Reset to details step when modal is closed/reopened
  useEffect(() => {
    if (!visible) setFormStep('details');
  }, [visible]);

  if (!visible) return null;

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

  const handleSave = async () => {
    if (!validateForm()) return;
    setIsSaving(true);
    try {
      const projectData = {
        name: name.trim(),
        projectType: projectType,
        state: state,
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

      await onSave(projectData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <SafeAreaView className="flex-1 bg-background">
        {/* Modal Header */}
        <View className="px-6 py-4 border-b border-border">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-2xl font-bold text-foreground">
                {formStep === 'details' ? 'New Project' : 'Add Tasks'}
              </Text>
              <Text className="text-sm text-muted-foreground mt-0.5">
                {formStep === 'details'
                  ? 'Step 1 of 2 · Project details'
                  : 'Step 2 of 2 · Select your starting tasks'}
              </Text>
            </View>
            <Pressable onPress={onCancel} className="p-2">
              <X className="text-foreground" size={24} />
            </Pressable>
          </View>
          {/* Step progress bar */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, formStep === 'tasks' && styles.progressFillFull]} />
          </View>
        </View>

        {/* Step 1: Project details */}
        {formStep === 'details' && (
        <ScrollView className="flex-1 p-6">
      
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

      {/* Project Type */}
      <View className="mb-4">
        <Dropdown
          label="Project Type"
          value={projectType}
          onChange={setProjectType}
          options={PROJECT_TYPE_OPTIONS}
          testID="dropdown-project-type"
        />
      </View>

      {/* State */}
      <View className="mb-4">
        <Dropdown
          label="State"
          value={state}
          onChange={setStateLoc}
          options={STATE_OPTIONS}
          testID="dropdown-state"
        />
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
          label=""
          value={startDate}
          onChange={setStartDate}
        />
      </View>

      {/* End Date */}
      <View className="mb-4">
        <Text className="mb-1 font-semibold text-foreground">End Date</Text>
        <DatePickerInput
          label=""
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
        <View style={styles.spacer} />
        {isSaving ? (
          <ActivityIndicator size="small" style={styles.savingIndicator} />
        ) : (
          <Pressable
            onPress={handleSave}
            disabled={!name.trim() || !address.trim()}
            style={[styles.saveButton, (!name.trim() || !address.trim()) && styles.saveButtonDisabled]}
          >
            <Text style={styles.saveButtonText}>Save Project</Text>
            <ChevronRight size={16} color="#fff" />
          </Pressable>
        )}
      </View>
        </ScrollView>
        )}

        {/* Step 2: Task selection */}
        {formStep === 'tasks' && projectId && (
          <CriticalPathPreview
            projectId={projectId}
            hookResult={criticalPathHook}
            onDone={onTasksAdded}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
};

export default ManualProjectEntryForm;

const styles = StyleSheet.create({
  spacer: {
    width: 12,
  },
  progressBar: {
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    width: '50%',
    backgroundColor: '#2563EB',
    borderRadius: 2,
  },
  progressFillFull: {
    width: '100%',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 4,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  savingIndicator: {
    marginHorizontal: 12,
  },
});
