import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Alert.alert = jest.fn();
  return RN;
});
import { QuotationScreen } from '../../src/pages/quotations/QuotationScreen';
import { useQuotations } from '../../src/hooks/useQuotations';
import { IFilePickerAdapter, FilePickerResult } from '../../src/infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';
import { IOcrAdapter } from '../../src/application/services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../src/application/ai/IInvoiceNormalizer';

jest.mock('../../src/hooks/useQuotations');
// Mock pickers so SubcontractorPickerModal / ProjectPickerModal don't require
// QueryClientProvider or tsyringe DI in upload-focused tests.
jest.mock('../../src/components/tasks/SubcontractorPickerModal', () => ({
  SubcontractorPickerModal: () => null,
  SubcontractorContact: {},
}));
jest.mock('../../src/components/shared/ProjectPickerModal', () => ({
  ProjectPickerModal: (props: any) => { const React = require('react'); const RN = require('react-native'); return React.createElement(RN.View, { testID: 'mock-project-picker-modal' }, React.createElement(RN.TouchableOpacity, { testID: 'mock-project-item-proj1', onPress: () => props.onSelect({ id: 'proj1', name: 'proj1' }) })); },
}));
jest.mock('../../src/components/inputs/QuickAddContractorModal', () => ({
  QuickAddContractorModal: () => null,
}));
jest.mock('../../src/hooks/useQuickLookup', () => ({
  useQuickLookup: () => ({ quickAdd: jest.fn() }),
}));

const mockUseQuotations = useQuotations as jest.MockedFunction<typeof useQuotations>;

function makeFilePicker(override: Partial<FilePickerResult> = {}): IFilePickerAdapter {
  return {
    pickDocument: jest.fn().mockResolvedValue({
      cancelled: false,
      uri: 'file:///tmp/quote.pdf',
      name: 'quote.pdf',
      size: 102400,
      type: 'application/pdf',
      ...override,
    }),
  };
}

function makeFileSystem(): IFileSystemAdapter {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/quote_123.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockReturnValue('/app/documents'),
  };
}

function makeNormalizedInvoice(): NormalizedInvoice {
  return {
    vendor: 'Builder Co',
    invoiceNumber: 'Q-001',
    invoiceDate: new Date('2026-03-01'),
    dueDate: new Date('2026-04-01'),
    subtotal: 1000,
    tax: 100,
    total: 1100,
    currency: 'AUD',
    lineItems: [],
    confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.8, invoiceDate: 0.9, total: 0.95 },
    suggestedCorrections: [],
  };
}

function makeOcrAdapter(): IOcrAdapter {
  return {
    extractText: jest.fn().mockResolvedValue({
      fullText: 'Quote from Builder Co',
      tokens: [],
      confidence: 0.9,
    }),
  };
}

function makeInvoiceNormalizer(normalized?: NormalizedInvoice): IInvoiceNormalizer {
  const n = normalized ?? makeNormalizedInvoice();
  return {
    extractCandidates: jest.fn().mockReturnValue({
      vendors: ['Builder Co'],
      invoiceNumbers: ['Q-001'],
      dates: [new Date('2026-03-01')],
      dueDates: [],
      amounts: [1100],
      subtotals: [],
      taxAmounts: [],
      lineItems: [],
    }),
    normalize: jest.fn().mockResolvedValue(n),
  };
}

const defaultCreateQuotation = jest.fn().mockResolvedValue({
  id: 'quot_test_123',
  reference: 'QUO-20260327-ABCDEF',
  date: '2026-03-27',
  total: 100,
  currency: 'AUD',
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuotations.mockReturnValue({
    createQuotation: defaultCreateQuotation,
    listQuotations: jest.fn(),
    getQuotation: jest.fn(),
    updateQuotation: jest.fn(),
    deleteQuotation: jest.fn(),
    approveQuotation: jest.fn(),
    declineQuotation: jest.fn(),
    taskQuotations: undefined,
    loading: false,
    error: null,
  });
});

