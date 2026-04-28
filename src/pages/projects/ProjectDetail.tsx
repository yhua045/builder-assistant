/**
 * ProjectDetail screen
 *
 * Displays project header metadata followed by three independently-collapsible
 * sections — Tasks, Payments, Quotes — in a SectionList with sticky section
 * headers. Each section is driven by its own focused hook.
 *
 * Navigation: pushed from ProjectsNavigator → ProjectDetail { projectId }.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  SectionListData,
  Pressable,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { cssInterop } from 'nativewind';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Calendar,
  Clock,
  Pencil,
} from 'lucide-react-native';
import { useProjectDetail } from '../../hooks/useProjectDetail';
import { useTaskTimeline } from '../../hooks/useTaskTimeline';
import { usePaymentsTimeline } from '../../features/payments';
import type { PaymentDayGroup } from '../../features/payments';
import { useQuotationsTimeline, QuotationDayGroup } from '../../hooks/useQuotationsTimeline';
import { TimelineDayGroup } from '../../components/projects/TimelineDayGroup';
import { TimelineSectionHeader } from '../../components/projects/TimelineSectionHeader';
import { TimelinePaymentCard } from '../../components/projects/TimelinePaymentCard';
import { TimelineInvoiceCard } from '../../components/projects/TimelineInvoiceCard';
import { TimelineQuotationCard } from '../../components/projects/TimelineQuotationCard';
import { Task } from '../../domain/entities/Task';
import { Payment } from '../../domain/entities/Payment';
import { Invoice } from '../../domain/entities/Invoice';
import { Quotation } from '../../domain/entities/Quotation';
import { DayGroup } from '../../hooks/useTaskTimeline';

cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MapPin, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Phone, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Pencil, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// Enable LayoutAnimation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Section item discriminated union ────────────────────────────────────────

type SectionItem =
  | { type: 'taskGroup'; group: DayGroup }
  | { type: 'paymentGroup'; group: PaymentDayGroup }
  | { type: 'quotationGroup'; group: QuotationDayGroup };

type SectionKey = 'tasks' | 'payments' | 'quotes';

interface ProjectSection extends SectionListData<SectionItem> {
  key: SectionKey;
  title: string;
  itemCount: number;
  loading: boolean;
  truncated: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDisplayDate(date: Date | undefined | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Two-column timeline row: fixed-width date label + cards on the right. */
