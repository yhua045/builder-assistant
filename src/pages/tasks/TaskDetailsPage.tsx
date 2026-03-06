import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Pressable, Image } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTasks, TaskDetail } from '../../hooks/useTasks';
import { useDelayReasonTypes } from '../../hooks/useDelayReasonTypes';
import { useConfirm } from '../../hooks/useConfirm';
import { Task } from '../../domain/entities/Task';
import { DelayReason } from '../../domain/entities/DelayReason';
import { Document } from '../../domain/entities/Document';
import { Contact } from '../../domain/entities/Contact';
import { DocumentRepository } from '../../domain/repositories/DocumentRepository';
import { ContactRepository } from '../../domain/repositories/ContactRepository';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { AddTaskDocumentUseCase } from '../../application/usecases/document/AddTaskDocumentUseCase';
import { container } from 'tsyringe';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskStatusBadge } from '../../components/tasks/TaskStatusBadge';
import { TaskDocumentSection } from '../../components/tasks/TaskDocumentSection';
import { TaskDependencySection } from '../../components/tasks/TaskDependencySection';
import { TaskSubcontractorSection } from '../../components/tasks/TaskSubcontractorSection';
import { TaskDelaySection } from '../../components/tasks/TaskDelaySection';
import { TaskProgressSection } from '../../components/tasks/TaskProgressSection';
import { AddDelayReasonModal, AddDelayReasonFormData } from '../../components/tasks/AddDelayReasonModal';
import { AddProgressLogModal, AddProgressLogFormData } from '../../components/tasks/AddProgressLogModal';
import { ProgressLog } from '../../domain/entities/ProgressLog';
import { TaskPickerModal } from './TaskPickerModal';
import { Edit, Trash2, Calendar, Clock, ArrowLeft, FileText, CheckCircle } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Edit, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(FileText, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TaskDetailsPage() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;
  const {
    getTask,
    deleteTask,
    getTaskDetail,
    addDependency,
    removeDependency,
    addDelayReason,
    removeDelayReason,
    resolveDelayReason,
    addProgressLog,
    updateProgressLog,
    deleteProgressLog,
  } = useTasks();
  const { delayReasonTypes } = useDelayReasonTypes();
  const { confirm } = useConfirm();

  const [task, setTask] = useState<Task | null>(null);
  const [taskDetail, setTaskDetail] = useState<TaskDetail | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [subcontractor, setSubcontractor] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDelayModal, setShowDelayModal] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [showAddLogModal, setShowAddLogModal] = useState(false);
  const [editingLog, setEditingLog] = useState<ProgressLog | null>(null);

  const documentRepository = useMemo(() => {
    try {
      return container.resolve<DocumentRepository>('DocumentRepository');
    } catch {
      return null;
    }
  }, []);

  const contactRepository = useMemo(() => {
    try {
      return container.resolve<ContactRepository>('ContactRepository');
    } catch {
      return null;
    }
  }, []);

  const filePickerAdapter = useMemo(() => {
    try {
      return container.resolve<IFilePickerAdapter>('IFilePickerAdapter');
    } catch {
      return null;
    }
  }, []);

  const fileSystemAdapter = useMemo(() => {
    try {
      return container.resolve<IFileSystemAdapter>('IFileSystemAdapter');
    } catch {
      return null;
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, detail] = await Promise.all([
        getTask(taskId),
        getTaskDetail(taskId),
      ]);
      setTask(t);
      setTaskDetail(detail);

      // Load documents linked to this task
      if (documentRepository) {
        try {
          const docs = await documentRepository.findByTaskId(taskId);
          setDocuments(docs);
        } catch {
          setDocuments([]);
        }
      }

      // Resolve subcontractor contact details
      if (t?.subcontractorId && contactRepository) {
        try {
          const contact = await contactRepository.findById(t.subcontractorId);
          setSubcontractor(contact);
        } catch {
          setSubcontractor(null);
        }
      } else {
        setSubcontractor(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [taskId, getTask, getTaskDetail, documentRepository, contactRepository]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    // Load initial data
    loadData();
    return unsubscribe;
  }, [navigation, loadData]);

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete Task',
      message: 'Are you sure you want to delete this task?',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteTask(taskId);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Failed to delete task');
    }
  };

  const handleAddDelayReason = async (data: AddDelayReasonFormData) => {
    try {
      await addDelayReason(taskId, data);
      setShowDelayModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add delay reason');
    }
  };

  const handleRemoveDelayReason = async (delayReasonId: string) => {
    const confirmed = await confirm({
      title: 'Remove Delay',
      message: 'Remove this delay reason entry?',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await removeDelayReason(delayReasonId);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to remove delay reason');
    }
  };

  const handleResolveDelayReason = async (delayReasonId: string) => {
    try {
      await resolveDelayReason(delayReasonId);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to resolve delay reason');
    }
  };

  const handleRemoveDependency = async (dependsOnTaskId: string) => {
    const confirmed = await confirm({
      title: 'Remove Dependency',
      message: 'Remove this dependency?',
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await removeDependency(taskId, dependsOnTaskId);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to remove dependency');
    }
  };

  const handleAddDependency = async (selectedTaskId: string) => {
    try {
      await addDependency(taskId, selectedTaskId);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add dependency');
    }
  };

  const handleAddProgressLog = async (data: AddProgressLogFormData) => {
    try {
      await addProgressLog(taskId, data);
      setShowAddLogModal(false);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add progress log');
    }
  };

  const handleUpdateProgressLog = async (data: AddProgressLogFormData) => {
    if (!editingLog) return;
    try {
      await updateProgressLog(editingLog.id, data);
      setEditingLog(null);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update progress log');
    }
  };

  const handleDeleteProgressLog = async (logId: string) => {
    try {
      await deleteProgressLog(logId);
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to delete progress log');
    }
  };

  const handleAddDocument = async () => {
    if (!filePickerAdapter || !fileSystemAdapter || !documentRepository) return;
    try {
      const result = await filePickerAdapter.pickDocument();
      if (result.cancelled || !result.uri || !result.name) return;
      setUploadingDocument(true);
      const uc = new AddTaskDocumentUseCase(documentRepository, fileSystemAdapter);
      await uc.execute({
        taskId,
        projectId: task?.projectId,
        sourceUri: result.uri,
        filename: result.name,
        mimeType: result.type,
        size: result.size,
      });
      await loadData();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to add document');
    } finally {
      setUploadingDocument(false);
    }
  };

  // Map resolved Contact to SubcontractorInfo shape expected by the section component
  const subcontractorInfo = subcontractor
    ? {
        id: subcontractor.id,
        name: subcontractor.name,
        trade: subcontractor.trade,
        phone: subcontractor.phone,
        email: subcontractor.email,
      }
    : null;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Task not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ArrowLeft className="text-foreground" size={24} />
        </Pressable>
        <Text className="text-lg font-semibold text-foreground">Task Details</Text>
        <View className="flex-row items-center gap-1 -mr-2">
            <Pressable onPress={handleDelete} className="p-2">
              <Trash2 className="text-destructive" size={22} />
            </Pressable>
            <Pressable onPress={() => navigation.navigate('EditTask', { taskId })} className="p-2">
              <Edit className="text-primary" size={22} />
            </Pressable>
        </View>
      </View>
      
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} className="flex-1">
        {/* Task Header */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-start gap-4 mb-4">
            <View className="w-16 h-16 rounded-xl bg-muted items-center justify-center overflow-hidden">
               {/* Use placeholder since vendor image wasn't in original entity */}
               <CheckCircle size={32} className="text-muted-foreground opacity-50" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-foreground mb-1">
                {task.title}
              </Text>
              <Text className="text-sm text-muted-foreground mb-2">
                {subcontractor?.name || 'No vendor assigned'}
              </Text>
              <View className="flex-row items-center gap-2">
                <TaskStatusBadge status={task.status} />
                <Text className="text-sm text-muted-foreground">
                  {task.projectId ? `Project: ${task.projectId}` : 'No project'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Dates Section */}
        <View className="px-6 mb-6">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Schedule
          </Text>
          <View className="flex-row gap-4">
            {/* Scheduled Start Date */}
            <View className="flex-1 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar className="text-primary" size={18} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Start Date
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">
                {task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString() : 'Not set'}
              </Text>
            </View>

            {/* Due Date */}
            <View className="flex-1 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Clock className="text-red-500" size={18} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Due Date
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'Not set'}
              </Text>
            </View>
          </View>
        </View>
        
        {/* Notes Section */}
        {task.notes && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Notes
            </Text>
            <View className="bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-start gap-3">
                <FileText className="text-muted-foreground mt-1" size={20} />
                <Text className="text-foreground text-sm leading-relaxed flex-1">
                  {task.notes}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* === Task Detail Extension Sections === */}
        <TaskSubcontractorSection
          subcontractor={subcontractorInfo}
          onEditSubcontractor={() => {
            // Need task edit navigation here or it was handled via edit page... 
            // the previous code didn't actually implement onEditSubcontractor here, so omit or handle navigation
          }}
        />

        <TaskDependencySection
          dependencyTasks={taskDetail?.dependencyTasks ?? []}
          onAddDependency={() => setShowTaskPicker(true)}
          onRemoveDependency={handleRemoveDependency}
        />

        <TaskProgressSection
          progressLogs={taskDetail?.progressLogs ?? []}
          onAddLog={() => setShowAddLogModal(true)}
          onEditLog={(log) => setEditingLog(log)}
          onDeleteLog={handleDeleteProgressLog}
        />

        <TaskDocumentSection
          documents={documents}
          onAddDocument={handleAddDocument}
          uploading={uploadingDocument}
        />

      </ScrollView>

      {/* Bottom Action Button */}
      <View className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t border-border">
        <Pressable 
          // For now just navigate back or execute complete logic directly if implemented.
          onPress={() => {}} 
          className="bg-primary py-4 rounded-2xl items-center flex-row justify-center gap-2"
        >
          <CheckCircle className="text-primary-foreground" size={20} />
          <Text className="text-primary-foreground font-bold text-base">
            Mark as Completed
          </Text>
        </Pressable>
      </View>

      <AddDelayReasonModal
        visible={showDelayModal}
        delayReasonTypes={delayReasonTypes}
        onSubmit={handleAddDelayReason}
        onClose={() => setShowDelayModal(false)}
      />

      {/* Progress Log — create */}
      <AddProgressLogModal
        visible={showAddLogModal}
        onClose={() => setShowAddLogModal(false)}
        onSubmit={handleAddProgressLog}
      />

      {/* Progress Log — edit */}
      <AddProgressLogModal
        visible={editingLog !== null}
        initialValues={
          editingLog
            ? {
                id: editingLog.id,
                logType: editingLog.logType,
                notes: editingLog.notes,
                photos: editingLog.photos,
                actor: editingLog.actor,
              }
            : undefined
        }
        onClose={() => setEditingLog(null)}
        onSubmit={handleUpdateProgressLog}
      />

      {task?.projectId && (
        <TaskPickerModal
          visible={showTaskPicker}
          projectId={task.projectId}
          excludeTaskId={taskId}
          existingDependencyIds={(taskDetail?.dependencyTasks ?? []).map((t) => t.id)}
          onSelect={handleAddDependency}
          onClose={() => setShowTaskPicker(false)}
        />
      )}
    </SafeAreaView>
  );
}
