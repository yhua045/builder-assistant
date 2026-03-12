import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Alert,
  Pressable,
} from 'react-native';
import DocumentPicker from 'react-native-document-picker';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Task, PREDEFINED_WORK_TYPES } from '../../domain/entities/Task';
import { Document } from '../../domain/entities/Document';
import ProjectPicker from '../inputs/ProjectPicker';
import { TaskDraft } from '../../application/services/IVoiceParsingService';
import DatePickerInput from '../inputs/DatePickerInput';
import { X, Save, Trash2 } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

import { useTaskForm, PendingDocument } from '../../hooks/useTaskForm';
import { useAcceptQuote } from '../../hooks/useAcceptQuote';
import { TaskDocumentSection } from './TaskDocumentSection';
import { TaskSubcontractorSection } from './TaskSubcontractorSection';
import { TaskDependencySection } from './TaskDependencySection';
import { AddDelayReasonModal, AddDelayReasonFormData } from './AddDelayReasonModal';
import { SubcontractorPickerModal, SubcontractorContact } from './SubcontractorPickerModal';
import { TaskPickerModal } from '../../pages/tasks/TaskPickerModal';
import { useDelayReasonTypes } from '../../hooks/useDelayReasonTypes';
import { useTasks } from '../../hooks/useTasks';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Save, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  initialValues?: Partial<Task> | TaskDraft;
  /** Called after the form successfully creates or updates the task. */
  onSuccess?: (task: Task) => void;
  onCancel: () => void;
  /** Not used internally — kept for backward compatibility with callers that still
   *  pass it.  Prefer onSuccess for new integrations. */
  onSubmit?: (data: Partial<Task>) => Promise<void>;
  isLoading?: boolean;
  /** Pre-fetched documents to display in edit mode */
  savedDocuments?: Document[];
  /** Called when a quote is accepted and an invoice is created. Caller may navigate to invoice. */
  onAcceptSuccess?: (invoiceId: string) => void;
}

