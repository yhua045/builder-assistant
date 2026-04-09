import { PaymentFeedItem } from '../../../domain/entities/PaymentFeedItem';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';

const MAX_ITEMS = 500;

export interface ListProjectPaymentsFeedResult {
  items: PaymentFeedItem[];
  truncated: boolean;
}

/**
 * Combines unlinked payments and all invoices for the project payments feed.
 *
 * "Unlinked payment" = a Payment record with no invoiceId.
 * All Invoice records (any status) are included.
 *
 * Items are sorted ascending by due date; no-date items trail.
 * Enforces a MAX_ITEMS guard to protect render performance.
 */
export class ListProjectPaymentsFeedUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
  ) {}

  async execute(projectId: string): Promise<ListProjectPaymentsFeedResult> {
    const [allPayments, { items: allInvoices }] = await Promise.all([
      this.paymentRepo.findByProjectId(projectId),
      this.invoiceRepo.listInvoices({ projectId }),
    ]);

    // Only keep payments that are NOT linked to an invoice
    const unlinkedPayments = allPayments.filter(
      (p) => p.invoiceId === undefined || p.invoiceId === null,
    );

    const feedItems: PaymentFeedItem[] = [
      ...unlinkedPayments.map((p) => ({ kind: 'payment' as const, data: p })),
      ...allInvoices.map((inv) => ({ kind: 'invoice' as const, data: inv })),
    ];

    // Sort ascending by due date; items without a date trail at the end
    feedItems.sort((a, b) => {
      const dateA = resolveDueDate(a);
      const dateB = resolveDueDate(b);
      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;
      return dateA.localeCompare(dateB);
    });

    const truncated = feedItems.length > MAX_ITEMS;
    const items = truncated ? feedItems.slice(0, MAX_ITEMS) : feedItems;

    return { items, truncated };
  }
}

function resolveDueDate(item: PaymentFeedItem): string | null {
  if (item.kind === 'payment') {
    return item.data.dueDate?.slice(0, 10) ?? item.data.date?.slice(0, 10) ?? null;
  }
  // invoice
  return (
    item.data.dateDue?.slice(0, 10) ??
    item.data.dueDate?.slice(0, 10) ??
    item.data.issueDate?.slice(0, 10) ??
    null
  );
}
