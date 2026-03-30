/**
 * Unit tests for PaymentsFilterBar component
 * Run: npx jest PaymentsFilterBar
 */
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import { PaymentsFilterBar } from '../../src/components/payments/PaymentsFilterBar';
import type { PaymentsFilterOption } from '../../src/hooks/useGlobalPaymentsScreen';

describe('PaymentsFilterBar', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it('renders all 4 filter option labels', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentsFilterBar value="pending" onChange={onChange} />,
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

  it('calls onChange with "quotations" when Quotations is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentsFilterBar value="pending" onChange={onChange} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-option-quotations' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('quotations' satisfies PaymentsFilterOption);
  });

  it('calls onChange with "pending" when Pending is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentsFilterBar value="quotations" onChange={onChange} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-option-pending' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('pending' satisfies PaymentsFilterOption);
  });

  it('calls onChange with "paid" when Paid is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentsFilterBar value="pending" onChange={onChange} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-option-paid' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('paid' satisfies PaymentsFilterOption);
  });

  it('calls onChange with "all" when All is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentsFilterBar value="pending" onChange={onChange} />,
      );
    });
    const btn = tree!.root.findByProps({ testID: 'filter-option-all' });
    await act(async () => {
      btn.props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('all' satisfies PaymentsFilterOption);
  });

  it('renders without crashing for each active value', async () => {
    const values: PaymentsFilterOption[] = ['quotations', 'pending', 'paid', 'all'];
    for (const value of values) {
      await act(async () => {
        renderer.create(<PaymentsFilterBar value={value} onChange={onChange} />);
      });
    }
  });

  it('active pill has the NativeWind className; inactive pills have undefined className (not empty string)', async () => {
    // Regression guard for the NavigationStateContext crash:
    // className="" (empty string) causes NativeWind v4 to wrap TouchableOpacity in an
    // InteropComponent that misfires during React 19 concurrent re-renders inside
    // React Navigation v7 screen boundaries. className={undefined} prevents the wrapper.
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <PaymentsFilterBar value="pending" onChange={onChange} />,
      );
    });
    const options: PaymentsFilterOption[] = ['quotations', 'pending', 'paid', 'all'];
    for (const option of options) {
      const btn = tree!.root.findByProps({ testID: `filter-option-${option}` });
      if (option === 'pending') {
        expect(btn.props.className).toBe('bg-card rounded-lg shadow-sm');
      } else {
        // Must be undefined, NOT the empty string '', to avoid NativeWind wrapper crash
        expect(btn.props.className).toBeUndefined();
      }
    }
  });
});
