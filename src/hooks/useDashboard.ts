import { useState, useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useProjectsOverview } from './useProjectsOverview';
import type { ProjectOverview } from './useProjectsOverview';
import { MobileOcrAdapter } from '../infrastructure/ocr/MobileOcrAdapter';
import { InvoiceNormalizer } from '../application/ai/InvoiceNormalizer';
import { PdfThumbnailConverter } from '../infrastructure/files/PdfThumbnailConverter';
import { LlmQuotationParser } from '../infrastructure/ai/LlmQuotationParser';
import { LlmReceiptParser } from '../infrastructure/ai/LlmReceiptParser';
import { GROQ_API_KEY } from '@env';
import type { IQuotationParsingStrategy } from '../application/ai/IQuotationParsingStrategy';
import type { IReceiptParsingStrategy } from '../application/receipt/IReceiptParsingStrategy';

export interface DashboardViewModel {
  // Data state
  overviews?: ProjectOverview[];
  isLoading: boolean;
  error: Error | null;
  hasProjects: boolean;

  // Modal / UI state
  showQuickActions: boolean;
  showSnapReceipt: boolean;
  showAddInvoice: boolean;
  showAdHocTask: boolean;
  showQuotation: boolean;
  createKey: number;

  // Infrastructure services (wired here so UI stays clean)
  invoiceOcrAdapter: MobileOcrAdapter;
  invoiceNormalizer: InvoiceNormalizer;
  invoicePdfConverter: PdfThumbnailConverter;
  quotationParser: IQuotationParsingStrategy | undefined;
  receiptParser: IReceiptParsingStrategy | undefined;

  // Operations
  openQuickActions: () => void;
  closeQuickActions: () => void;
  handleQuickAction: (actionId: string) => void;
  closeSnapReceipt: () => void;
  closeAddInvoice: () => void;
  closeAdHocTask: () => void;
  closeQuotation: () => void;
  onManualEntry: () => void;
  navigateToProject: (projectId: string) => void;
}

export function useDashboard(): DashboardViewModel {
  const { data: overviews, isLoading, error } = useProjectsOverview();
  const navigation = useNavigation<any>();

  const [createKey, setCreateKey] = useState(0);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showSnapReceipt, setShowSnapReceipt] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [showAdHocTask, setShowAdHocTask] = useState(false);
  const [showQuotation, setShowQuotation] = useState(false);

  const invoiceOcrAdapter = useMemo(() => new MobileOcrAdapter(), []);
  const invoiceNormalizer = useMemo(() => new InvoiceNormalizer(), []);
  const invoicePdfConverter = useMemo(() => new PdfThumbnailConverter(), []);
  const quotationParser = useMemo(
    () => (GROQ_API_KEY ? new LlmQuotationParser(GROQ_API_KEY) : undefined),
    [],
  );
  const receiptParser = useMemo(
    () => (GROQ_API_KEY ? new LlmReceiptParser(GROQ_API_KEY) : undefined),
    [],
  );

  const hasProjects = (overviews?.length ?? 0) > 0;

  const handleQuickAction = (actionId: string) => {
    setShowQuickActions(false);
    if (actionId === '1') {
      setShowSnapReceipt(true);
    } else if (actionId === '2') {
      setShowAddInvoice(true);
    } else if (actionId === '4') {
      setShowQuotation(true);
    } else if (actionId === '5') {
      setShowAdHocTask(true);
    }
    // actionId '3' (Log Payment) — TODO: not yet implemented
  };

  const navigateToProject = (projectId: string) => {
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Projects',
        params: {
          screen: 'ProjectDetail',
          params: { projectId },
          initial: false,
        },
      }),
    );
  };

  return {
    overviews,
    isLoading,
    error: error ?? null,
    hasProjects,
    showQuickActions,
    showSnapReceipt,
    showAddInvoice,
    showAdHocTask,
    showQuotation,
    createKey,
    invoiceOcrAdapter,
    invoiceNormalizer,
    invoicePdfConverter,
    quotationParser,
    receiptParser,
    openQuickActions: () => setShowQuickActions(true),
    closeQuickActions: () => setShowQuickActions(false),
    handleQuickAction,
    closeSnapReceipt: () => setShowSnapReceipt(false),
    closeAddInvoice: () => setShowAddInvoice(false),
    closeAdHocTask: () => setShowAdHocTask(false),
    closeQuotation: () => setShowQuotation(false),
    onManualEntry: () => setCreateKey(k => k + 1),
    navigateToProject,
  };
}