export function TaskForm({
  initialValues,
  onSuccess,
  onCancel,
  onSubmit: legacyOnSubmit,
  isLoading,
  savedDocuments: initialSavedDocs,
  onAcceptSuccess,
}: Props) {
  const initialAsTask = initialValues as Partial<Task> | undefined;

  // Determine which save mode to use
  const useSelfManagedSave = Boolean(onSuccess) || !legacyOnSubmit;

  const form = useTaskForm({
    initialTask: initialAsTask,
    onSuccess,
  });

  // For legacy callers (onSubmit without onSuccess): handle externally
  const handleLegacySubmit = async () => {
    if (!form.title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    const data: Partial<Task> = {
      title: form.title,
      notes: form.notes,
      projectId: form.projectId || undefined,
      dueDate: form.dueDate?.toISOString(),
      status: form.status,
      priority: form.priority,
      isScheduled: !!form.dueDate,
      subcontractorId: form.subcontractorId,
    };
    await legacyOnSubmit!(data);
  };

  const handleSubmit = async () => {
    if (useSelfManagedSave) {
      // useTaskForm.submit() handles validation, create/update, docs, dependencies
      await form.submit();
      if (form.validationError) {
        Alert.alert('Error', form.validationError);
      }
    } else {
      await handleLegacySubmit();
    }
  };

  // ── Subcontractor picker modal ────────────────────────────────────────────
  const [showSubcontractorPicker, setShowSubcontractorPicker] = useState(false);
  const [selectedSubcontractor, setSelectedSubcontractor] =
    useState<SubcontractorContact | undefined>(undefined);

  const handleSubcontractorSelect = (contact: SubcontractorContact | undefined) => {
    setSelectedSubcontractor(contact);
    form.setSubcontractorId(contact?.id);
  };

  // ── Document picker ──────────────────────────────────────────────────────
  const handleAddDocument = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
      });
      const file = Array.isArray(result) ? result[0] : result;
      if (!file) return;
      const pd: PendingDocument = {
        uri: file.uri,
        filename: file.name ?? 'document',
        mimeType: file.type ?? undefined,
        size: file.size ?? undefined,
      };
      form.addPendingDocument(pd);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        Alert.alert('Error', 'Could not open file picker');
      }
    }
  };

  const handleAddQuotePhoto = async () => {
    try {
      const result = await launchCamera({ mediaType: 'photo', quality: 0.8 });
      const asset = result.assets?.[0];
      if (!asset?.uri) return;
      const pd: PendingDocument = {
        uri: asset.uri,
        filename: asset.fileName ?? `quote_photo_${Date.now()}.jpg`,
        mimeType: asset.type ?? 'image/jpeg',
        size: asset.fileSize ?? undefined,
      };
      form.addPendingDocument(pd);
    } catch {
      Alert.alert('Error', 'Could not launch camera');
    }
  };

  // ── Dependency picker modal ──────────────────────────────────────────────
  const [showDependencyPicker, setShowDependencyPicker] = useState(false);
  const { tasks: allTasks } = useTasks(form.projectId || undefined);

  const dependencyTasks = allTasks.filter((t) =>
    form.dependencyTaskIds.includes(t.id),
  );

  // ── Delay reason (shown when status === 'blocked') ───────────────────────
  const [showDelayModal, setShowDelayModal] = useState(false);
  const { delayReasonTypes } = useDelayReasonTypes();
  const { addDelayReason } = useTasks();

  const handleAddDelayReason = async (data: AddDelayReasonFormData) => {
    if (!initialAsTask?.id) return; // only in edit mode
    try {
      await addDelayReason(initialAsTask.id, data);
    } catch {
      Alert.alert('Error', 'Could not save delay reason');
    }
    setShowDelayModal(false);
  };

  // ── Work Type custom entry ──────────────────────────────────────────────
  const [showCustomWorkType, setShowCustomWorkType] = useState(false);
  const [customWorkTypeInput, setCustomWorkTypeInput] = useState('');

  // ── Accept / Reject quote ──────────────────────────────────────────────
  const { acceptQuote, rejectQuote, isLoading: isQuoteLoading } = useAcceptQuote();
  // Track local quote state so the button updates instantly without page reload
  const [localQuoteStatus, setLocalQuoteStatus] = useState<Task['quoteStatus']>(
    initialAsTask?.quoteStatus,
  );
  const [localInvoiceId, setLocalInvoiceId] = useState<string | undefined>(
    initialAsTask?.quoteInvoiceId,
  );

  const handleAcceptQuote = async () => {
    if (!initialAsTask?.id) return;
    try {
      const { invoiceId } = await acceptQuote(initialAsTask.id);
      setLocalQuoteStatus('accepted');
      setLocalInvoiceId(invoiceId);
      Alert.alert(
        'Invoice Generated',
        'The quote has been accepted and an invoice has been created.',
        [
          {
            text: 'View Invoice',
            onPress: () => onAcceptSuccess?.(invoiceId),
          },
          { text: 'OK', style: 'cancel' },
        ],
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to accept quote');
    }
  };

  const handleRejectQuote = async () => {
    if (!initialAsTask?.id) return;
    Alert.alert('Reject Quote', 'Mark this quote as rejected?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectQuote(initialAsTask.id!);
            setLocalQuoteStatus('rejected');
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Failed to reject quote');
          }
        },
      },
    ]);
  };

  // When status changes to 'blocked' and we're in edit mode, prompt for delay reason
  const handleStatusChange = (s: Task['status']) => {
    form.setStatus(s);
    if (s === 'blocked' && initialAsTask?.id) {
      setShowDelayModal(true);
    }
  };

  const priorities: Task['priority'][] = ['low', 'medium', 'high', 'urgent'];
  const statuses: Task['status'][] = ['pending', 'in_progress', 'completed', 'blocked', 'cancelled'];

  // Combine saved (already persisted) docs with any pre-fetched ones passed via props
  const displayedSavedDocs = initialSavedDocs ?? form.savedDocuments;

  // Map pending docs to Document shape for display
  const pendingAsDocs = form.pendingDocuments.map((pd) => ({
    id: `pending:${pd.uri}`,
    filename: pd.filename,
    mimeType: pd.mimeType,
    size: pd.size,
    status: 'local-only' as const,
    source: 'import' as const,
  }));

  const allDocuments = [...displayedSavedDocs, ...pendingAsDocs];

  const handleDocumentPress = (docId: string) => {
    if (docId.startsWith('pending:')) {
      const uri = docId.replace('pending:', '');
      form.removePendingDocument(uri);
    } else {
      form.removeSavedDocument(docId);
    }
  };

  const subcontractorInfo = selectedSubcontractor
    ? {
        id: selectedSubcontractor.id,
        name: selectedSubcontractor.name,
        trade: selectedSubcontractor.trade,
        phone: selectedSubcontractor.phone,
        email: selectedSubcontractor.email,
      }
    : null;

  const isSaving = form.isSubmitting || isLoading;

  return (
    <>
      <ScrollView className="flex-1 bg-background p-4">
        <View className="mb-6 gap-4">
          {/* Validation error */}
          {form.validationError ? (
            <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <Text className="text-red-700 dark:text-red-300 text-sm">{form.validationError}</Text>
            </View>
          ) : null}

          {/* Title */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Title *</Text>
            <TextInput
              testID="taskform-title"
              className="h-12 rounded-lg border border-input bg-background px-3 text-foreground"
              placeholder="Task title"
              placeholderTextColor="#9ca3af"
              value={form.title}
              onChangeText={form.setTitle}
            />
          </View>

          {/* Task Type */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Task Type</Text>
            <View className="flex-row gap-2">
              {(['standard', 'variation', 'contract_work'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  onPress={() => form.setTaskType(t)}
                  className={`flex-1 py-2 rounded-full border ${
                    form.taskType === t ? 'bg-primary border-primary' : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-xs text-center ${
                      form.taskType === t
                        ? 'text-primary-foreground font-semibold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {t === 'contract_work' ? 'Contract Work' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Project */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Project (Optional)</Text>
            <ProjectPicker value={form.projectId} onChange={(v) => form.setProjectId(v || '')} />
          </View>

          {/* Work Type */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Work Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2 pr-2">
                {PREDEFINED_WORK_TYPES.map((wt) => (
                  <TouchableOpacity
                    key={wt}
                    onPress={() => form.setWorkType(form.workType === wt ? undefined : wt)}
                    className={`px-3 py-2 rounded-full border ${
                      form.workType === wt ? 'bg-primary border-primary' : 'bg-card border-border'
                    }`}
                  >
                    <Text
                      className={`text-xs ${
                        form.workType === wt
                          ? 'text-primary-foreground font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {wt}
                    </Text>
                  </TouchableOpacity>
                ))}
                {/* Custom chip */}
                {!PREDEFINED_WORK_TYPES.includes(form.workType as any) && form.workType ? (
                  <TouchableOpacity
                    onPress={() => form.setWorkType(undefined)}
                    className="px-3 py-2 rounded-full border bg-primary border-primary"
                  >
                    <Text className="text-xs text-primary-foreground font-semibold">
                      {form.workType} ✕
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
            {showCustomWorkType ? (
              <TextInput
                className="h-10 rounded-lg border border-input bg-background px-3 text-foreground text-sm"
                placeholder="Enter custom work type"
                placeholderTextColor="#9ca3af"
                value={customWorkTypeInput}
                onChangeText={setCustomWorkTypeInput}
                onBlur={() => {
                  if (customWorkTypeInput.trim()) {
                    form.setWorkType(customWorkTypeInput.trim());
                  }
                  setCustomWorkTypeInput('');
                  setShowCustomWorkType(false);
                }}
                autoFocus
              />
            ) : (
              <TouchableOpacity onPress={() => setShowCustomWorkType(true)}>
                <Text className="text-primary text-xs">+ Custom work type</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quote Amount — shown for variation and contract_work tasks */}
          {form.taskType !== 'standard' && (
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Quote Amount (AUD)</Text>
              <TextInput
                keyboardType="decimal-pad"
                className="h-12 rounded-lg border border-input bg-background px-3 text-foreground"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                value={form.quoteAmount !== undefined ? String(form.quoteAmount) : ''}
                onChangeText={(v) => {
                  const n = parseFloat(v);
                  form.setQuoteAmount(isNaN(n) ? undefined : n);
                }}
              />
            </View>
          )}

          {/* Due Date */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Due Date</Text>
            <DatePickerInput
              label=""
              value={form.dueDate}
              onChange={form.setDueDate}
            />
          </View>

          {/* Status */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Status</Text>
            <View className="flex-row gap-2 flex-wrap">
              {statuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => handleStatusChange(s)}
                  className={`px-3 py-2 rounded-full border ${
                    form.status === s
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-xs capitalize ${
                      form.status === s
                        ? 'text-primary-foreground font-semibold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Priority</Text>
            <View className="flex-row gap-2 flex-wrap">
              {priorities.map((p) => (
                <TouchableOpacity
                  key={p}
                  onPress={() => form.setPriority(p)}
                  className={`px-3 py-2 rounded-full border ${
                    form.priority === p
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <Text
                    className={`text-xs capitalize ${
                      form.priority === p
                        ? 'text-primary-foreground font-semibold'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View className="gap-2">
            <Text className="text-sm font-medium text-foreground">Notes</Text>
            <TextInput
              className="h-32 rounded-lg border border-input bg-background px-3 py-3 text-foreground"
              placeholder="Add details..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={form.notes}
              onChangeText={form.setNotes}
            />
          </View>

          {/* Subcontractor */}
          <TaskSubcontractorSection
            subcontractor={subcontractorInfo}
            onEditSubcontractor={() => setShowSubcontractorPicker(true)}
          />

          {/* Documents — shows saved + pending together; tapping a doc removes it */}
          <View className="gap-2">
            <TaskDocumentSection
              documents={allDocuments as any}
              onAddDocument={handleAddDocument}
              onDocumentPress={(doc) => handleDocumentPress(doc.id)}
            />
            {form.pendingDocuments.length > 0 && (
              <Text className="text-xs text-muted-foreground pl-1">
                {form.pendingDocuments.length} pending — will be saved with the task
              </Text>
            )}
          </View>

          {/* Dependencies */}
          <TaskDependencySection
            dependencyTasks={dependencyTasks}
            onAddDependency={() => setShowDependencyPicker(true)}
            onRemoveDependency={(depId) => form.removeDependencyTaskId(depId)}
          />

          {/* Delay reason prompt — only visible in edit mode when status is 'blocked' */}
          {form.status === 'blocked' && form.isEditMode && (
            <Pressable
              onPress={() => setShowDelayModal(true)}
              className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-amber-800 dark:text-amber-200 text-sm font-medium">
                Record delay reason
              </Text>
              <Text className="text-amber-600 dark:text-amber-300 text-xs">Tap to add</Text>
            </Pressable>
          )}

          {/* Contract Work — Quote attachment prompt (camera) */}
          {form.taskType === 'contract_work' && (
            <View className="gap-2">
              <Text className="text-sm font-medium text-foreground">Quote Attachments</Text>
              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={handleAddQuotePhoto}
                  className="flex-1 h-11 items-center justify-center rounded-lg border border-border bg-card"
                >
                  <Text className="text-sm text-foreground">📷  Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddDocument}
                  className="flex-1 h-11 items-center justify-center rounded-lg border border-border bg-card"
                >
                  <Text className="text-sm text-foreground">📎  Upload File</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Accept / Reject Quote — edit mode only, contract_work, not yet finalised */}
          {form.isEditMode &&
            form.taskType === 'contract_work' &&
            localQuoteStatus !== 'accepted' &&
            localQuoteStatus !== 'rejected' && (
              <View className="gap-2">
                <Text className="text-sm font-medium text-foreground">Quote Decision</Text>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={handleRejectQuote}
                    disabled={isQuoteLoading}
                    className="flex-1 h-11 items-center justify-center rounded-lg border border-red-300 bg-red-50 dark:bg-red-950 dark:border-red-700"
                  >
                    <Text className="text-sm font-semibold text-red-700 dark:text-red-300">
                      {isQuoteLoading ? '...' : 'Reject Quote'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleAcceptQuote}
                    disabled={isQuoteLoading}
                    className="flex-1 h-11 items-center justify-center rounded-lg bg-green-600"
                  >
                    <Text className="text-sm font-semibold text-white">
                      {isQuoteLoading ? '...' : 'Accept → Invoice'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          {/* Invoice Generated badge — shown after acceptance */}
          {form.isEditMode && localQuoteStatus === 'accepted' && localInvoiceId && (
            <Pressable
              onPress={() => onAcceptSuccess?.(localInvoiceId)}
              className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg px-4 py-3 flex-row items-center justify-between"
            >
              <Text className="text-green-800 dark:text-green-200 text-sm font-medium">
                ✓ Invoice Generated
              </Text>
              <Text className="text-green-600 dark:text-green-300 text-xs">Tap to view</Text>
            </Pressable>
          )}

          {/* Rejected badge */}
          {form.isEditMode && localQuoteStatus === 'rejected' && (
            <View className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
              <Text className="text-red-700 dark:text-red-300 text-sm font-medium">
                ✕ Quote Rejected
              </Text>
            </View>
          )}
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-4 mb-10">
          <TouchableOpacity
            onPress={onCancel}
            disabled={isSaving}
            className="flex-1 h-12 items-center justify-center rounded-lg border border-border bg-card"
          >
            <Text className="font-semibold text-foreground">Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSaving}
            className="flex-1 h-12 items-center justify-center rounded-lg bg-primary"
          >
            <Text className="font-semibold text-primary-foreground">
              {isSaving ? 'Saving...' : 'Save Task'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Subcontractor picker modal */}
      <SubcontractorPickerModal
        visible={showSubcontractorPicker}
        selectedId={form.subcontractorId}
        onSelect={handleSubcontractorSelect}
        onClose={() => setShowSubcontractorPicker(false)}
      />

      {/* Dependency picker modal */}
      {showDependencyPicker && (
        <TaskPickerModal
          visible={showDependencyPicker}
          projectId={form.projectId}
          excludeTaskId={initialAsTask?.id ?? ''}
          existingDependencyIds={form.dependencyTaskIds}
          onSelect={(taskId) => {
            form.addDependencyTaskId(taskId);
          }}
          onClose={() => setShowDependencyPicker(false)}
        />
      )}

      {/* Delay reason modal */}
      <AddDelayReasonModal
        visible={showDelayModal}
        delayReasonTypes={delayReasonTypes}
        onSubmit={handleAddDelayReason}
        onClose={() => setShowDelayModal(false)}
      />
    </>
  );
}
