import { StructuredDocumentChunkingStrategy } from '../../application/services/StructuredDocumentChunkingStrategy';
import type { ParsedDocumentElement } from '../../../../shared/domain/services/DocumentParser';

describe('StructuredDocumentChunkingStrategy', () => {
  it('preserves section context and renders structured elements into embedding content', async () => {
    const elements: ParsedDocumentElement[] = [
      { type: 'heading', text: 'Engineering Plan', level: 1 },
      { type: 'paragraph', text: '45x45 mm steel post.' },
      {
        type: 'list',
        ordered: false,
        items: [{ text: 'Install posts', level: 0 }],
      },
      {
        type: 'table',
        caption: 'Materials',
        headers: ['Item', 'Specification'],
        rows: [['Steel post', '45x45 mm']],
      },
      { type: 'figure', caption: 'Detail A', extractedText: 'Post connection' },
    ];

    const chunks = await new StructuredDocumentChunkingStrategy().chunkDocument({
      documentId: 'doc-1',
      documentVersion: 1,
      rawText: '45x45 mm steel post.',
      elements,
      config: {
        targetMinWords: 1,
        targetMaxWords: 100,
        hardMaxWords: 100,
        mergeThresholdWords: 1,
        preferBoundary: ['section', 'paragraph', 'word'],
      },
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.map(chunk => chunk.content).join('\n')).toContain('Engineering Plan');
    expect(chunks.map(chunk => chunk.content).join('\n')).toContain('45x45 mm steel post');
    expect(chunks.map(chunk => chunk.content).join('\n')).toContain('Materials');
    expect(chunks.map(chunk => chunk.content).join('\n')).toContain('Install posts');
    expect(chunks.map(chunk => chunk.content).join('\n')).toContain('Detail A');
    expect(chunks.every(chunk => chunk.metadata?.heading === 'Engineering Plan')).toBe(true);
  });

  it('falls back to plain text when no usable elements are provided', async () => {
    const chunks = await new StructuredDocumentChunkingStrategy().chunkDocument({
      documentId: 'doc-2',
      documentVersion: 1,
      rawText: 'Plain document text.',
      elements: [],
      config: {
        targetMinWords: 1,
        targetMaxWords: 20,
        hardMaxWords: 20,
        mergeThresholdWords: 1,
        preferBoundary: ['paragraph', 'word'],
      },
    });

    expect(chunks[0].content).toBe('Plain document text.');
    expect(chunks[0].metadata?.heading).toBeUndefined();
  });
});