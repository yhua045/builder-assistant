import { OcrResult } from '../../application/services/IOcrAdapter';
import {
  IQuotationParsingStrategy,
  NormalizedQuotation,
  NormalizedQuotationLineItem,
  QuotationParsingStrategyType,
} from '../../application/ai/IQuotationParsingStrategy';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a document parser for a construction project management app.
Extract structured quotation/estimate information from OCR text of a PDF document.
Respond ONLY with a valid JSON object matching this schema:
{
  "reference": string | null,
  "vendor": string | null,
  "vendorEmail": string | null,
  "vendorPhone": string | null,
  "vendorAddress": string | null,
  "taxId": string | null,
  "date": string | null,
  "expiryDate": string | null,
  "currency": string,
  "subtotal": number | null,
  "tax": number | null,
  "total": number | null,
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unit": string | null,
      "unitPrice": number,
      "total": number,
      "tax": number | null
    }
  ],
  "paymentTerms": string | null,
  "scope": string | null,
  "exclusions": string | null,
  "notes": string | null
}
Omit fields that are not found in the document (set to null).
Do not wrap in markdown or code blocks.
For dates, convert to ISO 8601 format (YYYY-MM-DD).
For currency, detect from symbols ($=AUD for Australian context, \u20ac=EUR, \u00a3=GBP) or text.
Extract ALL line items found in the document, even if formatting varies.`;

function emptyNormalizedQuotation(): NormalizedQuotation {
  return {
    reference: null,
    vendor: null,
    vendorEmail: null,
    vendorPhone: null,
    vendorAddress: null,
    taxId: null,
    date: null,
    expiryDate: null,
    currency: 'AUD',
    subtotal: null,
    tax: null,
    total: null,
    lineItems: [],
    paymentTerms: null,
    scope: null,
    exclusions: null,
    notes: null,
    confidence: {
      overall: 0,
      vendor: 0,
      reference: 0,
      date: 0,
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
function parseResponse(raw: any): NormalizedQuotation {
  const lineItems: NormalizedQuotationLineItem[] = Array.isArray(raw.lineItems)
    ? raw.lineItems.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any): NormalizedQuotationLineItem => ({
          description: String(item.description ?? ''),
          quantity: Number(item.quantity ?? 0),
          unit: item.unit ?? undefined,
          unitPrice: Number(item.unitPrice ?? 0),
          total: Number(item.total ?? 0),
          tax: item.tax != null ? Number(item.tax) : undefined,
        }),
      )
    : [];

  const date = parseDate(raw.date);
  const expiryDate = parseDate(raw.expiryDate);
  const vendor = raw.vendor ?? null;
  const reference = raw.reference ?? null;
  const total = raw.total != null ? Number(raw.total) : null;

  const overall =
    (confidenceFor(vendor) * 0.3 +
      confidenceFor(reference) * 0.2 +
      confidenceFor(date) * 0.2 +
      confidenceFor(total) * 0.3);

  return {
    reference,
    vendor,
    vendorEmail: raw.vendorEmail ?? null,
    vendorPhone: raw.vendorPhone ?? null,
    vendorAddress: raw.vendorAddress ?? null,
    taxId: raw.taxId ?? null,
    date,
    expiryDate,
    currency: raw.currency ?? 'AUD',
    subtotal: raw.subtotal != null ? Number(raw.subtotal) : null,
    tax: raw.tax != null ? Number(raw.tax) : null,
    total,
    lineItems,
    paymentTerms: raw.paymentTerms ?? null,
    scope: raw.scope ?? null,
    exclusions: raw.exclusions ?? null,
    notes: raw.notes ?? null,
    confidence: {
      overall,
      vendor: confidenceFor(vendor),
      reference: confidenceFor(reference),
      date: confidenceFor(date),
      total: confidenceFor(total),
    },
    suggestedCorrections: [],
  };
}

export class LlmQuotationParser implements IQuotationParsingStrategy {
  readonly strategyType: QuotationParsingStrategyType = 'llm';

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async parse(ocrResult: OcrResult): Promise<NormalizedQuotation> {
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
        return emptyNormalizedQuotation();
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
