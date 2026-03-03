import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
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
import { AddDelayReasonModal, AddDelayReasonFormData } from '../../components/tasks/AddDelayReasonModal';
import { TaskPickerModal } from './TaskPickerModal';
import { Edit, Trash2, Calendar, Clock, MapPin, ArrowLeft } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Edit, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });

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
      <View className="flex-row justify-between items-center px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <ArrowLeft size={24} className="text-foreground" />
        </TouchableOpacity>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => navigation.navigate('EditTask', { taskId })} className="p-2">
            <Edit size={20} className="text-foreground" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} className="p-2">
            <Trash2 size={20} className="text-destructive" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView className="flex-1 p-6">
        <View className="flex-row justify-between items-start mb-4">
          <Text className="text-2xl font-bold text-foreground flex-1 mr-4">{task.title}</Text>
          <TaskStatusBadge status={task.status} />
        </View>

        <View className="gap-4 mb-6">
          {task.dueDate && (
             <View className="flex-row items-center gap-2">
               <Calendar size={18} className="text-muted-foreground" />
               <Text className="text-foreground">Due: {new Date(task.dueDate).toLocaleDateString()}</Text>
             </View>
          )}
          {task.scheduledAt && (
             <View className="flex-row items-center gap-2">
               <Clock size={18} className="text-muted-foreground" />
               <Text className="text-foreground">Scheduled: {new Date(task.scheduledAt).toLocaleString()}</Text>
             </View>
          )}
          {task.projectId && (
             <View className="flex-row items-center gap-2">
               <MapPin size={18} className="text-muted-foreground" />
               <Text className="text-foreground">Project ID: {task.projectId}</Text>
             </View>
          )}
        </View>
        
        {task.notes && (
          <View className="bg-card p-4 rounded-lg border border-border mb-4">
            <Text className="text-sm font-semibold text-muted-foreground mb-2">NOTES</Text>
            <Text className="text-foreground leading-6">{task.notes}</Text>
          </View>
        )}

        {/* === Task Detail Extension Sections === */}
        <View className="gap-4 mb-6">
          <TaskSubcontractorSection
            subcontractor={subcontractorInfo}
          />

          <TaskDocumentSection
            documents={documents}
            onAddDocument={handleAddDocument}
            uploading={uploadingDocument}
          />

          <TaskDependencySection
            dependencyTasks={taskDetail?.dependencyTasks ?? []}
            onAddDependency={() => setShowTaskPicker(true)}
            onRemoveDependency={handleRemoveDependency}
          />

          <TaskDelaySection
            delayReasons={taskDetail?.delayReasons ?? []}
            onAddDelay={() => setShowDelayModal(true)}
            onRemoveDelay={handleRemoveDelayReason}
          />
        </View>
      </ScrollView>

      <AddDelayReasonModal
        visible={showDelayModal}
        delayReasonTypes={delayReasonTypes}
        onSubmit={handleAddDelayReason}
        onClose={() => setShowDelayModal(false)}
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
