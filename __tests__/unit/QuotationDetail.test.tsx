/**
 * Unit tests for QuotationDetailScreen — issue #192
 * Covers: project row display, vendor display
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { container } from 'tsyringe';

// Mock navigation before importing the screen
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: () => ({ params: { quotationId: 'q1' } }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false }), useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock('../../src/infrastructure/di/registerServices', () => {});

const mockGetQuotation = jest.fn();
jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
}));

const mockGetProject = jest.fn();

import QuotationDetailScreen from '../../src/pages/projects/QuotationDetail';

describe('QuotationDetailScreen project row (issue #192)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (container.resolve as jest.Mock).mockImplementation((token: string) => {
      if (token === 'QuotationRepository') {
        return { getQuotation: mockGetQuotation };
      }
      if (token === 'TaskRepository') { return {}; } 
      if (token === 'InvoiceRepository') { return {}; } 

      if (token === 'ProjectRepository') {
        return { getProject: mockGetProject };
      }
      throw new Error(`Unknown token: ${token}`);
    });
  });

  it('shows project name row when projectId is set', async () => {
    mockGetQuotation.mockResolvedValue({
      id: 'q1',
      reference: 'QUO-001',
      date: '2026-01-01',
      total: 1000,
      currency: 'AUD',
      status: 'draft',
      projectId: 'proj1',
      vendorName: 'Builder Co',
    });
    mockGetProject.mockResolvedValue({ id: 'proj1', name: 'Bathroom Reno', status: 'in_progress', materials: [], phases: [] });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<QuotationDetailScreen />);
    });

    const root = testRenderer!.root;
    const projectNameEl = root.findByProps({ testID: 'quotation-detail-project-name' });
    expect(projectNameEl).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('hides project row when projectId is absent', async () => {
    mockGetQuotation.mockResolvedValue({
      id: 'q1',
      reference: 'QUO-001',
      date: '2026-01-01',
      total: 1000,
      currency: 'AUD',
      status: 'draft',
      vendorName: 'Builder Co',
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<QuotationDetailScreen />);
    });

    const root = testRenderer!.root;
    const projectRows = root.findAllByProps({ testID: 'quotation-detail-project-name' });
    expect(projectRows).toHaveLength(0);
    act(() => { testRenderer!.unmount(); });
  });

  it('shows vendorName in summary card', async () => {
    mockGetQuotation.mockResolvedValue({
      id: 'q1',
      reference: 'QUO-001',
      date: '2026-01-01',
      total: 2000,
      currency: 'AUD',
      status: 'draft',
      vendorName: 'Jane Smith',
      vendorId: 'c1',
    });

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<QuotationDetailScreen />);
    });

    const root = testRenderer!.root;
    const vendorEl = root.findByProps({ testID: 'quotation-detail-vendor-name' });
    expect(vendorEl).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });
});
