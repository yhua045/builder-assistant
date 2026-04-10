/**
 * Unit tests for PaymentCard paidDate display — Issue #203 (Reqs 6, 7)
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import PaymentCard, { PaymentCardPayment } from '../../src/components/payments/PaymentCard';

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

function makePayment(overrides: Partial<PaymentCardPayment> = {}): PaymentCardPayment {
  return {
    id: 'pay-001',
    amount: 1000,
    contractorName: 'Test Contractor',
    status: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function getAllTexts(tree: renderer.ReactTestRenderer): string[] {
  return tree.root
    .findAllByType('Text' as any)
    .map((t) => String(t.props.children));
}

describe('PaymentCard — paidDate display', () => {
  it('renders "Paid on ..." when status is settled and paidDate is set', async () => {
    const payment = makePayment({ status: 'settled', paidDate: '2026-04-03T00:00:00Z' });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaymentCard payment={payment} />);
    });
    const texts = getAllTexts(tree);
    const paidText = texts.find((t) => t.includes('Paid on'));
    expect(paidText).toBeDefined();
    expect(paidText).toMatch(/3 Apr 2026/);
  });

  it('renders "Paid" without a date when status is settled and paidDate is absent', async () => {
    const payment = makePayment({ status: 'settled' });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaymentCard payment={payment} />);
    });
    const texts = getAllTexts(tree);
    const paidText = texts.find((t) => t === 'Paid');
    expect(paidText).toBeDefined();
  });

  it('does NOT render "Paid on ..." when status is pending', async () => {
    const payment = makePayment({ status: 'pending', dueDate: '2027-01-01T00:00:00Z' });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaymentCard payment={payment} />);
    });
    const texts = getAllTexts(tree);
    expect(texts.join(' ')).not.toContain('Paid on');
  });

  it('calls onPayNow when Pay Now button is pressed', async () => {
    const onPayNow = jest.fn();
    const payment = makePayment({ status: 'pending', dueDate: '2027-01-01T00:00:00Z' });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaymentCard payment={payment} onPayNow={onPayNow} />);
    });
    // Find the Pay Now button
    const payNowBtn = tree.root.findByProps({ testID: 'pay-now-btn' });
    expect(payNowBtn).toBeDefined();
    await act(async () => { payNowBtn.props.onPress(); });
    expect(onPayNow).toHaveBeenCalledWith(payment);
  });

  it('does not render a Pay Now button when onPayNow is undefined (read-only)', async () => {
    const payment = makePayment({ status: 'pending', dueDate: '2027-01-01T00:00:00Z' });
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<PaymentCard payment={payment} />);
    });
    const texts = getAllTexts(tree);
    expect(texts.join(' ')).not.toContain('Pay Now');
  });
});
