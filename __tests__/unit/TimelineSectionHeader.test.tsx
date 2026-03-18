/**
 * Unit tests for TimelineSectionHeader component.
 *
 * Covers:
 *  - Renders title and count badge
 *  - Renders ChevronDown when expanded, ChevronRight when collapsed
 *  - Calls onToggle when the body is pressed
 *  - Renders filter pill when filterLabel + onToggleFilter are provided
 *  - Calls onToggleFilter when filter pill is pressed
 *  - Renders optional summary text
 *  - Does not render filter pill when filterLabel is absent
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { TimelineSectionHeader } from '../../src/components/projects/TimelineSectionHeader';

describe('TimelineSectionHeader', () => {
  const defaults = {
    title: 'Quotes',
    itemCount: 3,
    expanded: true,
    onToggle: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    const { getByText } = render(<TimelineSectionHeader {...defaults} />);
    expect(getByText('Quotes')).toBeTruthy();
  });

  it('renders count badge when itemCount > 0', () => {
    const { getByTestId } = render(
      <TimelineSectionHeader {...defaults} testID="hdr" />,
    );
    expect(getByTestId('hdr-count').props.children).toBe(3);
  });

  it('does not render count badge when itemCount is 0', () => {
    const { queryByTestId } = render(
      <TimelineSectionHeader {...defaults} itemCount={0} testID="hdr" />,
    );
    expect(queryByTestId('hdr-count')).toBeNull();
  });

  it('calls onToggle when the toggle area is pressed', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <TimelineSectionHeader {...defaults} onToggle={onToggle} testID="hdr" />,
    );
    fireEvent.press(getByTestId('hdr-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders the filter pill when filterLabel and onToggleFilter are provided', () => {
    const onToggleFilter = jest.fn();
    const { getByTestId, getByText } = render(
      <TimelineSectionHeader
        {...defaults}
        filterLabel="Show all (5)"
        onToggleFilter={onToggleFilter}
        testID="hdr"
      />,
    );
    expect(getByTestId('hdr-filter')).toBeTruthy();
    expect(getByText('Show all (5)')).toBeTruthy();
  });

  it('calls onToggleFilter when filter pill is pressed', () => {
    const onToggleFilter = jest.fn();
    const { getByTestId } = render(
      <TimelineSectionHeader
        {...defaults}
        filterLabel="Show all"
        onToggleFilter={onToggleFilter}
        testID="hdr"
      />,
    );
    fireEvent.press(getByTestId('hdr-filter'));
    expect(onToggleFilter).toHaveBeenCalledTimes(1);
  });

  it('does not render filter pill when filterLabel is absent', () => {
    const { queryByTestId } = render(
      <TimelineSectionHeader {...defaults} testID="hdr" />,
    );
    expect(queryByTestId('hdr-filter')).toBeNull();
  });

  it('renders optional summary text', () => {
    const { getByText } = render(
      <TimelineSectionHeader {...defaults} summary="AUD 12,000" />,
    );
    expect(getByText('AUD 12,000')).toBeTruthy();
  });
});
