import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Payment } from '../../src/domain/entities/Payment';
import { TimelinePaymentCard } from '../../src/features/projects/components/TimelinePaymentCard';

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  DollarSign: 'DollarSign',
  AlertCircle: 'AlertCircle',
  Clock: 'Clock',
  CheckCircle: 'CheckCircle',
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-001',
    amount: 5500,
    currency: 'AUD',
    status: 'pending',
    contractorName: 'Smith Electrical',
    paymentCategory: 'contract',
    stageLabel: 'Frame Stage',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = jest.fn();

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('TimelinePaymentCard', () => {
  beforeEach(() => jest.clearAllMocks());

  // P1: renders contractor name
  it('P1: renders the contractor name', async () => {
    const payment = makePayment({ contractorName: 'Smith Electrical' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} testID="pay-card" />,
      );
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).includes('Smith Electrical'));
    expect(found).toBe(true);
  });

  // P2: renders formatted amount
  it('P2: renders the formatted amount', async () => {
    const payment = makePayment({ amount: 5500 });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} testID="pay-card" />,
      );
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).includes('5,500'));
    expect(found).toBe(true);
  });

  // P3: root element has no onPress (card is not pressable)
  it('P3: root element has no onPress handler', async () => {
    const payment = makePayment();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} testID="pay-card" />,
      );
    });
    const root = tree!.root.findByProps({ testID: 'pay-card' });
    expect(root.props.onPress).toBeUndefined();
  });

  // P4: Edit button is rendered for non-settled payments
  it('P4: Edit button is rendered for non-settled payment', async () => {
    const payment = makePayment({ status: 'pending' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} testID="pay-card" />,
      );
    });
    const editBtn = tree!.root.findByProps({ testID: 'pay-card-edit' });
    expect(editBtn).toBeTruthy();
  });

  // P5: tapping Edit calls onEdit
  it('P5: tapping Edit button calls onEdit', async () => {
    const payment = makePayment({ status: 'pending' });
    const onEdit = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={onEdit} testID="pay-card" />,
      );
    });
    const editBtn = tree!.root.findByProps({ testID: 'pay-card-edit' });
    await act(async () => { editBtn.props.onPress(); });
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // P6: Review Payment button rendered when onReviewPayment provided
  it('P6: Review Payment button is rendered when onReviewPayment is provided', async () => {
    const payment = makePayment({ status: 'pending' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} onReviewPayment={noop} testID="pay-card" />,
      );
    });
    const reviewBtn = tree!.root.findByProps({ testID: 'pay-card-review-payment' });
    expect(reviewBtn).toBeTruthy();
  });

  // P7: tapping Review Payment calls onReviewPayment
  it('P7: tapping Review Payment calls onReviewPayment', async () => {
    const payment = makePayment({ status: 'pending' });
    const onReviewPayment = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} onReviewPayment={onReviewPayment} testID="pay-card" />,
      );
    });
    const reviewBtn = tree!.root.findByProps({ testID: 'pay-card-review-payment' });
    await act(async () => { reviewBtn.props.onPress(); });
    expect(onReviewPayment).toHaveBeenCalledTimes(1);
  });

  // P8: Review Payment button NOT rendered when onReviewPayment is omitted
  it('P8: Review Payment button is not rendered when onReviewPayment is omitted', async () => {
    const payment = makePayment({ status: 'pending' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} testID="pay-card" />,
      );
    });
    const found = tree!.root.findAll((node) => node.props.testID === 'pay-card-review-payment');
    expect(found).toHaveLength(0);
  });

  // P9: Edit renders before Review Payment in the button row
  it('P9: Edit button renders before Review Payment button in the tree', async () => {
    const payment = makePayment({ status: 'pending' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} onReviewPayment={noop} testID="pay-card" />,
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    const editIdx = json.indexOf('"pay-card-edit"');
    const reviewIdx = json.indexOf('"pay-card-review-payment"');
    expect(editIdx).toBeGreaterThan(-1);
    expect(reviewIdx).toBeGreaterThan(-1);
    expect(editIdx).toBeLessThan(reviewIdx);
  });

  // P10: settled payment renders "Paid" chip
  it('P10: settled payment renders a Paid chip', async () => {
    const payment = makePayment({ status: 'settled' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelinePaymentCard payment={payment} onEdit={noop} testID="pay-card" />,
      );
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).toLowerCase().includes('paid'));
    expect(found).toBe(true);
  });
});
