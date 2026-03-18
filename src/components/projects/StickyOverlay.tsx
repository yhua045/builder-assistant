/**
 * StickyOverlay
 *
 * A position-absolute overlay that renders a sticky section title at the
 * top of the scrollable content area. It tracks the current scroll position
 * against a list of registered section bounds to determine which section
 * header is active.
 *
 * Rendered as a sibling to the ScrollView (not inside it) so it stays visible
 * while the user scrolls through the content below.
 *
 * Usage (in ProjectDetail):
 * ```tsx
 * const [scrollY, setScrollY] = useState(0);
 * const sectionBounds = useRef<SectionBound[]>([]);
 *
 * <View style={StyleSheet.absoluteFill} pointerEvents="none">
 *   <StickyOverlay scrollY={scrollY} sections={sectionBounds.current} />
 * </View>
 * ```
 */

import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

export interface SectionBound {
  /** Unique key matching the section (e.g. 'tasks', 'quotes') */
  key: string;
  /** Display title shown in the sticky bar */
  title: string;
  /** Top offset relative to the ScrollView's content (from onLayout) */
  top: number;
  /** Bottom offset relative to the ScrollView's content (from onLayout) */
  bottom: number;
}

export interface StickyOverlayProps {
  /** Current scroll Y from the ScrollView's onScroll callback */
  scrollY: number;
  /** Registered section bounds (top/bottom content offsets) */
  sections: SectionBound[];
}

export function StickyOverlay({ scrollY, sections }: StickyOverlayProps) {
  const activeTitle = useMemo(() => {
    if (!sections.length) return null;
    // Find the last section whose top is at or above scrollY
    let active: SectionBound | null = null;
    for (const section of sections) {
      if (scrollY >= section.top - 1) {
        active = section;
      }
    }
    return active?.title ?? null;
  }, [scrollY, sections]);

  if (!activeTitle) return null;

  return (
    <View
      className="absolute left-0 right-0 top-0 z-10 px-6 py-2 bg-background/90 border-b border-border"
      pointerEvents="none"
      testID="sticky-overlay"
    >
      <Text className="text-sm font-semibold text-foreground" testID="sticky-overlay-title">
        {activeTitle}
      </Text>
    </View>
  );
}
