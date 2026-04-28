/**
 * Unit tests for PaymentTypeFilterChips component
 * Run: npx jest PaymentsFilterBar
 */
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { PaymentTypeFilterChips } from '../../../components/PaymentTypeFilterChips';
import type { PaymentsFilterOption } from '../../../hooks/useGlobalPaymentsScreen';

describe('PaymentTypeFilterChips', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it('renders all 4 filter chip labels', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
      );
    });
    const texts = tree!.root
      .findAllByType(Text)
      .map((n) => String(n.props.children));
    expect(texts).toContain('Quotations');
    expect(texts).toContain('Pending');
    expect(texts).toContain('Paid');
    expect(texts).toContain('All');
  });

  it('calls onChange with "quotations" when Quotations chip is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-chip-quotations' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('quotations' satisfies PaymentsFilterOption);
  });

  it('calls onChange with "pending" when Pending chip is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="quotations" onChange={onChange} isDark={false} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-chip-pending' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('pending' satisfies PaymentsFilterOption);
  });

  it('calls onChange with "paid" when Paid chip is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-chip-paid' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('paid' satisfies PaymentsFilterOption);
  });

  it('calls onChange with "all" when All chip is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-chip-all' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('all' satisfies PaymentsFilterOption);
  });

  it('renders without crashing for each active value', async () => {
    const values: PaymentsFilterOption[] = ['quotations', 'pending', 'paid', 'all'];
    for (const value of values) {
      await act(async () => {
        renderer.create(
          <PaymentTypeFilterChips value={value} onChange={onChange} isDark={false} />,
        );
      });
    }
  });

  it('active chip has a different style from inactive chips (T-3)', async () => {
    // styles.chipActive vs styles.chipInactive must be distinct StyleSheet entries
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
      );
    });
    const activeChip = tree!.root.findByProps({ testID: 'filter-chip-pending' });
    const inactiveChip = tree!.root.findByProps({ testID: 'filter-chip-paid' });
    const activeStyles = activeChip.props.style as any[];
    const inactiveStyles = inactiveChip.props.style as any[];
    // Index [0] = styles.chip (same); index [1] = chipActive vs chipInactive (must differ)
    expect(activeStyles[1]).not.toBe(inactiveStyles[1]);
  });

  it('no Pressable chip has a className prop — guard against NativeWind InteropComponent crash (T-4)', async () => {
    // Regression guard: PaymentTypeFilterChips uses StyleSheet.create, not NativeWind className,
    // on its Pressable elements. Any className (even "") causes NativeWind v4 to wrap the
    // Pressable in an InteropComponent that misaligns with React Navigation v7 NavigationStateContext.
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
      );
    });
    const options: PaymentsFilterOption[] = ['quotations', 'pending', 'paid', 'all'];
    for (const option of options) {
      const chip = tree!.root.findByProps({ testID: `filter-chip-${option}` });
      expect(chip.props.className).toBeUndefined();
    }
  });
});
