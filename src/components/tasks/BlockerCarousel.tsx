/**
 * BlockerCarousel — horizontally scrollable row of blocker cards.
 *
 * Consumed by TasksScreen (src/pages/tasks/index.tsx).
 * Data comes from useCockpitData → CockpitData.blockers.
 */
import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { BlockerItem } from '../../domain/entities/CockpitData';
import { Task } from '../../domain/entities/Task';

export interface BlockerCarouselProps {
  blockers: BlockerItem[];
  /** Called when a card is tapped — passes task, its blocked prereqs, and next-in-line tasks. */
  onCardPress: (task: Task, prereqs: Task[], nextInLine: Task[]) => void;
}

export function BlockerCarousel({ blockers, onCardPress }: BlockerCarouselProps) {
  if (blockers.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>⛔ Blockers</Text>
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
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 24,
    gap: 12,
    paddingBottom: 4,
  },
  card: {
    width: 200,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
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
});
