import { IOcrAdapter, OcrResult } from './IOcrAdapter';

export interface OcrDocumentPageResult {
  pageIndex: number;
  imageUri: string;
  ocrResult: OcrResult;
}

export interface OcrDocumentResult {
  pageCount: number;
  pages: OcrDocumentPageResult[];
  merged: OcrResult;
  rawText: string;
}

export interface IOcrDocumentService {
  extractFromPages(pageImageUris: string[]): Promise<OcrDocumentResult>;
}

export class OcrDocumentService implements IOcrDocumentService {
  constructor(private readonly ocrAdapter: IOcrAdapter) {}

  async extractFromPages(pageImageUris: string[]): Promise<OcrDocumentResult> {
    if (pageImageUris.length === 0) {
      throw new Error('No page images provided for OCR');
    }

    console.log('[OCR][Document] Starting multi-page OCR', {
      pageCount: pageImageUris.length,
      pageImageUris,
    });

    const pages: OcrDocumentPageResult[] = [];

    for (let pageIndex = 0; pageIndex < pageImageUris.length; pageIndex += 1) {
      const imageUri = pageImageUris[pageIndex];
      const ocrResult = await this.ocrAdapter.extractText(imageUri);

      console.log('[OCR][PageResult]', {
        pageIndex,
        imageUri,
        fullTextLength: ocrResult.fullText.length,
        tokenCount: ocrResult.tokens.length,
        ocrResult,
      });

      pages.push({
        pageIndex,
        imageUri,
        ocrResult,
      });
    }

    const rawText = pages
      .map((page) => `--- Page ${page.pageIndex + 1} ---\n${page.ocrResult.fullText}`)
      .join('\n\n');

    const merged: OcrResult = {
      fullText: rawText,
      tokens: pages.flatMap((page) => page.ocrResult.tokens),
      imageUri: pageImageUris[0],
    };

    console.log('[OCR][Document] Merged OCR result', {
      pageCount: pages.length,
      mergedTextLength: merged.fullText.length,
      mergedTokenCount: merged.tokens.length,
      merged,
    });

    return {
      pageCount: pages.length,
      pages,
      merged,
      rawText,
    };
  }
}