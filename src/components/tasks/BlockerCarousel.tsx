/**
 * BlockerCarousel — horizontally scrollable row of blocker cards.
 *
 * Consumed by TasksScreen (src/pages/tasks/index.tsx).
 * Data comes from useBlockerBar → BlockerBarResult.
 *
 * Renders two states:
 *   - kind='blockers' → scrollable row of blocker cards (+ project name label when falling back)
 *   - kind='winning'  → single non-interactive green "You're winning today" card
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BlockerBarResult } from '../../domain/entities/CockpitData';
import { Task } from '../../domain/entities/Task';

export interface BlockerCarouselProps {
  data: BlockerBarResult;
  /** Called when a blocker card is tapped — not fired for the winning card. */
  onCardPress: (task: Task, prereqs: Task[], nextInLine: Task[]) => void;
}

export function BlockerCarousel({ data, onCardPress }: BlockerCarouselProps) {
  // ── Winning state ──────────────────────────────────────────────────────────
  if (data.kind === 'winning') {
    return (
      <View style={[styles.container, styles.containerWinning]}>
        <Text
          style={styles.sectionHeader}
          accessibilityRole="header"
        >
          No Active Blockers
        </Text>
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
        <Text
          style={styles.sectionHeader}
          accessibilityRole="header"
        >
          ⛔ Blockers
        </Text>
        <Text style={styles.projectLabel}>{projectName}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        testID="blocker-carousel"
      >
        {blockers.map((item) => (
          <TouchableOpacity
            key={item.task.id}
            testID={`blocker-card-${item.task.id}`}
            onPress={() => onCardPress(item.task, item.blockedPrereqs, item.nextInLine)}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`${item.task.title} - ${
              item.severity === 'red' ? 'critically blocked' : 'delayed'
            }. Tap to open details.`}
            style={[
              styles.card,
              item.severity === 'red' ? styles.cardBorderRed : styles.cardBorderYellow,
            ]}
          >
            {/* Severity badge */}
            <View style={styles.cardHeader}>
              <Text
                style={[
                  styles.severityBadge,
                  item.severity === 'red' ? styles.badgeTextRed : styles.badgeTextYellow,
                ]}
              >
                {item.severity === 'red' ? '🔴 BLOCKED' : '🟡 DELAYED'}
              </Text>
            </View>

            {/* Task title */}
            <Text style={styles.taskTitle} numberOfLines={2}>
              {item.task.title}
            </Text>

            {/* First blocked prereq */}
            {item.blockedPrereqs.length > 0 && (
              <Text style={styles.prereqText} numberOfLines={1}>
                Blocked by: {item.blockedPrereqs[0].title}
              </Text>
            )}

            {/* Next-in-line count */}
            {item.nextInLine.length > 0 && (
              <Text style={styles.nextInLineText}>
                {`+${item.nextInLine.length} tasks waiting`}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
    // Hero section: subtle accent line at top so it reads as primary
    borderTopWidth: 3,
    borderTopColor: '#ef4444',
    paddingTop: 10,
  },
  containerWinning: {
    borderTopColor: '#22c55e',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 4,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  projectLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 4,
  },
  card: {
    width: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  cardBorderRed: {
    borderLeftColor: '#ef4444',
  },
  cardBorderYellow: {
    borderLeftColor: '#f59e0b',
  },
  cardHeader: {
    marginBottom: 6,
  },
  severityBadge: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  badgeTextRed: {
    color: '#ef4444',
  },
  badgeTextYellow: {
    color: '#d97706',
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
    lineHeight: 19,
  },
  prereqText: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  nextInLineText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 4,
  },
  // ── Winning state ────────────────────────────────────────────────────────
  winningCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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

