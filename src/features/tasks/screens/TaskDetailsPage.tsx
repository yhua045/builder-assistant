import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskStatusBadge } from '../components/TaskStatusBadge';
import { StatusPriorityRow } from '../components/StatusPriorityRow';
import { TaskDocumentSection } from '../components/TaskDocumentSection';
import { TaskDependencySection } from '../components/TaskDependencySection';
import { TaskSubcontractorSection } from '../components/TaskSubcontractorSection';
import { TaskProgressSection } from '../components/TaskProgressSection';
import { TaskQuotationSection } from '../components/TaskQuotationSection';
import { AddDelayReasonModal } from '../components/AddDelayReasonModal';
import { AddProgressLogModal } from '../components/AddProgressLogModal';
import { TaskPickerModal } from './TaskPickerModal';
import { SubcontractorPickerModal } from '../components/SubcontractorPickerModal';
import { Edit, Trash2, Calendar, Clock, ArrowLeft, FileText, CheckCircle } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { useTaskDetails } from '../hooks/useTaskDetails';

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
  const { taskId, openProgressLog, openDocument } = route.params as {
    taskId: string;
    openProgressLog?: boolean;
    openDocument?: boolean;
  };

  const vm = useTaskDetails(taskId, { progressLog: openProgressLog, document: openDocument });

  if (vm.loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!vm.task) {
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
            <Pressable onPress={vm.handleDelete} className="p-2">
              <Trash2 className="text-destructive" size={22} />
            </Pressable>
            {!vm.isCompleted && (
              <Pressable onPress={() => navigation.navigate('EditTask', { taskId })} className="p-2">
                <Edit className="text-primary" size={22} />
              </Pressable>
            )}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: vm.isCompleted ? 24 : 120 }} className="flex-1">
        {/* Task Header */}
        <View className="px-6 pt-6 pb-4">
          <View className="flex-row items-start gap-4 mb-4">
            <View className="w-16 h-16 rounded-xl bg-muted items-center justify-center overflow-hidden">
               <CheckCircle size={32} className="text-muted-foreground opacity-50" />
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-foreground mb-1">
                {vm.task.title}
              </Text>
              <Text className="text-sm text-muted-foreground mb-2">
                {vm.subcontractorInfo?.name || 'No vendor assigned'}
              </Text>
              <View className="flex-row items-center gap-2">
                <TaskStatusBadge status={vm.task.status} />
                <Text className="text-sm text-muted-foreground">
                  {vm.task.projectId ? `Project: ${vm.task.projectId}` : 'No project'}
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
            <View className="flex-1 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar className="text-primary" size={18} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Start Date
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">
                {vm.task.startDate ? new Date(vm.task.startDate).toLocaleDateString() : 'Not set'}
              </Text>
            </View>

            <View className="flex-1 bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-center gap-2 mb-2">
                <Clock className="text-red-500" size={18} />
                <Text className="text-xs font-semibold text-muted-foreground uppercase">
                  Due Date
                </Text>
              </View>
              <Text className="text-base font-bold text-foreground">
                {vm.task.dueDate ? new Date(vm.task.dueDate).toLocaleDateString() : 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        {/* Notes Section */}
        {vm.task.notes && (
          <View className="px-6 mb-6">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Notes
            </Text>
            <View className="bg-card border border-border rounded-2xl p-4">
              <View className="flex-row items-start gap-3">
                <FileText className="text-muted-foreground mt-1" size={20} />
                <Text className="text-foreground text-sm leading-relaxed flex-1">
                  {vm.task.notes}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Quotation / Invoice */}
        {(vm.linkedInvoice || vm.hasQuotationRecord) && (
          <TaskQuotationSection task={vm.task} invoice={vm.linkedInvoice} />
        )}

        {/* Progress Logs */}
        <TaskProgressSection
          progressLogs={vm.taskDetail?.progressLogs ?? []}
          onAddLog={vm.isCompleted ? undefined : vm.openAddLogModal}
          onEditLog={vm.isCompleted ? undefined : (log) => vm.setEditingLog(log)}
          onDeleteLog={vm.isCompleted ? undefined : vm.handleDeleteProgressLog}
        />

        {/* Task Detail Extension Sections */}
        <TaskSubcontractorSection
          subcontractor={vm.subcontractorInfo}
          onEditSubcontractor={vm.isCompleted ? undefined : vm.openSubcontractorPicker}
        />

        <TaskDependencySection
          dependencyTasks={vm.taskDetail?.dependencyTasks ?? []}
          onAddDependency={vm.isCompleted ? undefined : vm.openTaskPicker}
          onRemoveDependency={vm.isCompleted ? undefined : vm.handleRemoveDependency}
        />

        <TaskDocumentSection
          documents={vm.documents}
          onAddDocument={vm.isCompleted ? undefined : vm.handleAddDocument}
          uploading={vm.uploadingDocument}
        />

        {/* Status & Priority quick-edit */}
        <StatusPriorityRow
          status={vm.task.status}
          priority={vm.task.priority ?? 'medium'}
          onStatusChange={vm.handleStatusChange}
          onPriorityChange={vm.handlePriorityChange}
          disablePriority={vm.isCompleted}
        />

        {/* Next-In-Line */}
        {vm.nextInLine.length > 0 && (
          <View className="px-6 pt-4 pb-2">
            <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Next in Line
            </Text>
            <View className="bg-card border border-border rounded-2xl overflow-hidden">
              {vm.nextInLine.map((t, index) => (
                <View
                  key={t.id}
                  testID={`next-in-line-item-${t.id}`}
                  className={`flex-row items-center px-4 py-3 gap-3 ${
                    index < vm.nextInLine.length - 1 ? 'border-b border-border' : ''
                  }`}
                >
                  <Text className="text-base">
                    {t.status === 'completed' ? '✅' : t.status === 'blocked' ? '🔴' : '⏳'}
                  </Text>
                  <Text className="flex-1 text-sm text-foreground" numberOfLines={1}>
                    {t.title}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

      </ScrollView>

      {/* Bottom Action Button */}
      {!vm.isCompleted && (
        <View className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t border-border">
          <Pressable
            testID="mark-as-complete-button"
            onPress={vm.handleComplete}
            disabled={vm.completing}
            className={`bg-primary py-4 rounded-2xl items-center flex-row justify-center gap-2${
              vm.completing ? ' opacity-50' : ''
            }`}
          >
            {vm.completing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <CheckCircle className="text-primary-foreground" size={20} />
            )}
            <Text className="text-primary-foreground font-bold text-base">
              Mark as Completed
            </Text>
          </Pressable>
        </View>
      )}

      <AddDelayReasonModal
        visible={vm.showDelayModal}
        delayReasonTypes={vm.delayReasonTypes}
        onSubmit={vm.handleAddDelayReason}
        onClose={vm.closeDelayModal}
      />

      {/* Progress Log — create */}
      <AddProgressLogModal
        visible={vm.showAddLogModal}
        onClose={vm.closeAddLogModal}
        onSubmit={vm.handleAddProgressLog}
      />

      {/* Progress Log — edit */}
      <AddProgressLogModal
        visible={vm.editingLog !== null}
        initialValues={
          vm.editingLog
            ? {
                id: vm.editingLog.id,
                logType: vm.editingLog.logType,
                notes: vm.editingLog.notes,
                photos: vm.editingLog.photos,
                actor: vm.editingLog.actor,
              }
            : undefined
        }
        onClose={() => vm.setEditingLog(null)}
        onSubmit={vm.handleUpdateProgressLog}
      />

      {vm.task?.projectId && (
        <TaskPickerModal
          visible={vm.showTaskPicker}
          projectId={vm.task.projectId}
          excludeTaskId={taskId}
          existingDependencyIds={(vm.taskDetail?.dependencyTasks ?? []).map((t) => t.id)}
          onSelect={vm.handleAddDependency}
          onClose={vm.closeTaskPicker}
        />
      )}

      <SubcontractorPickerModal
        visible={vm.showSubcontractorPicker}
        selectedId={vm.task.subcontractorId}
        onSelect={vm.handleSubcontractorSelect}
        onClose={vm.closeSubcontractorPicker}
      />
    </SafeAreaView>
  );
}
