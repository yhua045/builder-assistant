import {
  DocumentParseInput,
  DocumentParser,
  ParsedDocumentText,
  TextNormalizer,
} from '../../domain/services/DocumentParser';

export class DefaultTextNormalizer implements TextNormalizer {
  normalize(input: string): string {
    return input
      .replace(/\r\n/g, '\n')
      .replace(/\u00A0/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .trim();
  }
}

export class ParserRegistry {
  constructor(
    private readonly parsers: DocumentParser[],
    private readonly normalizer: TextNormalizer = new DefaultTextNormalizer(),
  ) {}

  static createDefault(parsers: DocumentParser[] = [], normalizer: TextNormalizer = new DefaultTextNormalizer()): ParserRegistry {
    return new ParserRegistry(parsers, normalizer);
  }

  selectParser(input: DocumentParseInput): DocumentParser {
    const parser = this.parsers.find(candidate => candidate.canHandle(input));

    if (!parser) {
      throw new Error(`No document parser registered for source type: ${input.sourceType}`);
    }

    return parser;
  }

  async parse(input: DocumentParseInput): Promise<ParsedDocumentText> {
    const parser = this.selectParser(input);
    const parsed = await parser.parse(input);

    return {
      ...parsed,
      text: this.normalizer.normalize(parsed.text),
      pageMetadata: parsed.pageMetadata.map(page => ({
        ...page,
        text: this.normalizer.normalize(page.text),
      })),
      elements: parsed.elements?.map(element => {
        switch (element.type) {
          case 'heading':
          case 'paragraph':
            return { ...element, text: this.normalizer.normalize(element.text) };
          case 'list':
            return {
              ...element,
              items: element.items.map(item => ({
                ...item,
                text: this.normalizer.normalize(item.text),
              })),
            };
          case 'table':
            return {
              ...element,
              caption: element.caption ? this.normalizer.normalize(element.caption) : undefined,
              headers: element.headers?.map(header => this.normalizer.normalize(header)),
              rows: element.rows.map(row => row.map(cell => this.normalizer.normalize(cell))),
            };
          case 'figure':
            return {
              ...element,
              caption: element.caption ? this.normalizer.normalize(element.caption) : undefined,
              altText: element.altText ? this.normalizer.normalize(element.altText) : undefined,
              extractedText: element.extractedText ? this.normalizer.normalize(element.extractedText) : undefined,
            };
        }
      }),
    };
  }
}

export class DefaultDocumentParser implements DocumentParser {
  constructor(private readonly registry: ParserRegistry) {}

  canHandle(input: DocumentParseInput): boolean {
    try {
      this.registry.selectParser(input);
      return true;
    } catch {
      return false;
    }
  }

  async parse(input: DocumentParseInput): Promise<ParsedDocumentText> {
    return this.registry.parse(input);
  }
}
