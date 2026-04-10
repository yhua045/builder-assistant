import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Invoice } from '../../src/domain/entities/Invoice';
import { TimelineInvoiceCard } from '../../src/components/projects/TimelineInvoiceCard';

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
        <TimelineInvoiceCard
          invoice={invoice}
          onPress={noop}
        />,
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
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onPress={noop} />,
      );
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
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onPress={noop} />,
      );
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
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onPress={noop} />,
      );
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
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onPress={noop} />,
      );
    });
    const texts = tree!.root.findAllByType('Text' as any);
    const found = texts.some((t) => String(t.props.children).toLowerCase().includes('partial'));
    expect(found).toBe(true);
  });

  // I6: tap card → onPress called
  it('I6: calls onPress when the card is tapped', async () => {
    const invoice = makeInvoice();
    const onPress = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onPress={onPress} testID="inv-card" />,
      );
    });
    const card = tree!.root.findByProps({ testID: 'inv-card' });
    await act(async () => { card.props.onPress(); });
    expect(onPress).toHaveBeenCalled();
  });

  // I7: tap Mark Paid → onMarkPaid called
  it('I7: calls onMarkPaid when Mark Paid button is tapped', async () => {
    const invoice = makeInvoice();
    const onMarkPaid = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <TimelineInvoiceCard invoice={invoice} onPress={noop} onMarkPaid={onMarkPaid} testID="inv-card" />,
      );
    });
    const markPaidBtn = tree!.root.findByProps({ testID: 'invoice-action-mark-paid' });
    await act(async () => { markPaidBtn.props.onPress(); });
    expect(onMarkPaid).toHaveBeenCalled();
  });
});
