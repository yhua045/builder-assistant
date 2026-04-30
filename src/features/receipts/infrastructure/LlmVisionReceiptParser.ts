import { IImageReader } from '../../../application/services/IImageReader';
import {
  IReceiptVisionParsingStrategy,
  ReceiptVisionStrategyType,
} from '../application/IReceiptVisionParsingStrategy';
import { NormalizedReceipt, NormalizedLineItem } from '../application/IReceiptNormalizer';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL = 'llama-3.2-90b-vision-preview';

const SYSTEM_PROMPT = `You are a document parser for a construction project management app.
Extract structured receipt information from the provided image.
Respond ONLY with valid JSON matching this schema:
{
  "vendor": string | null,
  "date": string | null,
  "total": number | null,
  "subtotal": number | null,
  "tax": number | null,
  "currency": string,
  "paymentMethod": "card" | "cash" | "bank" | "other" | null,
  "receiptNumber": string | null,
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "notes": string | null
}
Do not wrap in markdown or code blocks.
For date, use ISO format YYYY-MM-DD.
For currency, default to "AUD" if not found.
Set null for fields not found in the document.`;

function emptyNormalizedReceipt(): NormalizedReceipt {
  return {
    vendor: null,
    date: null,
    total: null,
    subtotal: null,
    tax: null,
    currency: 'AUD',
    paymentMethod: null,
    receiptNumber: null,
    lineItems: [],
    notes: null,
    confidence: {
      overall: 0,
      vendor: 0,
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

function parsePaymentMethod(
  value: string | null | undefined,
): NormalizedReceipt['paymentMethod'] {
  if (value === 'card' || value === 'cash' || value === 'bank' || value === 'other') {
    return value;
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResponse(raw: any): NormalizedReceipt {
  const lineItems: NormalizedLineItem[] = Array.isArray(raw.lineItems)
    ? raw.lineItems.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item: any): NormalizedLineItem => ({
          description: String(item.description ?? ''),
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unitPrice ?? 0),
          total: Number(item.total ?? 0),
        }),
      )
    : [];

  const vendor = raw.vendor ?? null;
  const date = parseDate(raw.date);
  const total = raw.total != null ? Number(raw.total) : null;

  const overall =
    confidenceFor(vendor) * 0.3 +
    confidenceFor(date) * 0.3 +
    confidenceFor(total) * 0.4;

  return {
    vendor,
    date,
    total,
    subtotal: raw.subtotal != null ? Number(raw.subtotal) : null,
    tax: raw.tax != null ? Number(raw.tax) : null,
    currency: raw.currency ?? 'AUD',
    paymentMethod: parsePaymentMethod(raw.paymentMethod),
    receiptNumber: raw.receiptNumber ?? null,
    lineItems,
    notes: raw.notes ?? null,
    confidence: {
      overall,
      vendor: confidenceFor(vendor),
      date: confidenceFor(date),
      total: confidenceFor(total),
    },
    suggestedCorrections: [],
  };
}

export class LlmVisionReceiptParser implements IReceiptVisionParsingStrategy {
  readonly strategyType: ReceiptVisionStrategyType = 'llm-vision';

  constructor(
    private readonly apiKey: string,
    private readonly imageReader: IImageReader,
    private readonly timeoutMs = 60_000,
  ) {}

  async parse(imageUri: string): Promise<NormalizedReceipt> {
    const base64 = await this.imageReader.readAsBase64(imageUri);
    const mimeType = this.imageReader.getMimeType(imageUri);

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
          model: VISION_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${base64}` },
                },
                {
                  type: 'text',
                  text: 'Extract the structured data from this document image.',
                },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Groq Vision API failed: HTTP ${res.status}`);
      }

      const body = await res.json();
      const content: string = body.choices?.[0]?.message?.content ?? '{}';

      try {
        return parseResponse(JSON.parse(content));
      } catch {
        return emptyNormalizedReceipt();
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw isAbort
        ? new Error(`Groq Vision timed out after ${this.timeoutMs}ms`)
        : err;
    } finally {
      clearTimeout(timer);
    }
  }
}
