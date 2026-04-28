import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Invoice } from '../../src/domain/entities/Invoice';
import { TimelineInvoiceCard } from '../../src/features/projects/components/TimelineInvoiceCard';

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  ExternalLink: 'ExternalLink',
  Paperclip: 'Paperclip',
  CheckCircle: 'CheckCircle',
  AlertCircle: 'AlertCircle',
  Clock: 'Clock',
  FileText: 'FileText',
  DollarSign: 'DollarSign',
}));

// ─── Fixtures ──────────────────────────────────────────────────────────────────

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-001',
    total: 4200,
    currency: 'AUD',
    status: 'issued',
    paymentStatus: 'unpaid',
    issuerName: 'ABC Plumbing',
    externalReference: 'INV-0042',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const noop = jest.fn();

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('TimelineInvoiceCard', () => {
  beforeEach(() => jest.clearAllMocks());

  // I1: renders issuer name
  it('I1: renders the issuer name', async () => {
    const invoice = makeInvoice({ issuerName: 'ABC Plumbing' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onEdit={noop} />,
      );
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).includes('ABC Plumbing'));
    expect(found).toBe(true);
  });

  // I2: renders formatted total
  it('I2: renders the formatted total amount', async () => {
    const invoice = makeInvoice({ total: 4200, currency: 'AUD' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={noop} />);
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).includes('4,200'));
    expect(found).toBe(true);
  });

  // I3: overdue status → Overdue chip
  it('I3: renders Overdue chip for overdue status', async () => {
    const invoice = makeInvoice({ status: 'overdue' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={noop} />);
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).toLowerCase().includes('overdue'));
    expect(found).toBe(true);
  });

  // I4: draft status → Draft chip
  it('I4: renders Draft chip for draft status', async () => {
    const invoice = makeInvoice({ status: 'draft' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={noop} />);
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).toLowerCase().includes('draft'));
    expect(found).toBe(true);
  });

  // I5: paymentStatus: 'partial' → Partial chip
  it('I5: renders Partial chip for partial payment status', async () => {
    const invoice = makeInvoice({ paymentStatus: 'partial' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={noop} />);
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).toLowerCase().includes('partial'));
    expect(found).toBe(true);
  });

  // I8: root element has no onPress (card is not pressable)
  it('I8: root element has no onPress handler', async () => {
    const invoice = makeInvoice();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onEdit={noop} testID="inv-card" />,
      );
    });
    const root = tree!.root.findByProps({ testID: 'inv-card' });
    expect(root.props.onPress).toBeUndefined();
  });

  // I9: Edit button is rendered for non-paid invoices
  it('I9: Edit button is rendered for non-paid invoice', async () => {
    const invoice = makeInvoice({ paymentStatus: 'unpaid' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={noop} testID="inv-card" />);
    });
    const editBtn = tree!.root.findByProps({ testID: 'invoice-action-edit' });
    expect(editBtn).toBeTruthy();
  });

  // I10: tapping Edit calls onEdit
  it('I10: tapping Edit button calls onEdit', async () => {
    const invoice = makeInvoice();
    const onEdit = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={onEdit} testID="inv-card" />);
    });
    const editBtn = tree!.root.findByProps({ testID: 'invoice-action-edit' });
    await act(async () => { editBtn.props.onPress(); });
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  // I11: Review Payment button is rendered when onReviewPayment is provided
  it('I11: Review Payment button is rendered when onReviewPayment is provided', async () => {
    const invoice = makeInvoice({ paymentStatus: 'unpaid' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onEdit={noop} onReviewPayment={noop} testID="inv-card" />,
      );
    });
    const reviewBtn = tree!.root.findByProps({ testID: 'invoice-action-review-payment' });
    expect(reviewBtn).toBeTruthy();
  });

  // I12: tapping Review Payment calls onReviewPayment
  it('I12: tapping Review Payment calls onReviewPayment', async () => {
    const invoice = makeInvoice();
    const onReviewPayment = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onEdit={noop} onReviewPayment={onReviewPayment} testID="inv-card" />,
      );
    });
    const reviewBtn = tree!.root.findByProps({ testID: 'invoice-action-review-payment' });
    await act(async () => { reviewBtn.props.onPress(); });
    expect(onReviewPayment).toHaveBeenCalledTimes(1);
  });

  // I13: Review Payment button is NOT rendered when onReviewPayment is omitted
  it('I13: Review Payment button is not rendered when onReviewPayment is omitted', async () => {
    const invoice = makeInvoice({ paymentStatus: 'unpaid' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TimelineInvoiceCard invoice={invoice} onEdit={noop} testID="inv-card" />);
    });
    const found = tree!.root.findAll((node) => node.props.testID === 'invoice-action-review-payment');
    expect(found).toHaveLength(0);
  });

  // I14: Edit button renders before (left of) Review Payment in the DOM tree
  it('I14: Edit button renders before Review Payment button in the tree', async () => {
    const invoice = makeInvoice({ paymentStatus: 'unpaid' });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onEdit={noop} onReviewPayment={noop} testID="inv-card" />,
      );
    });
    const json = JSON.stringify(tree!.toJSON());
    const editIdx = json.indexOf('"invoice-action-edit"');
    const reviewIdx = json.indexOf('"invoice-action-review-payment"');
    expect(editIdx).toBeGreaterThan(-1);
    expect(reviewIdx).toBeGreaterThan(-1);
    expect(editIdx).toBeLessThan(reviewIdx);
  });

  // I7 (updated): tapping Review Payment calls onReviewPayment (replaces old Mark Paid test)
  it('I7: calls onReviewPayment when Review Payment button is tapped', async () => {
    const invoice = makeInvoice();
    const onReviewPayment = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onEdit={noop} onReviewPayment={onReviewPayment} testID="inv-card" />,
      );
    });
    const reviewBtn = tree!.root.findByProps({ testID: 'invoice-action-review-payment' });
    await act(async () => { reviewBtn.props.onPress(); });
    expect(onReviewPayment).toHaveBeenCalled();
  });
});
