/**
 * Unit tests for ProjectCard status badge rendering.
 * Track A — Issue #176
 *
 * Acceptance criteria:
 *   PLANNING    → 'Planning'
 *   IN_PROGRESS → 'Active'
 *   ON_HOLD     → 'On Hold'
 *   COMPLETED   → 'Done'
 *   CANCELLED   → 'Cancelled'
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// Mock lucide icons used in ProjectCard
jest.mock('lucide-react-native', () => {
  const { View } = require('react-native');
  const MockIcon = () => require('react').createElement(View);
  return {
    MapPin: MockIcon,
    Phone: MockIcon,
    CheckCircle: MockIcon,
    Clock: MockIcon,
    ChevronRight: MockIcon,
  };
});
import { ProjectCard } from '../../src/components/ProjectCard';
import { ProjectStatus } from '../../src/domain/entities/Project';
import { ProjectCardDto } from '../../src/application/dtos/ProjectCardDto';

const minimalDto = (status: ProjectStatus): ProjectCardDto => ({
  id: 'p1',
  owner: 'Alice',
  address: '1 Main St',
  status,
  contact: '0400 000 000',
  lastCompletedTask: { title: 'Foundation', completedDate: '2026-01-01' },
  upcomingTasks: [],
});

function getTree(status: ProjectStatus) {
  let instance: renderer.ReactTestRenderer;
  act(() => {
    instance = renderer.create(<ProjectCard project={minimalDto(status)} />);
  });
  return instance!.toJSON();
}

function findAllTexts(node: any): string[] {
  if (!node) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(findAllTexts);
  const own: string[] = typeof node.children === 'string' ? [node.children] : findAllTexts(node.children);
  return own;
}

describe('ProjectCard status badge', () => {
  it('renders "Planning" for PLANNING status', () => {
    const texts = findAllTexts(getTree(ProjectStatus.PLANNING));
    expect(texts).toContain('Planning');
    expect(texts).not.toContain('On Hold');
  });

  it('renders "Active" for IN_PROGRESS status', () => {
    const texts = findAllTexts(getTree(ProjectStatus.IN_PROGRESS));
    expect(texts).toContain('Active');
    expect(texts).not.toContain('On Hold');
  });

  it('renders "On Hold" for ON_HOLD status', () => {
    const texts = findAllTexts(getTree(ProjectStatus.ON_HOLD));
    expect(texts).toContain('On Hold');
  });

  it('renders "Done" for COMPLETED status', () => {
    const texts = findAllTexts(getTree(ProjectStatus.COMPLETED));
    expect(texts).toContain('Done');
    expect(texts).not.toContain('On Hold');
  });

  it('renders "Cancelled" for CANCELLED status', () => {
    const texts = findAllTexts(getTree(ProjectStatus.CANCELLED));
    expect(texts).toContain('Cancelled');
    expect(texts).not.toContain('On Hold');
  });
});