function DayLabelColumn({ dateKey }: { dateKey: string }) {
  if (dateKey === '__nodate__') {
    return (
      <View className="w-16 pr-3 items-end" style={{ paddingTop: 10 }}>
        <Text className="text-sm font-bold text-foreground leading-tight">—</Text>
      </View>
    );
  }
  const d = new Date(`${dateKey}T00:00:00Z`);
  return (
    <View className="w-16 pr-3 items-end" style={{ paddingTop: 10 }}>
      <Text className="text-sm font-bold text-foreground leading-tight">
        {d.getUTCDate()}
      </Text>
      <Text className="text-xs text-muted-foreground uppercase leading-tight">
        {d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' })}
      </Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { projectId } = route.params as { projectId: string };

  const { project, loading: projectLoading, error: projectError } = useProjectDetail(projectId);
  const {
    dayGroups,
    loading: tasksLoading,
    markComplete,
    invalidate: invalidateTasks,
  } = useTaskTimeline(projectId);
  const {
    paymentDayGroups,
    loading: paymentsLoading,
    truncated: paymentsTruncated,
    invalidate: invalidatePayments,
  } = usePaymentsTimeline(projectId);
  const {
    quotationDayGroups,
    loading: quotationsLoading,
    truncated: quotationsTruncated,
    invalidate: invalidateQuotations,
  } = useQuotationsTimeline(projectId);

  // ── Section collapse state ───────────────────────────────────────────────
  const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
    tasks: false,    // Tasks: expanded by default
    payments: true,  // Payments: collapsed by default
    quotes: true,    // Quotes: collapsed by default
  });

  const handleToggleSection = useCallback((key: SectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Day-group expand/collapse for the tasks section ──────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const groupsInitialised = useRef(false);

  useEffect(() => {
    if (!dayGroups.length || groupsInitialised.current) return;
    const todayStr = (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    })();
    const init: Record<string, boolean> = {};
    for (const g of dayGroups) {
      init[g.date] = g.date === '__nodate__' || g.date >= todayStr;
    }
    setExpandedGroups(init);
    groupsInitialised.current = true;
  }, [dayGroups]);

  const handleGroupToggle = useCallback((date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups((prev) => ({ ...prev, [date]: !prev[date] }));
  }, []);

  // ── Invalidate all timeline sections on screen focus ────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      invalidateTasks();
      invalidatePayments();
      invalidateQuotations();
    });
    return unsubscribe;
  }, [navigation, invalidateTasks, invalidatePayments, invalidateQuotations]);

  // ── Task quick-action handlers ───────────────────────────────────────────
  const handleOpenTask = useCallback(
    (task: Task) => navigation.navigate('TaskDetails', { taskId: task.id }),
    [navigation],
  );

  const handleAddProgressLog = useCallback(
    (task: Task) => navigation.navigate('TaskDetails', { taskId: task.id, openProgressLog: true }),
    [navigation],
  );

  const handleAttachDocument = useCallback(
    (task: Task) => navigation.navigate('TaskDetails', { taskId: task.id, openDocument: true }),
    [navigation],
  );

  const handleMarkComplete = useCallback(
    async (task: Task) => {
      Alert.alert(
        'Mark Complete',
        `Mark "${task.title}" as completed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            style: 'default',
            onPress: async () => {
              try {
                await markComplete(task);
              } catch {
                Alert.alert('Error', 'Could not update task. Please try again.');
              }
            },
          },
        ],
      );
    },
    [markComplete],
  );

  // ── Payment quick-action handlers ────────────────────────────────────────
  const handleEditPayment = useCallback(
    (payment: Payment) => navigation.navigate('PaymentDetail', { paymentId: payment.id }),
    [navigation],
  );

  const handleReviewPayment = useCallback(
    (payment: Payment) => {
      (navigation as any).navigate('PaymentDetails', { paymentId: payment.id });
    },
    [navigation],
  );

  // ── Invoice quick-action handlers ────────────────────────────────────────
  const handleEditInvoice = useCallback(
    (invoice: Invoice) => navigation.navigate('InvoiceDetail', { invoiceId: invoice.id }),
    [navigation],
  );

  const handleReviewInvoicePayment = useCallback(
    (invoice: Invoice) => {
      (navigation as any).navigate('PaymentDetails', { invoiceId: invoice.id });
    },
    [navigation],
  );

  // ── Quotation action handler ─────────────────────────────────────────────
  const handleViewQuotationTask = useCallback(
    (quotation: Quotation) => {
      if (quotation.taskId) {
        navigation.navigate('TaskDetails', { taskId: quotation.taskId });
      }
    },
    [navigation],
  );

  // ── SectionList data ─────────────────────────────────────────────────────
  const totalTaskItems = dayGroups.reduce((s, g) => s + g.tasks.length, 0);
  const totalPaymentItems = paymentDayGroups.reduce((s, g) => s + g.items.length, 0);
  const totalQuotationItems = quotationDayGroups.reduce((s, g) => s + g.quotations.length, 0);

  const sections: ProjectSection[] = [
    {
      key: 'tasks',
      title: 'Tasks',
      itemCount: totalTaskItems,
      loading: tasksLoading,
      truncated: false,
      data: collapsed.tasks
        ? []
        : dayGroups.map((g) => ({ type: 'taskGroup' as const, group: g })),
    },
    {
      key: 'payments',
      title: 'Payments',
      itemCount: totalPaymentItems,
      loading: paymentsLoading,
      truncated: paymentsTruncated,
      data: collapsed.payments
        ? []
        : paymentDayGroups.map((g) => ({ type: 'paymentGroup' as const, group: g })),
    },
    {
      key: 'quotes',
      title: 'Quotes',
      itemCount: totalQuotationItems,
      loading: quotationsLoading,
      truncated: quotationsTruncated,
      data: collapsed.quotes
        ? []
        : quotationDayGroups.map((g) => ({ type: 'quotationGroup' as const, group: g })),
    },
  ];

  // ── Header / footer / item renderers ────────────────────────────────────
  const headerLoading = projectLoading;

  const statusLabel = project?.status
    ? project.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';
  const isActive =
    project?.status === 'in_progress' || (project?.status as string) === 'active';

  const renderListHeader = () => (
    <View>
      {headerLoading && (
        <View className="p-8 items-center">
          <ActivityIndicator testID="project-detail-loading" size="large" />
        </View>
      )}
      {!headerLoading && projectError && (
        <View className="p-6">
          <Text testID="project-detail-error" className="text-destructive text-center">
            {projectError}
          </Text>
        </View>
      )}
      {!headerLoading && !projectError && (
        <View className="p-6 bg-card border-b border-border">
          <View className="flex-row items-start justify-between mb-4">
            <View className="flex-1 mr-4">
              <Text testID="project-detail-name" className="text-2xl font-bold text-foreground mb-1">
                {project?.name ?? '—'}
              </Text>
              {project?.location ? (
                <View className="flex-row items-center mt-1 gap-1.5">
                  <MapPin className="text-muted-foreground" size={14} />
                  <Text className="text-muted-foreground text-sm flex-1" numberOfLines={2}>
                    {project.location}
                  </Text>
                </View>
              ) : null}
            </View>
            <View className="flex-col items-end gap-2">
              <View className={`px-3 py-1.5 rounded-full ${isActive ? 'bg-chart-2/10' : 'bg-chart-4/10'}`}>
                <Text
                  className={`text-xs font-semibold uppercase tracking-wide ${isActive ? 'text-chart-2' : 'text-chart-4'}`}
                >
                  {statusLabel}
                </Text>
              </View>
              <Pressable
                testID="project-edit-button"
                onPress={() => navigation.navigate('ProjectEdit' as any, { projectId })}
                className="p-2 -mr-2"
              >
                <Pencil className="text-muted-foreground" size={20} />
              </Pressable>
            </View>
          </View>

          <View className="flex-row gap-4 mt-2">
            <View className="flex-1 bg-muted/50 rounded-xl p-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Calendar className="text-muted-foreground" size={13} />
                <Text className="text-xs text-muted-foreground uppercase">Start</Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {formatDisplayDate(project?.startDate)}
              </Text>
            </View>
            <View className="flex-1 bg-muted/50 rounded-xl p-3">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Clock className="text-muted-foreground" size={13} />
                <Text className="text-xs text-muted-foreground uppercase">Est. End</Text>
              </View>
              <Text className="text-sm font-semibold text-foreground">
                {formatDisplayDate(project?.expectedEndDate)}
              </Text>
            </View>
          </View>

          {project?.owner && (
            <View className="flex-row items-center mt-4 pt-4 border-t border-border/50 gap-2">
              <Phone className="text-muted-foreground" size={15} />
              <Text className="text-foreground font-medium text-sm">
                {project.owner.name}
                {project.owner.phone ? `  ·  ${project.owner.phone}` : ''}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  const renderSectionHeader = ({ section }: { section: ProjectSection }) => (
    <TimelineSectionHeader
      title={section.title}
      itemCount={section.itemCount}
      loading={section.loading}
      collapsed={collapsed[section.key]}
      onToggle={() => handleToggleSection(section.key)}
      testID={`section-header-${section.key}`}
    />
  );

  const renderItem = ({ item, section }: { item: SectionItem; section: ProjectSection }) => {
    if (item.type === 'taskGroup') {
      const group = item.group;
      const idx = (section.data as SectionItem[]).indexOf(item);
      return (
        <View className="px-6">
          <TimelineDayGroup
            group={group}
            isLast={idx === section.data.length - 1}
            expanded={expandedGroups[group.date] !== false}
            onToggle={() => handleGroupToggle(group.date)}
            onOpenTask={handleOpenTask}
            onAddProgressLog={handleAddProgressLog}
            onAttachDocument={handleAttachDocument}
            onMarkComplete={handleMarkComplete}
            testID={`day-group-${group.date}`}
          />
        </View>
      );
    }

    if (item.type === 'paymentGroup') {
      const group = item.group;
      return (
        <View className="flex-row px-6 pb-2">
          <DayLabelColumn dateKey={group.date} />
          <View className="flex-1">
            <View className="flex-row items-center gap-2 pb-2">
              <View className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-background -ml-[5px]" />
              <Text className="text-xs text-muted-foreground font-medium">{group.label}</Text>
              <View className="ml-1 px-1.5 py-0.5 bg-muted rounded-full">
                <Text className="text-[10px] text-muted-foreground font-semibold">
                  {group.items.length}
                </Text>
              </View>
            </View>
            {group.items.map((feedItem) =>
              feedItem.kind === 'payment' ? (
                <TimelinePaymentCard
                  key={feedItem.data.id}
                  payment={feedItem.data}
                  onEdit={() => handleEditPayment(feedItem.data)}
                  onReviewPayment={feedItem.data.status !== 'settled' ? () => handleReviewPayment(feedItem.data) : undefined}
                  testID={`payment-card-${feedItem.data.id}`}
                />
              ) : (
                <TimelineInvoiceCard
                  key={feedItem.data.id}
                  invoice={feedItem.data}
                  onEdit={() => handleEditInvoice(feedItem.data)}
                  onReviewPayment={feedItem.data.paymentStatus !== 'paid' ? () => handleReviewInvoicePayment(feedItem.data) : undefined}
                  testID={`invoice-card-${feedItem.data.id}`}
                />
              ),
            )}
          </View>
        </View>
      );
    }

    if (item.type === 'quotationGroup') {
      const group = item.group;
      return (
        <View className="flex-row px-6 pb-2">
          <DayLabelColumn dateKey={group.date} />
          <View className="flex-1">
            <View className="flex-row items-center gap-2 pb-2">
              <View className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-background -ml-[5px]" />
              <Text className="text-xs text-muted-foreground font-medium">{group.label}</Text>
              <View className="ml-1 px-1.5 py-0.5 bg-muted rounded-full">
                <Text className="text-[10px] text-muted-foreground font-semibold">
                  {group.quotations.length}
                </Text>
              </View>
            </View>
            {group.quotations.map((quotation) => (
              <TimelineQuotationCard
                key={quotation.id}
                quotation={quotation}
                onViewTask={handleViewQuotationTask}
                testID={`quotation-card-${quotation.id}`}
              />
            ))}
          </View>
        </View>
      );
    }

    return null;
  };

  const renderSectionFooter = ({ section }: { section: ProjectSection }) => {
    if (section.truncated) {
      return (
        <View className="px-6 pb-4">
          <Text className="text-xs text-muted-foreground text-center">
            Showing first 500 items in {section.title.toLowerCase()}.
          </Text>
        </View>
      );
    }
    // Empty-state message when section is expanded but has no items
    if (!collapsed[section.key] && section.data.length === 0 && !section.loading) {
      const emptyMessages: Record<SectionKey, string> = {
        tasks: 'No tasks scheduled for this project.',
        payments: 'No payments or invoices for this project.',
        quotes: 'No quotations linked to this project.',
      };
      return (
        <View className="px-6 py-6">
          <Text
            className="text-muted-foreground text-center text-sm"
            testID={`${section.key}-empty`}
          >
            {emptyMessages[section.key]}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ArrowLeft className="text-foreground" size={24} />
        </Pressable>
        <Text
          className="text-lg font-bold text-foreground flex-1 text-center"
          numberOfLines={1}
          testID="project-detail-heading"
        >
          {headerLoading ? 'Loading…' : (project?.name ?? '—')}
        </Text>
        <View className="w-8" />
      </View>

      <SectionList<SectionItem, ProjectSection>
        sections={sections}
        keyExtractor={(item, index) => {
          if (item.type === 'taskGroup') return `task-${item.group.date}`;
          if (item.type === 'paymentGroup') return `payment-${item.group.date}`;
          return `quote-${item.group.date}-${index}`;
        }}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        renderSectionFooter={renderSectionFooter}
        ListHeaderComponent={renderListHeader}
        stickySectionHeadersEnabled
        contentContainerStyle={{ paddingBottom: 128 }}
      />
    </SafeAreaView>
  );
}
