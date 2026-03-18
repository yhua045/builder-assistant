/**
 * Unit tests for QuotationCard component.
 *
 * Covers:
 *  - Renders reference, vendor name, total, and status badge
 *  - Shows Accept/Reject actions when status === 'sent'
 *  - Hides Accept/Reject when status !== 'sent'
 *  - Calls onAccept with confirmation flow
 *  - Calls onReject with confirmation flow
 *  - Calls onOpen when body or Open button is pressed
 *  - Calls onAttachDocument when Attach button is pressed
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { QuotationCard } from '../../src/components/projects/QuotationCard';
import { Quotation } from '../../src/domain/entities/Quotation';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeQuotation(overrides: Partial<Quotation> & { id: string }): Quotation {
  return {
    reference: `QT-${overrides.id}`,
    date: '2024-12-20',
    total: 2500,
    currency: 'AUD',
    status: 'sent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const PENDING_QUOTE = makeQuotation({
  id: 'q1',
  status: 'sent',
  vendorName: 'Acme Pty Ltd',
  total: 2500,
});

describe('QuotationCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
  });

  it('renders reference number', () => {
    const { getByTestId } = render(
      <QuotationCard quotation={PENDING_QUOTE} testID="card" />,
    );
    expect(getByTestId('card-reference').props.children).toBe('QT-q1');
  });

  it('renders vendor name', () => {
    const { getByText } = render(
      <QuotationCard quotation={PENDING_QUOTE} testID="card" />,
    );
    expect(getByText('Acme Pty Ltd')).toBeTruthy();
  });

  it('renders formatted total', () => {
    const { getByTestId } = render(
      <QuotationCard quotation={PENDING_QUOTE} testID="card" />,
    );
    const totalText = getByTestId('card-total').props.children;
    expect(totalText).toMatch(/2,500/);
  });

  it('renders status badge with correct label for sent status', () => {
    const { getByTestId } = render(
      <QuotationCard quotation={PENDING_QUOTE} testID="card" />,
    );
    expect(getByTestId('card-status').props.children).toBe('Pending');
  });

  it('renders correct badge for accepted status', () => {
    const q = makeQuotation({ id: 'q2', status: 'accepted' });
    const { getByTestId } = render(<QuotationCard quotation={q} testID="card" />);
    expect(getByTestId('card-status').props.children).toBe('Accepted');
  });

  it('renders correct badge for declined status', () => {
    const q = makeQuotation({ id: 'q3', status: 'declined' });
    const { getByTestId } = render(<QuotationCard quotation={q} testID="card" />);
    expect(getByTestId('card-status').props.children).toBe('Declined');
  });

  it('shows Accept and Reject buttons when status is sent', () => {
    const { getByTestId } = render(
      <QuotationCard
        quotation={PENDING_QUOTE}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        testID="card"
      />,
    );
    expect(getByTestId('card-accept')).toBeTruthy();
    expect(getByTestId('card-reject')).toBeTruthy();
  });

  it('hides Accept and Reject buttons when status is accepted', () => {
    const q = makeQuotation({ id: 'q2', status: 'accepted' });
    const { queryByTestId } = render(
      <QuotationCard
        quotation={q}
        onAccept={jest.fn()}
        onReject={jest.fn()}
        testID="card"
      />,
    );
    expect(queryByTestId('card-accept')).toBeNull();
    expect(queryByTestId('card-reject')).toBeNull();
  });

  it('triggers Alert.alert when Accept button is pressed', () => {
    const { getByTestId } = render(
      <QuotationCard
        quotation={PENDING_QUOTE}
        onAccept={jest.fn()}
        testID="card"
      />,
    );
    fireEvent.press(getByTestId('card-accept'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Accept Quotation',
      expect.stringContaining('QT-q1'),
      expect.any(Array),
    );
  });

  it('triggers Alert.alert when Reject button is pressed', () => {
    const { getByTestId } = render(
      <QuotationCard
        quotation={PENDING_QUOTE}
        onReject={jest.fn()}
        testID="card"
      />,
    );
    fireEvent.press(getByTestId('card-reject'));
    expect(Alert.alert).toHaveBeenCalledWith(
      'Reject Quotation',
      expect.stringContaining('QT-q1'),
      expect.any(Array),
    );
  });

  it('calls onOpen when the card body is pressed', () => {
    const onOpen = jest.fn();
    const { getByTestId } = render(
      <QuotationCard quotation={PENDING_QUOTE} onOpen={onOpen} testID="card" />,
    );
    fireEvent.press(getByTestId('card-open'));
    expect(onOpen).toHaveBeenCalledWith(PENDING_QUOTE);
  });

  it('calls onAttachDocument when Attach button is pressed', () => {
    const onAttachDocument = jest.fn();
    const { getByTestId } = render(
      <QuotationCard
        quotation={PENDING_QUOTE}
        onAttachDocument={onAttachDocument}
        testID="card"
      />,
    );
    fireEvent.press(getByTestId('card-attach'));
    expect(onAttachDocument).toHaveBeenCalledWith(PENDING_QUOTE);
  });

  it('renders expiry date when present', () => {
    const q = makeQuotation({ id: 'q1', expiryDate: '2025-01-31' });
    const { getByText } = render(<QuotationCard quotation={q} testID="card" />);
    expect(getByText(/Jan 2025/)).toBeTruthy();
  });
});
