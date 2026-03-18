/**
 * ProjectDetail screen
 *
 * Displays project header metadata, a vertical day-grouped Task Timeline,
 * and a Quotes section (pending-only by default with "Show all" toggle).
 *
 * Scroll position is tracked to drive a StickyOverlay that pins the active
 * section title at the top of the scroll area.
 *
 * Navigation: pushed from ProjectsNavigator → ProjectDetail { projectId }.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  LayoutAnimation,
  Platform,
  UIManager,
  NativeSyntheticEvent,
  NativeScrollEvent,
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
} from 'lucide-react-native';
import { useProjectTimeline } from '../../hooks/useProjectTimeline';
import { useQuotationTimeline } from '../../hooks/useQuotationTimeline';
import { TimelineDayGroup } from '../../components/projects/TimelineDayGroup';
import { TimelineSectionHeader } from '../../components/projects/TimelineSectionHeader';
import { TimelineList, DayGroupGeneric } from '../../components/projects/TimelineList';
import { QuotationCard } from '../../components/projects/QuotationCard';
import { StickyOverlay, SectionBound } from '../../components/projects/StickyOverlay';
import { Task } from '../../domain/entities/Task';
import { Quotation } from '../../domain/entities/Quotation';

cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MapPin, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Phone, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// Enable LayoutAnimation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
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

function formatCurrencyCompact(amount: number, currency = 'AUD'): string {
  return `${currency} ${amount.toLocaleString('en-AU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { projectId } = route.params as { projectId: string };

  const { project, dayGroups, loading, error, markComplete, invalidateTimeline } =
    useProjectTimeline(projectId);

  const {
    quoteDayGroups,
    pendingCount,
    totalCount: quoteTotalCount,
    visibleTotal,
    statusFilter,
    setStatusFilter,
    loading: quotesLoading,
    acceptQuotation,
    rejectQuotation,
    invalidateQuotes,
  } = useQuotationTimeline(projectId);

  // ── Scroll tracking for StickyOverlay ────────────────────────────────────
  const scrollRef = useRef<ScrollView>(null);
  const [scrollY, setScrollY] = useState(0);
  const sectionBoundsRef = useRef<SectionBound[]>([]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setScrollY(e.nativeEvent.contentOffset.y);
    },
    [],
  );

  // ── Task section expand / collapse state ─────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const groupsInitialised = useRef(false);
  const [taskSectionExpanded, setTaskSectionExpanded] = useState(true);
  const [quotesSectionExpanded, setQuotesSectionExpanded] = useState(true);

  // Initialise task group expand state once data arrives
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

  const allExpanded =
    dayGroups.length > 0 && dayGroups.every((g) => expandedGroups[g.date] !== false);

  const handleToggleAll = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !allExpanded;
    setExpandedGroups(Object.fromEntries(dayGroups.map((g) => [g.date, next])));
  }, [allExpanded, dayGroups]);

  const handleGroupToggle = useCallback((date: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedGroups((prev) => ({ ...prev, [date]: !prev[date] }));
  }, []);

  const handleToggleTaskSection = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTaskSectionExpanded((v) => !v);
  }, []);

  const handleToggleQuotesSection = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setQuotesSectionExpanded((v) => !v);
  }, []);

  const handleToggleQuotesFilter = useCallback(() => {
    setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending');
  }, [statusFilter, setStatusFilter]);

  // ── Invalidate on focus ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      invalidateTimeline();
      invalidateQuotes();
    });
    return unsubscribe;
  }, [navigation, invalidateTimeline, invalidateQuotes]);

  // ── Task handlers ─────────────────────────────────────────────────────────
  const handleOpenTask = useCallback(
    (task: Task) => navigation.navigate('TaskDetails', { taskId: task.id }),
    [navigation],
  );
  const handleAddProgressLog = useCallback(
    (task: Task) =>
      navigation.navigate('TaskDetails', { taskId: task.id, openProgressLog: true }),
    [navigation],
  );
  const handleAttachDocument = useCallback(
    (task: Task) =>
      navigation.navigate('TaskDetails', { taskId: task.id, openDocument: true }),
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

  // ── Quote handlers ────────────────────────────────────────────────────────
  const handleOpenQuotation = useCallback(
    (quotation: Quotation) =>
      navigation.navigate('QuotationDetail', { quotationId: quotation.id }),
    [navigation],
  );

  const handleQuotationAttachDocument = useCallback(
    (quotation: Quotation) => {
      if (quotation.taskId) {
        navigation.navigate('TaskDetails', {
          taskId: quotation.taskId,
          openDocument: true,
        });
      } else {
        navigation.navigate('QuotationDetail', { quotationId: quotation.id });
      }
    },
    [navigation],
  );

  // ── Derived display values ────────────────────────────────────────────────
  const statusLabel = project?.status
    ? project.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';
  const isActive =
    project?.status === 'in_progress' || (project?.status as string) === 'active';

  // Convert QuoteDayGroup[] → DayGroupGeneric<Quotation>[]
  const quoteDayGroupsGeneric: DayGroupGeneric<Quotation>[] = quoteDayGroups.map((g) => ({
    date: g.date,
    label: g.label,
    items: g.quotations,
  }));

  const quotesFilterLabel =
    statusFilter === 'pending'
      ? quoteTotalCount > 0
        ? `Show all (${quoteTotalCount})`
        : 'Show all'
      : `Pending (${pendingCount})`;

  const quotesSummary =
    visibleTotal > 0 ? formatCurrencyCompact(visibleTotal) : undefined;

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
          {loading ? 'Loading…' : (project?.name ?? '—')}
        </Text>
        <View className="w-8" />
      </View>

      {/* ── Sticky overlay — floats over the scroll content ────────── */}
      <View
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 10 }}
        pointerEvents="none"
      >
        <StickyOverlay scrollY={scrollY} sections={sectionBoundsRef.current} />
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: 128 }}
        scrollEventThrottle={16}
        onScroll={handleScroll}
      >
        {/* ── Loading / error states ──────────────────────────────── */}
        {loading && (
          <View className="p-8 items-center">
            <ActivityIndicator testID="project-detail-loading" size="large" />
          </View>
        )}

        {!loading && error && (
          <View className="p-6">
            <Text testID="project-detail-error" className="text-destructive text-center">
              {error}
            </Text>
          </View>
        )}

        {/* ── Project header card ─────────────────────────────────── */}
        {!loading && !error && (
          <View className="p-6 bg-card border-b border-border">
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text
                  testID="project-detail-name"
                  className="text-2xl font-bold text-foreground mb-1"
                >
                  {project?.name ?? '—'}
                </Text>
                {project?.location ? (
                  <View className="flex-row items-center mt-1 gap-1.5">
                    <MapPin className="text-muted-foreground" size={14} />
                    <Text
                      className="text-muted-foreground text-sm flex-1"
                      numberOfLines={2}
                    >
                      {project.location}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View
                className={`px-3 py-1.5 rounded-full ${
                  isActive ? 'bg-chart-2/10' : 'bg-chart-4/10'
                }`}
              >
                <Text
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isActive ? 'text-chart-2' : 'text-chart-4'
                  }`}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            {/* Start / End dates */}
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

            {/* Owner contact */}
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

        {/* ── Task Timeline ───────────────────────────────────────── */}
        {!loading && !error && (
          <View
            className="p-6"
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              const existing = sectionBoundsRef.current.findIndex((s) => s.key === 'tasks');
              const bound: SectionBound = {
                key: 'tasks',
                title: 'Task Timeline',
                top: y,
                bottom: y + height,
              };
              if (existing >= 0) {
                sectionBoundsRef.current = sectionBoundsRef.current.map((s, i) =>
                  i === existing ? bound : s,
                );
              } else {
                sectionBoundsRef.current = [...sectionBoundsRef.current, bound].sort(
                  (a, b) => a.top - b.top,
                );
              }
            }}
          >
            <TimelineSectionHeader
              title="Task Timeline"
              itemCount={dayGroups.reduce((n, g) => n + g.tasks.length, 0)}
              expanded={taskSectionExpanded}
              onToggle={handleToggleTaskSection}
              testID="task-section-header"
            />

            {/* Collapse/expand all pill */}
            {taskSectionExpanded && dayGroups.length > 0 && (
              <View className="flex-row justify-end -mt-2 mb-2">
                <Pressable
                  onPress={handleToggleAll}
                  className="px-3 py-1 bg-muted rounded-full active:opacity-70"
                  testID="timeline-toggle-all"
                >
                  <Text className="text-xs font-semibold text-muted-foreground">
                    {allExpanded ? 'Collapse All' : 'Expand All'}
                  </Text>
                </Pressable>
              </View>
            )}

            {taskSectionExpanded && (
              <>
                {dayGroups.length === 0 && (
                  <Text
                    testID="project-detail-no-tasks"
                    className="text-muted-foreground text-center py-8"
                  >
                    No tasks scheduled for this project.
                  </Text>
                )}

                {dayGroups.map((group, idx) => (
                  <TimelineDayGroup
                    key={group.date}
                    group={group}
                    isLast={idx === dayGroups.length - 1}
                    expanded={expandedGroups[group.date] !== false}
                    onToggle={() => handleGroupToggle(group.date)}
                    onOpenTask={handleOpenTask}
                    onAddProgressLog={handleAddProgressLog}
                    onAttachDocument={handleAttachDocument}
                    onMarkComplete={handleMarkComplete}
                    testID={`day-group-${group.date}`}
                  />
                ))}
              </>
            )}
          </View>
        )}

        {/* ── Quotes Section ──────────────────────────────────────── */}
        {!loading && !error && (
          <View
            className="px-6 pb-6"
            testID="quotes-section"
            onLayout={(e) => {
              const { y, height } = e.nativeEvent.layout;
              const existing = sectionBoundsRef.current.findIndex((s) => s.key === 'quotes');
              const bound: SectionBound = {
                key: 'quotes',
                title: 'Quotes',
                top: y,
                bottom: y + height,
              };
              if (existing >= 0) {
                sectionBoundsRef.current = sectionBoundsRef.current.map((s, i) =>
                  i === existing ? bound : s,
                );
              } else {
                sectionBoundsRef.current = [...sectionBoundsRef.current, bound].sort(
                  (a, b) => a.top - b.top,
                );
              }
            }}
          >
            <TimelineSectionHeader
              title="Quotes"
              itemCount={quoteDayGroups.reduce((n, g) => n + g.quotations.length, 0)}
              expanded={quotesSectionExpanded}
              onToggle={handleToggleQuotesSection}
              summary={quotesSummary}
              filterLabel={quoteTotalCount > 0 ? quotesFilterLabel : undefined}
              onToggleFilter={quoteTotalCount > 0 ? handleToggleQuotesFilter : undefined}
              testID="quotes-section-header"
            />

            {quotesSectionExpanded && (
              <>
                {quotesLoading && (
                  <View className="items-center py-6">
                    <ActivityIndicator testID="quotes-loading" size="small" />
                  </View>
                )}

                {!quotesLoading && (
                  <TimelineList<Quotation>
                    groups={quoteDayGroupsGeneric}
                    renderItem={(quotation) => (
                      <QuotationCard
                        key={quotation.id}
                        quotation={quotation}
                        onOpen={handleOpenQuotation}
                        onAccept={acceptQuotation}
                        onReject={rejectQuotation}
                        onAttachDocument={handleQuotationAttachDocument}
                        testID={`quotation-card-${quotation.id}`}
                      />
                    )}
                    emptyMessage={
                      statusFilter === 'pending'
                        ? 'No pending quotes for this project.'
                        : 'No quotes for this project.'
                    }
                    testID="quotes-timeline-list"
                  />
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