describe('QuotationScreen — upload UX', () => {
  it('(1) shows upload Pressable by default', async () => {
    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} />
      );
    });
    const btn = tr!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    expect(btn).toBeDefined();
    act(() => { tr!.unmount(); });
  });

  it('(2) QuotationForm is visible without any navigation', async () => {
    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} />
      );
    });
    const form = tr!.root.findByProps({ testID: 'quotation-save-button' });
    expect(form).toBeDefined();
    act(() => { tr!.unmount(); });
  });

  it('(3) when picker is cancelled, form is unchanged, no error shown', async () => {
    const filePicker = makeFilePicker({ cancelled: true });

    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={jest.fn()}
          filePickerAdapter={filePicker}
        />
      );
    });

    const btn = tr!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    await act(async () => { btn.props.onPress(); });

    expect(Alert.alert).not.toHaveBeenCalled();
    act(() => { tr!.unmount(); });
  });

  it('(4) shows Alert when invalid file type selected', async () => {
    const filePicker = makeFilePicker({ type: 'application/msword', name: 'document.doc' });

    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={jest.fn()}
          filePickerAdapter={filePicker}
        />
      );
    });

    const btn = tr!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    await act(async () => { btn.props.onPress(); });

    expect(Alert.alert).toHaveBeenCalled();
    act(() => { tr!.unmount(); });
  });

  it('(5) when OCR adapters absent, form shown without pre-fill, no error', async () => {
    const filePicker = makeFilePicker();
    const fileSystem = makeFileSystem();

    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={jest.fn()}
          filePickerAdapter={filePicker}
          fileSystemAdapter={fileSystem}
          // no ocrAdapter / invoiceNormalizer → graceful degradation
        />
      );
    });

    const btn = tr!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    await act(async () => { btn.props.onPress(); });

    // Form and upload button should still be visible
    const form = tr!.root.findByProps({ testID: 'quotation-save-button' });
    expect(form).toBeDefined();

    // No error state shown
    const errorBanners = tr!.root.findAllByProps({ testID: 'ocr-error-banner' });
    expect(errorBanners).toHaveLength(0);

    act(() => { tr!.unmount(); });
  });

  it('(6) upload with OCR adapters succeeds → form pre-fills vendorName', async () => {
      const filePicker = makeFilePicker({ type: 'image/jpeg', name: 'quote.jpg' });
    const fileSystem = makeFileSystem();
    const ocrAdapter = makeOcrAdapter();
    const invoiceNormalizer = makeInvoiceNormalizer();

    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={jest.fn()}
          filePickerAdapter={filePicker}
          fileSystemAdapter={fileSystem}
          ocrAdapter={ocrAdapter}
          invoiceNormalizer={invoiceNormalizer}
        />
      );
    });

    const btn = tr!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    await act(async () => { btn.props.onPress(); });

    // Form should be pre-filled with vendor from OCR
    const vendorInput = tr!.root.findByProps({ testID: 'quotation-vendor-picker-row' });
    expect(vendorInput.props.children[1].props.children).toContain('Builder Co');

    act(() => { tr!.unmount(); });
  });

  it('(7) OCR failure shows error banner, form still editable', async () => {
    const filePicker = makeFilePicker({ type: 'image/jpeg', name: 'quote.jpg' });
    const fileSystem = makeFileSystem();
    const ocrAdapter: IOcrAdapter = {
      extractText: jest.fn().mockRejectedValue(new Error('OCR service unavailable')),
    };
    const invoiceNormalizer = makeInvoiceNormalizer();

    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={jest.fn()}
          filePickerAdapter={filePicker}
          fileSystemAdapter={fileSystem}
          ocrAdapter={ocrAdapter}
          invoiceNormalizer={invoiceNormalizer}
        />
      );
    });

    const btn = tr!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    await act(async () => { btn.props.onPress(); });

    // Error banner should be visible
    const errorBanner = tr!.root.findByProps({ testID: 'ocr-error-banner' });
    expect(errorBanner).toBeDefined();

    // Form should remain accessible
    const form = tr!.root.findByProps({ testID: 'quotation-save-button' });
    expect(form).toBeDefined();

    act(() => { tr!.unmount(); });
  });

  it('(8) submit with empty reference calls createQuotation (domain auto-generates ref)', async () => {
    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} />
      );
    });

    const root = tr!.root;

    // Leave reference blank, fill in total
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('500');
    }); 
    await act(async () => { 
      const picker = root.findByProps({ testID: 'quotation-project-picker-row' }); 
      picker.props.onPress(); 
    }); 
    await act(async () => { 
      const item = root.findByProps({ testID: 'mock-project-item-proj1' }); 
      item.props.onPress(); 

    });

    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });

    expect(defaultCreateQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: expect.stringMatching(/^QUO-\d{8}-[A-Z0-9]{6}$/),
        total: 500,
      })
    );

    act(() => { tr!.unmount(); });
  });

  it('(9) onSuccess is called after save with the created Quotation', async () => {
    const onSuccess = jest.fn();
    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} onSuccess={onSuccess} />
      );
    });

    const root = tr!.root;
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('500');
    }); 
    await act(async () => { 
      const picker = root.findByProps({ testID: 'quotation-project-picker-row' }); 
      picker.props.onPress(); 
    }); 
    await act(async () => { 
      const item = root.findByProps({ testID: 'mock-project-item-proj1' }); 
      item.props.onPress(); 

    });

    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });

    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'quot_test_123' })
    );

    act(() => { tr!.unmount(); });
  });

  it('(10) onClose is called after save', async () => {
    const onClose = jest.fn();
    let tr: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      tr = renderer.create(
        <QuotationScreen visible={true} onClose={onClose} />
      );
    });

    const root = tr!.root;
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('500');
    }); 
    await act(async () => { 
      const picker = root.findByProps({ testID: 'quotation-project-picker-row' }); 
      picker.props.onPress(); 
    }); 
    await act(async () => { 
      const item = root.findByProps({ testID: 'mock-project-item-proj1' }); 
      item.props.onPress(); 

    });

    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });

    expect(onClose).toHaveBeenCalled();

    act(() => { tr!.unmount(); });
  });
});
