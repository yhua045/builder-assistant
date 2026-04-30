import { OcrResult } from '../../../application/services/IOcrAdapter';
import {
  IInvoiceParsingStrategy,
  InvoiceParsingStrategyType,
} from '../application/IInvoiceParsingStrategy';
import { NormalizedInvoice, NormalizedInvoiceLineItem } from '../application/IInvoiceNormalizer';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a document parser for a construction project management app.
Extract structured invoice information from OCR text.
Respond ONLY with valid JSON matching this schema:
{
  "vendor": string | null,
  "invoiceNumber": string | null,
  "invoiceDate": string | null,
  "dueDate": string | null,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "currency": string,
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "total": number,
      "tax": number | null
    }
  ]
}
Do not wrap in markdown or code blocks.
For dates, use ISO format YYYY-MM-DD.
For currency, default to "AUD" if not found.
Set null for fields not found in the document.`;

function emptyNormalizedInvoice(): NormalizedInvoice {
  return {
    vendor: null,
    invoiceNumber: null,
    invoiceDate: null,
    dueDate: null,
    subtotal: null,
    tax: null,
    total: null,
    currency: 'AUD',
    lineItems: [],
    confidence: {
      overall: 0,
      vendor: 0,
      invoiceNumber: 0,
      invoiceDate: 0,
      total: 0,
    },
    suggestedCorrections: [],
  };
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function confidenceFor(value: unknown): number {
  return value != null ? 0.9 : 0.0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(raw: any): NormalizedInvoice {
  const lineItems: NormalizedInvoiceLineItem[] = Array.isArray(raw.lineItems)
    ? raw.lineItems.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any): NormalizedInvoiceLineItem => ({
          description: String(item.description ?? ''),
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
          total: Number(item.total ?? 0),
          tax: item.tax != null ? Number(item.tax) : undefined,
        }),
      )
    : [];

  const vendor = raw.vendor ?? null;
  const invoiceNumber = raw.invoiceNumber ?? null;
  const invoiceDate = parseDate(raw.invoiceDate);
  const dueDate = parseDate(raw.dueDate);
  const total = raw.total != null ? Number(raw.total) : null;

  const overall =
    confidenceFor(vendor) * 0.25 +
    confidenceFor(invoiceNumber) * 0.25 +
    confidenceFor(invoiceDate) * 0.25 +
    confidenceFor(total) * 0.25;

  return {
    vendor,
    invoiceNumber,
    invoiceDate,
    dueDate,
    subtotal: raw.subtotal != null ? Number(raw.subtotal) : null,
    tax: raw.tax != null ? Number(raw.tax) : null,
    total,
    currency: raw.currency ?? 'AUD',
    lineItems,
    confidence: {
      overall,
      vendor: confidenceFor(vendor),
      invoiceNumber: confidenceFor(invoiceNumber),
      invoiceDate: confidenceFor(invoiceDate),
      total: confidenceFor(total),
    },
    suggestedCorrections: [],
  };
}

export class LlmInvoiceParser implements IInvoiceParsingStrategy {
  readonly strategyType: InvoiceParsingStrategyType = 'llm';

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async parse(ocrResult: OcrResult): Promise<NormalizedInvoice> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: ocrResult.fullText },
          ],
          temperature: 0,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Groq LLM failed: HTTP ${res.status}`);
      }

      const body = await res.json();
      const content: string = body.choices?.[0]?.message?.content ?? '{}';

      try {
        const parsed = JSON.parse(content);
        return parseResponse(parsed);
      } catch {
        return emptyNormalizedInvoice();
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw isAbort
        ? new Error(`Groq LLM timed out after ${this.timeoutMs}ms`)
        : err;
    } finally {
      clearTimeout(timer);
    }
  }
}
