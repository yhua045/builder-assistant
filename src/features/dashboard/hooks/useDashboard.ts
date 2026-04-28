import { useState, useMemo, useCallback, ComponentType } from 'react';
import { Camera, Receipt, DollarSign, FileText, Wrench } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useProjectsOverview } from './useProjectsOverview';
import type { ProjectOverview } from './useProjectsOverview';
import { MobileOcrAdapter } from '../../../infrastructure/ocr/MobileOcrAdapter';
import { InvoiceNormalizer } from '../../invoices';
import { PdfThumbnailConverter } from '../../../infrastructure/files/PdfThumbnailConverter';
import { LlmQuotationParser } from '../../../infrastructure/ai/LlmQuotationParser';
import { LlmReceiptParser } from '../../receipts/infrastructure/LlmReceiptParser';
import { GROQ_API_KEY } from '@env';
import type { IQuotationParsingStrategy } from '../../../application/ai/IQuotationParsingStrategy';
import type { IReceiptParsingStrategy } from '../../receipts/application/IReceiptParsingStrategy';

export interface QuickAction {
  id: string;
  title: string;
  icon: ComponentType<{ size?: number; className?: string; color?: string }>;
  color: string;
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { id: '1', title: 'Snap Receipt', icon: Camera, color: 'bg-chart-1' },
  { id: '2', title: 'Add Invoice', icon: Receipt, color: 'bg-chart-5' },
  { id: '3', title: 'Log Payment', icon: DollarSign, color: 'bg-chart-2' },
  { id: '4', title: 'Add Quote', icon: FileText, color: 'bg-chart-3' },
  { id: '5', title: 'Ad Hoc Task', icon: Wrench, color: 'bg-chart-4' },
];

export interface DashboardViewModel {
  // Data state
  overviews?: ProjectOverview[];
  isLoading: boolean;
  error: Error | null;
  hasProjects: boolean;

  // Presentation config
  quickActions: readonly QuickAction[];

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

  const handleQuickAction = useCallback((actionId: string) => {
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
  }, []);

  const navigateToProject = useCallback((projectId: string) => {
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
  }, [navigation]);

  const openQuickActions = useCallback(() => setShowQuickActions(true), []);
  const closeQuickActions = useCallback(() => setShowQuickActions(false), []);
  const closeSnapReceipt = useCallback(() => setShowSnapReceipt(false), []);
  const closeAddInvoice = useCallback(() => setShowAddInvoice(false), []);
  const closeAdHocTask = useCallback(() => setShowAdHocTask(false), []);
  const closeQuotation = useCallback(() => setShowQuotation(false), []);
  const onManualEntry = useCallback(() => setCreateKey(k => k + 1), []);

  return {
    overviews,
    isLoading,
    quickActions: QUICK_ACTIONS,
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
    openQuickActions,
    closeQuickActions,
    handleQuickAction,
    closeSnapReceipt,
    closeAddInvoice,
    closeAdHocTask,
    closeQuotation,
    onManualEntry,
    navigateToProject,
  };
}
