import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  useColorScheme
} from 'react-native';
import { AlertCircle, Calendar, ChevronRight, AlertTriangle } from 'lucide-react-native';
import { BlockerBarResult } from '../../../domain/entities/CockpitData';
import { Task } from '../../../domain/entities/Task';

export interface BlockerCarouselProps {
  data: BlockerBarResult;
  /** Called when a blocker card is tapped — not fired for the winning card. */
  onCardPress: (task: Task) => void;
}

// ── NextInLinePreview ─────────────────────────────────────────────────────────

/**
 * Lightweight inline preview of downstream tasks (1–3 items).
 * Read-only — data already present in BlockerBarResult.blockers[n].nextInLine.
 */
function NextInLinePreview({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return null;
  const shown = tasks.slice(0, 3);
  return (
    <View style={nextInLineStyles.container}>
      <Text style={nextInLineStyles.label}>Next in line</Text>
      {shown.map((t) => (
        <View key={t.id} style={nextInLineStyles.row}>
          <Text style={nextInLineStyles.dot}>
            {t.status === 'completed' ? '✅' : t.status === 'blocked' ? '🔴' : '⏳'}
          </Text>
          <Text style={nextInLineStyles.title} numberOfLines={1}>
            {t.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

const nextInLineStyles = StyleSheet.create({
  container: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    fontSize: 12,
    width: 18,
    textAlign: 'center',
  },
  title: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
  },
});

export function BlockerCarousel({ data, onCardPress }: BlockerCarouselProps) {
  const { width } = useWindowDimensions();
  const isDark = useColorScheme() === 'dark';
  
  // Card width is screen width minus padding (24 on each side), 
  // but minus a bit more so the next card peeks in
  const cardWidth = width - 64;

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return 'TBD';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'TBD';
    }
  };

  // ── Winning state ──────────────────────────────────────────────────────────
  if (data.kind === 'winning') {
    return (
      <View style={[styles.container]}>
        <View style={styles.headerRow}>
          <Text
            style={[styles.sectionHeader, { color: isDark ? '#f8fafc' : '#0f172a' }]}
            accessibilityRole="header"
          >
            No Active Blockers
          </Text>
        </View>
        <View style={styles.scrollContent}>
          <View
            testID="blocker-winning-card"
            style={styles.winningCard}
            accessible
            accessibilityLabel="You're winning today — no active blockers"
          >
            <Text style={styles.winningEmoji}>🎉</Text>
            <Text style={styles.winningTitle}>You're winning today</Text>
            <Text style={styles.winningSubtitle}>no active blockers</Text>
          </View>
        </View>
      </View>
    );
  }

  // ── Blockers state ─────────────────────────────────────────────────────────
  const { blockers, projectName } = data;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleContainer}>
          <AlertTriangle color="#ef4444" size={24} />
          <Text
            style={[styles.sectionHeader, { color: isDark ? '#f8fafc' : '#0f172a' }]}
            accessibilityRole="header"
          >
            Critical Blockers
          </Text>
        </View>
        <Text style={styles.headerCount}>{blockers.length} active</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="blocker-carousel"
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
      >
        {blockers.map((item) => (
          <TouchableOpacity
            key={item.task.id}
            testID={`blocker-card-${item.task.id}`}
            onPress={() => onCardPress(item.task)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${item.task.title} - ${
              item.severity === 'red' ? 'critically blocked' : 'delayed'
            }. Tap to open details.`}
            style={[
              styles.card,
              { width: cardWidth },
              item.severity === 'red' ? styles.cardBgRed : styles.cardBgYellow,
            ]}
          >
            {/* Top Indicator Line */}
            <View style={styles.topIndicatorContainer}>
              <View
                style={[
                  styles.topIndicator,
                  item.severity === 'red'
                    ? { backgroundColor: '#ef4444', width: '85%' }
                    : { backgroundColor: '#f59e0b', width: '70%' },
                ]}
              />
            </View>

            <View style={styles.cardContent}>
              {/* Task title */}
              <Text style={[styles.taskTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]} numberOfLines={2}>
                {item.task.title}
              </Text>

              {/* Project line */}
              <View style={styles.projectRow}>
                <View
                  style={[
                    styles.projectDot,
                    { backgroundColor: item.severity === 'red' ? '#3b82f6' : '#10b981' },
                  ]}
                />
                <Text style={styles.projectText} numberOfLines={1}>
                  {projectName || 'No Project'}
                </Text>
              </View>

              {/* Blocker Reasons (Pills) */}
              <View style={styles.reasonsContainer}>
                {item.blockedPrereqs.length > 0 ? (
                  item.blockedPrereqs.map((prereq) => (
                    <View
                      key={prereq.id}
                      style={[
                        styles.reasonPill,
                        item.severity === 'red' ? styles.reasonPillRed : styles.reasonPillYellow,
                      ]}
                    >
                      <AlertCircle
                        size={14}
                        color={item.severity === 'red' ? '#b91c1c' : '#b45309'}
                      />
                      <Text
                        style={[
                          styles.reasonText,
                          item.severity === 'red' ? styles.reasonTextRed : styles.reasonTextYellow,
                        ]}
                        numberOfLines={1}
                      >
                        {prereq.title}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      styles.reasonPill,
                      item.severity === 'red' ? styles.reasonPillRed : styles.reasonPillYellow,
                    ]}
                  >
                    <AlertCircle
                      size={14}
                      color={item.severity === 'red' ? '#b91c1c' : '#b45309'}
                    />
                    <Text
                      style={[
                        styles.reasonText,
                        item.severity === 'red' ? styles.reasonTextRed : styles.reasonTextYellow,
                      ]}
                        numberOfLines={1}
                    >
                      {item.severity === 'red' ? 'Blocked' : 'Delayed'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Footer Details */}
              <View style={styles.footerRow}>
                <View style={styles.footerItem}>
                  <Calendar size={14} color="#94a3b8" />
                  <Text style={styles.footerText}>
                    Starts: {formatShortDate(item.task.scheduledAt || item.task.scheduledStart)}
                  </Text>
                </View>
                <View style={styles.footerRight}>
                  <ChevronRight size={16} color="#94a3b8" />
                </View>
              </View>

              {/* Next-In-Line inline preview (moved below date per issue #136) */}
              <NextInLinePreview tasks={item.nextInLine} />
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionHeader: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerCount: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
  },
  cardBgRed: {
    backgroundColor: '#fff5f5',
    borderColor: '#fee2e2',
  },
  cardBgYellow: {
    backgroundColor: '#fffbf0',
    borderColor: '#fef3c7',
  },
  topIndicatorContainer: {
    height: 4,
    width: '100%',
    backgroundColor: 'transparent',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topIndicator: {
    height: '100%',
  },
  cardContent: {
    padding: 16,
    paddingTop: 20,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    lineHeight: 24,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  projectDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  projectText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  reasonsContainer: {
    gap: 8,
    marginBottom: 16,
  },
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  reasonPillRed: {
    backgroundColor: '#fee2e2',
  },
  reasonPillYellow: {
    backgroundColor: '#fef3c7',
  },
  reasonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reasonTextRed: {
    color: '#b91c1c',
  },
  reasonTextYellow: {
    color: '#b45309',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  footerRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  winningCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  winningEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  winningTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#15803d',
    textAlign: 'center',
  },
  winningSubtitle: {
    fontSize: 14,
    color: '#16a34a',
    marginTop: 4,
    textAlign: 'center',
  },
});
