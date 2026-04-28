/**
 * Unit tests for TaskIconRow
 * Covers acceptance criteria T1–T4 from design/issue-164-dashboard-ui-refined.md
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TaskIconRow } from '../../components/TaskIconRow';
import type { Task } from '../../../../domain/entities/Task';

function makeTask(id: string, status: Task['status']): Task {
  return { id, title: `Task ${id}`, status, isCriticalPath: false };
}

async function renderRow(tasks: Task[]): Promise<renderer.ReactTestRenderer> {
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<TaskIconRow tasks={tasks} />);
  });
  return tree;
}

describe('TaskIconRow', () => {
  // T1: 8 tasks → only 6 icon circles rendered
  it('T1: renders only 6 circles when 8 tasks are provided', async () => {
    const tasks = Array.from({ length: 8 }, (_, i) => makeTask(`t${i}`, 'pending'));
    const tree = await renderRow(tasks);
    const circles = tree.root.findAll(
      node =>
        (node.type as string) === 'View' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('w-8') &&
        node.props.className.includes('h-8') &&
        node.props.className.includes('rounded-full')
    );
    expect(circles.length).toBe(6);
  });

  // T2: overdue → bg-red-600 circle
  it('T2: overdue task renders a circle with bg-red-600', async () => {
    const tasks = [{ id: 't1', title: 'Overdue Task', status: 'overdue' as Task['status'], isCriticalPath: false }];
    const tree = await renderRow(tasks);
    const redCircles = tree.root.findAll(
      node =>
        (node.type as string) === 'View' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('bg-red-600')
    );
    expect(redCircles.length).toBeGreaterThanOrEqual(1);
  });

  // T3: pending → bg-yellow-500 circle
  it('T3: pending task renders a circle with bg-yellow-500', async () => {
    const tasks = [makeTask('t1', 'pending')];
    const tree = await renderRow(tasks);
    const yellowCircles = tree.root.findAll(
      node =>
        (node.type as string) === 'View' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('bg-yellow-500')
    );
    expect(yellowCircles.length).toBeGreaterThanOrEqual(1);
  });

  // T4: in_progress → bg-yellow-500 circle
  it('T4: in_progress task renders a circle with bg-yellow-500', async () => {
    const tasks = [makeTask('t1', 'in_progress')];
    const tree = await renderRow(tasks);
    const yellowCircles = tree.root.findAll(
      node =>
        (node.type as string) === 'View' &&
        typeof node.props.className === 'string' &&
        node.props.className.includes('bg-yellow-500')
    );
    expect(yellowCircles.length).toBeGreaterThanOrEqual(1);
  });

  // Extra: renders nothing when tasks array is empty
  it('returns null when no tasks', async () => {
    const tree = await renderRow([]);
    expect(tree.toJSON()).toBeNull();
  });
});

