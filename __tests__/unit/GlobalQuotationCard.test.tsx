/**
 * Unit tests for GlobalQuotationCard component
 * Run: npx jest GlobalQuotationCard
 */
import React from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';
import GlobalQuotationCard from '../../src/features/payments/components/GlobalQuotationCard';
import type { Quotation } from '../../src/domain/entities/Quotation';

const makeQuotation = (overrides: Partial<Quotation> = {}): Quotation => ({
  id: 'q1',
  reference: 'QT-2026-001',
  date: '2026-03-01',
  total: 8200,
  currency: 'AUD',
  status: 'sent',
  vendorName: 'Mitchell Plastering Co.',
  expiryDate: '2026-04-15',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
  ...overrides,
});

function getAllText(tree: renderer.ReactTestRenderer): string[] {
  return tree.root.findAllByType(Text).map((n) => String(n.props.children));
}

describe('GlobalQuotationCard', () => {
  it('renders vendor name', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<GlobalQuotationCard quotation={makeQuotation()} />);
    });
    expect(getAllText(tree!).some((t) => t.includes('Mitchell Plastering Co.'))).toBe(true);
  });

  it('renders quotation reference', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<GlobalQuotationCard quotation={makeQuotation()} />);
    });
    expect(getAllText(tree!).some((t) => t.includes('QT-2026-001'))).toBe(true);
  });

  it('renders formatted amount', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<GlobalQuotationCard quotation={makeQuotation()} />);
    });
    const texts = getAllText(tree!).join(' ');
    expect(texts.replace(/,/g, '')).toContain('8200');
  });

  it('renders status badge for "sent"', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<GlobalQuotationCard quotation={makeQuotation({ status: 'sent' })} />);
    });
    const texts = getAllText(tree!).join(' ').toLowerCase();
    expect(texts).toContain('sent');
  });

  it('renders status badge for "accepted"', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <GlobalQuotationCard quotation={makeQuotation({ status: 'accepted' })} />,
      );
    });
    const texts = getAllText(tree!).join(' ').toLowerCase();
    expect(texts).toContain('accepted');
  });

  it('renders status badge for "declined"', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <GlobalQuotationCard quotation={makeQuotation({ status: 'declined' })} />,
      );
    });
    const texts = getAllText(tree!).join(' ').toLowerCase();
    expect(texts).toContain('declined');
  });

  it('renders status badge for "draft"', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <GlobalQuotationCard quotation={makeQuotation({ status: 'draft' })} />,
      );
    });
    const texts = getAllText(tree!).join(' ').toLowerCase();
    expect(texts).toContain('draft');
  });

  it('renders optional project name when provided', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <GlobalQuotationCard quotation={makeQuotation()} projectName="Sunrise Renovation" />,
      );
    });
    expect(getAllText(tree!).some((t) => t.includes('Sunrise Renovation'))).toBe(true);
  });

  it('does not render project name area when projectName is absent', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<GlobalQuotationCard quotation={makeQuotation()} />);
    });
    // Should not crash and should not render stale project name
    expect(getAllText(tree!).some((t) => t.includes('Sunrise Renovation'))).toBe(false);
  });

  it('calls onPress when tapped', async () => {
    const onPress = jest.fn();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <GlobalQuotationCard quotation={makeQuotation()} onPress={onPress} />,
      );
    });
    await act(async () => {
      tree!.root.findByProps({ testID: 'global-quotation-card' }).props.onPress();
    });
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
